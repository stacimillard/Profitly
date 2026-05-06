import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  parseCSV,
  detectColumns,
  parseCsvDate,
  parseCsvAmountCents,
} from '@/lib/csv/parse';
import {
  daysBetween,
  expectedTransactionForLine,
} from '@/lib/reconciliations/matching';
import type { BankAccountType } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MATCH_DATE_WINDOW_DAYS = 5;

/**
 * POST /api/reconciliations/[id]/import
 * FormData: file (the bank statement CSV)
 *
 * Parses the CSV into reconciliation_lines and runs an auto-matcher
 * against the org's transactions for the same bank account & date range.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id: reconciliationId } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Upload failed — please try again.' },
      { status: 400 }
    );
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Pick a CSV file.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: recon } = await supabase
    .from('reconciliations')
    .select(
      'id, status, bank_account_id, statement_start_date, statement_end_date, bank_accounts:bank_account_id(type)'
    )
    .eq('id', reconciliationId)
    .maybeSingle<{
      id: string;
      status: string;
      bank_account_id: string;
      statement_start_date: string;
      statement_end_date: string;
      bank_accounts: { type: BankAccountType } | null;
    }>();

  if (!recon) {
    return NextResponse.json(
      { error: 'Reconciliation not found.' },
      { status: 404 }
    );
  }
  if (recon.status === 'completed') {
    return NextResponse.json(
      {
        error:
          "This reconciliation is already done. Start a new one to import another statement.",
      },
      { status: 400 }
    );
  }

  const bankType = recon.bank_accounts?.type;
  if (!bankType) {
    return NextResponse.json(
      { error: "We couldn't find the bank account for this reconciliation." },
      { status: 500 }
    );
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "We couldn't find any rows in that CSV." },
      { status: 400 }
    );
  }
  const cols = detectColumns(rows[0]);
  if (!cols) {
    return NextResponse.json(
      {
        error:
          "We couldn't read the columns. Need Date, Description, and either Amount or Debit/Credit.",
      },
      { status: 400 }
    );
  }

  // Wipe any previously-imported lines for this recon so re-importing works.
  await supabase
    .from('reconciliation_lines')
    .delete()
    .eq('reconciliation_id', reconciliationId);

  interface LineInsert {
    organization_id: string;
    reconciliation_id: string;
    statement_date: string;
    statement_description: string;
    statement_amount_cents: number;
    is_matched: boolean;
  }

  const lineInserts: LineInsert[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => c === '')) continue;

    const date = parseCsvDate(row[cols.date] ?? '');
    const description = (row[cols.description] ?? '').trim();
    if (!date || !description) {
      skipped++;
      continue;
    }

    let amountCents = 0;
    if (cols.amount !== undefined) {
      amountCents = parseCsvAmountCents(row[cols.amount] ?? '');
    } else {
      const debit =
        cols.debit !== undefined
          ? parseCsvAmountCents(row[cols.debit] ?? '')
          : 0;
      const credit =
        cols.credit !== undefined
          ? parseCsvAmountCents(row[cols.credit] ?? '')
          : 0;
      // Withdrawals/debits → negative on statement; deposits/credits → positive.
      amountCents = Math.abs(credit) - Math.abs(debit);
    }
    if (amountCents === 0) {
      skipped++;
      continue;
    }

    lineInserts.push({
      organization_id: ctx.organizationId,
      reconciliation_id: reconciliationId,
      statement_date: date,
      statement_description: description,
      statement_amount_cents: amountCents,
      is_matched: false,
    });
  }

  if (lineInserts.length === 0) {
    return NextResponse.json(
      {
        error: "We couldn't find any usable rows in that CSV.",
      },
      { status: 400 }
    );
  }

  const { data: insertedLines, error: insertError } = await supabase
    .from('reconciliation_lines')
    .insert(lineInserts)
    .select();

  if (insertError || !insertedLines) {
    return NextResponse.json(
      { error: insertError?.message || "Couldn't save the statement lines." },
      { status: 500 }
    );
  }

  // Auto-match: pull all candidate transactions for this bank account in
  // a generous date window around the statement period.
  const windowStart = new Date(recon.statement_start_date);
  windowStart.setDate(windowStart.getDate() - MATCH_DATE_WINDOW_DAYS);
  const windowEnd = new Date(recon.statement_end_date);
  windowEnd.setDate(windowEnd.getDate() + MATCH_DATE_WINDOW_DAYS);

  const { data: txnCandidates } = await supabase
    .from('transactions')
    .select('id, date, amount_cents, direction, description, status')
    .eq('bank_account_id', recon.bank_account_id)
    .gte('date', windowStart.toISOString().slice(0, 10))
    .lte('date', windowEnd.toISOString().slice(0, 10))
    .neq('status', 'reconciled');

  const candidates = txnCandidates ?? [];
  const usedTxnIds = new Set<string>();
  let autoMatched = 0;

  for (const line of insertedLines) {
    const expected = expectedTransactionForLine(
      bankType,
      line.statement_amount_cents
    );

    const matches = candidates.filter(
      (t) =>
        !usedTxnIds.has(t.id) &&
        t.direction === expected.direction &&
        t.amount_cents === expected.amount_cents &&
        daysBetween(t.date, line.statement_date) <= MATCH_DATE_WINDOW_DAYS
    );

    if (matches.length === 1) {
      const txn = matches[0];
      const { error: updateError } = await supabase
        .from('reconciliation_lines')
        .update({
          matched_transaction_id: txn.id,
          is_matched: true,
        })
        .eq('id', line.id);
      if (!updateError) {
        usedTxnIds.add(txn.id);
        autoMatched++;
      }
    }
  }

  return NextResponse.json({
    data: {
      imported: insertedLines.length,
      auto_matched: autoMatched,
      unmatched: insertedLines.length - autoMatched,
      skipped,
    },
  });
}

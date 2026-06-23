import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  extractFromFile,
  ImportError,
  type ParsedTransaction,
} from '@/lib/import/extract';
import type { BankAccount } from '@/lib/types';

interface DuplicateInfo {
  client_id: string;
  matched_transaction_id: string;
  matched_description: string;
}

/**
 * POST /api/transactions/import/parse
 * FormData fields:
 *   - file: a CSV or PDF bank statement
 *   - bank_account_id: which bank account these transactions belong to
 *
 * Reads the file (CSV via auto-detected columns, PDF via Anthropic),
 * computes which lines might already exist as imported transactions,
 * and returns the parsed list so the client can show a review step.
 * Nothing is written to the transactions table at this stage.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

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
  const bankAccountId = formData.get('bank_account_id');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Please pick a CSV or PDF file.' },
      { status: 400 }
    );
  }
  if (typeof bankAccountId !== 'string' || !bankAccountId) {
    return NextResponse.json(
      { error: 'Pick which bank account these belong to.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('id, name, type')
    .eq('id', bankAccountId)
    .maybeSingle();
  if (!bankAccount) {
    return NextResponse.json(
      { error: "We couldn't find that bank account." },
      { status: 400 }
    );
  }

  let parsed: { transactions: ParsedTransaction[]; skipped: number; source: 'csv' | 'pdf' };
  try {
    parsed = await extractFromFile({
      file,
      bankAccountType: (bankAccount as BankAccount).type,
    });
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message =
      err instanceof Error ? err.message : 'Something went wrong reading that file.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { transactions, skipped, source } = parsed;

  // Bound the duplicate-check query to the date range of what we just parsed.
  let minDate = transactions[0].date;
  let maxDate = transactions[0].date;
  for (const t of transactions) {
    if (t.date < minDate) minDate = t.date;
    if (t.date > maxDate) maxDate = t.date;
  }

  const { data: existingRows } = await supabase
    .from('transactions')
    .select('id, date, description, amount_cents, direction')
    .eq('bank_account_id', bankAccountId)
    .gte('date', minDate)
    .lte('date', maxDate);

  type ExistingRow = {
    id: string;
    date: string;
    description: string;
    amount_cents: number;
    direction: 'money_in' | 'money_out';
  };

  // Bucket existing rows by date+amount+direction for fast lookup.
  const existingByKey = new Map<string, ExistingRow[]>();
  for (const row of (existingRows ?? []) as ExistingRow[]) {
    const key = `${row.date}|${row.amount_cents}|${row.direction}`;
    const list = existingByKey.get(key);
    if (list) list.push(row);
    else existingByKey.set(key, [row]);
  }

  const duplicates: DuplicateInfo[] = [];
  for (const t of transactions) {
    const key = `${t.date}|${t.amount_cents}|${t.direction}`;
    const candidates = existingByKey.get(key);
    if (candidates && candidates.length > 0) {
      const match = candidates[0];
      duplicates.push({
        client_id: t.client_id,
        matched_transaction_id: match.id,
        matched_description: match.description,
      });
    }
  }

  return NextResponse.json({
    data: {
      source,
      bank_account: {
        id: bankAccount.id,
        name: bankAccount.name,
        type: bankAccount.type,
      },
      transactions,
      duplicates,
      skipped,
      date_range: { start: minDate, end: maxDate },
    },
  });
}

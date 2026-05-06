import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  parseCSV,
  detectColumns,
  parseCsvDate,
  parseCsvAmountCents,
} from '@/lib/csv/parse';
import { normalizeVendor } from '@/lib/utils/normalizeVendor';
import { findMatchingRule } from '@/lib/transactions/applyRules';
import type {
  CategorizationRule,
  TransactionDirection,
} from '@/lib/types';

/**
 * POST /api/transactions/import
 * FormData fields:
 *   - file: the CSV file
 *   - bank_account_id: which bank account these transactions belong to
 *
 * Auto-detects columns and inserts rows. Categorization rules are applied
 * during the insert so matched rows land already categorized.
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
    return NextResponse.json({ error: 'Please pick a CSV file.' }, { status: 400 });
  }
  if (typeof bankAccountId !== 'string' || !bankAccountId) {
    return NextResponse.json(
      { error: 'Pick which bank account these belong to.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Confirm the bank account exists (and via RLS, belongs to this org).
  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('id, type')
    .eq('id', bankAccountId)
    .maybeSingle();
  if (!bankAccount) {
    return NextResponse.json(
      { error: "We couldn't find that bank account." },
      { status: 400 }
    );
  }

  // Read the file as text.
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "We couldn't find any rows in that CSV." },
      { status: 400 }
    );
  }

  const headers = rows[0];
  const cols = detectColumns(headers);
  if (!cols) {
    return NextResponse.json(
      {
        error:
          "We couldn't read the columns. Make sure your CSV has Date, Description, and Amount (or Debit/Credit) columns.",
      },
      { status: 400 }
    );
  }

  // Pull rules once for the whole import.
  const { data: rulesData } = await supabase
    .from('categorization_rules')
    .select('*')
    .eq('is_active', true);
  const rules = (rulesData as CategorizationRule[]) ?? [];

  interface InsertRow {
    organization_id: string;
    bank_account_id: string;
    date: string;
    description: string;
    vendor_normalized: string;
    amount_cents: number;
    direction: TransactionDirection;
    status: 'uncategorized' | 'categorized';
    account_id: string | null;
    is_tax_deductible: boolean;
    applied_rule_id: string | null;
    source: 'csv_import';
  }

  const inserts: InsertRow[] = [];
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
    let direction: TransactionDirection = 'money_out';

    if (cols.amount !== undefined) {
      const raw = parseCsvAmountCents(row[cols.amount] ?? '');
      if (raw === 0) {
        skipped++;
        continue;
      }
      // For credit cards, banks usually show purchases as positive and
      // payments as negative — flip so positive = money owed = money_out.
      const flipped = bankAccount.type === 'credit_card' ? -raw : raw;
      direction = flipped >= 0 ? 'money_in' : 'money_out';
      amountCents = Math.abs(flipped);
    } else {
      const debitCents =
        cols.debit !== undefined
          ? parseCsvAmountCents(row[cols.debit] ?? '')
          : 0;
      const creditCents =
        cols.credit !== undefined
          ? parseCsvAmountCents(row[cols.credit] ?? '')
          : 0;
      if (debitCents !== 0) {
        direction = 'money_out';
        amountCents = Math.abs(debitCents);
      } else if (creditCents !== 0) {
        direction = 'money_in';
        amountCents = Math.abs(creditCents);
      } else {
        skipped++;
        continue;
      }
    }

    const vendorNormalized = normalizeVendor(description);
    const ruleMatch = findMatchingRule(
      { description, vendor_normalized: vendorNormalized },
      rules
    );

    inserts.push({
      organization_id: ctx.organizationId,
      bank_account_id: bankAccountId,
      date,
      description,
      vendor_normalized: vendorNormalized,
      amount_cents: amountCents,
      direction,
      status: ruleMatch ? 'categorized' : 'uncategorized',
      account_id: ruleMatch?.account_id ?? null,
      is_tax_deductible: ruleMatch?.is_tax_deductible ?? false,
      applied_rule_id: ruleMatch?.applied_rule_id ?? null,
      source: 'csv_import',
    });
  }

  if (inserts.length === 0) {
    return NextResponse.json(
      {
        error: skipped
          ? "We couldn't read any usable rows. Check the date and amount columns?"
          : 'No transactions found in that CSV.',
      },
      { status: 400 }
    );
  }

  const { error: insertError } = await supabase
    .from('transactions')
    .insert(inserts);
  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  const categorizedCount = inserts.filter(
    (i) => i.status === 'categorized'
  ).length;

  return NextResponse.json({
    data: {
      imported: inserts.length,
      auto_categorized: categorizedCount,
      uncategorized: inserts.length - categorizedCount,
      skipped,
    },
  });
}

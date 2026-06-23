import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { normalizeVendor } from '@/lib/utils/normalizeVendor';
import { findMatchingRule } from '@/lib/transactions/applyRules';
import type {
  CategorizationRule,
  TransactionDirection,
} from '@/lib/types';

interface IncomingTransaction {
  date: string;
  description: string;
  amount_cents: number;
  direction: TransactionDirection;
}

interface ImportBody {
  bank_account_id?: string;
  transactions?: IncomingTransaction[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/transactions/import
 * JSON body:
 *   - bank_account_id: which bank account these belong to
 *   - transactions: the list the user confirmed in the review step
 *
 * Inserts the rows and applies categorization rules. This endpoint is
 * called *after* `/api/transactions/import/parse` and the user's review.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json(
      { error: 'Upload failed — please try again.' },
      { status: 400 }
    );
  }

  const bankAccountId = body.bank_account_id;
  const transactions = body.transactions;

  if (typeof bankAccountId !== 'string' || !bankAccountId) {
    return NextResponse.json(
      { error: 'Pick which bank account these belong to.' },
      { status: 400 }
    );
  }
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json(
      { error: 'Pick at least one transaction to import.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('id', bankAccountId)
    .maybeSingle();
  if (!bankAccount) {
    return NextResponse.json(
      { error: "We couldn't find that bank account." },
      { status: 400 }
    );
  }

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

  for (const t of transactions) {
    if (
      !t ||
      typeof t.date !== 'string' ||
      !DATE_RE.test(t.date) ||
      typeof t.description !== 'string' ||
      !t.description.trim() ||
      typeof t.amount_cents !== 'number' ||
      !Number.isFinite(t.amount_cents) ||
      t.amount_cents <= 0 ||
      (t.direction !== 'money_in' && t.direction !== 'money_out')
    ) {
      continue;
    }

    const description = t.description.trim();
    const vendorNormalized = normalizeVendor(description);
    const ruleMatch = findMatchingRule(
      { description, vendor_normalized: vendorNormalized },
      rules
    );

    inserts.push({
      organization_id: ctx.organizationId,
      bank_account_id: bankAccountId,
      date: t.date,
      description,
      vendor_normalized: vendorNormalized,
      amount_cents: Math.round(t.amount_cents),
      direction: t.direction,
      status: ruleMatch ? 'categorized' : 'uncategorized',
      account_id: ruleMatch?.account_id ?? null,
      is_tax_deductible: ruleMatch?.is_tax_deductible ?? false,
      applied_rule_id: ruleMatch?.applied_rule_id ?? null,
      source: 'csv_import',
    });
  }

  if (inserts.length === 0) {
    return NextResponse.json(
      { error: 'None of those rows looked like valid transactions.' },
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
      skipped: 0,
    },
  });
}

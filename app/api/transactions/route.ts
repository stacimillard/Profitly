import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { normalizeVendor } from '@/lib/utils/normalizeVendor';
import { findMatchingRule } from '@/lib/transactions/applyRules';
import type {
  CategorizationRule,
  TransactionDirection,
  TransactionStatus,
} from '@/lib/types';

interface CreateTransactionBody {
  date?: string;
  description?: string;
  amount_cents?: number;
  direction?: TransactionDirection;
  bank_account_id?: string | null;
  account_id?: string | null;
  is_tax_deductible?: boolean;
  gst_hst_amount_cents?: number;
  notes?: string | null;
}

/**
 * GET /api/transactions
 * Filters: ?status=uncategorized|categorized|reconciled
 *          ?bank_account=<uuid>
 *          ?limit=<n> (default 200, max 1000)
 */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get('status') as TransactionStatus | null;
  const bankAccountId = params.get('bank_account');
  const limit = Math.min(parseInt(params.get('limit') ?? '200', 10) || 200, 1000);

  const supabase = await createClient();
  let query = supabase
    .from('transactions')
    .select(
      '*, accounts:account_id(name, type), bank_accounts:bank_account_id(name, last_four)'
    );

  if (status) query = query.eq('status', status);
  if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);

  query = query
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/**
 * POST /api/transactions
 * Body: { date, description, amount_cents, direction, bank_account_id?,
 *         account_id?, is_tax_deductible?, gst_hst_amount_cents?, notes? }
 *
 * If account_id is omitted, runs categorization rules to try to auto-pick one.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: CreateTransactionBody;
  try {
    body = (await request.json()) as CreateTransactionBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const date = body.date?.trim();
  const description = body.description?.trim();
  const amountCents = Number(body.amount_cents);
  const direction = body.direction;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Please pick a valid date.' },
      { status: 400 }
    );
  }
  if (!description) {
    return NextResponse.json(
      { error: 'Please give the transaction a description.' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json(
      { error: 'Amount needs to be greater than zero.' },
      { status: 400 }
    );
  }
  if (direction !== 'money_in' && direction !== 'money_out') {
    return NextResponse.json(
      { error: 'Direction must be money_in or money_out.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const vendorNormalized = normalizeVendor(description);

  let accountId = body.account_id ?? null;
  let isTaxDeductible = !!body.is_tax_deductible;
  let appliedRuleId: string | null = null;

  // If no category was set explicitly, try the categorization rules.
  if (!accountId) {
    const { data: rules } = await supabase
      .from('categorization_rules')
      .select('*')
      .eq('is_active', true);
    const match = findMatchingRule(
      { description, vendor_normalized: vendorNormalized },
      (rules as CategorizationRule[]) ?? []
    );
    if (match) {
      accountId = match.account_id;
      isTaxDeductible = match.is_tax_deductible;
      appliedRuleId = match.applied_rule_id;
    }
  }

  const status: TransactionStatus = accountId ? 'categorized' : 'uncategorized';

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      organization_id: ctx.organizationId,
      date,
      description,
      vendor_normalized: vendorNormalized,
      amount_cents: Math.round(amountCents),
      direction,
      bank_account_id: body.bank_account_id ?? null,
      account_id: accountId,
      status,
      is_tax_deductible: isTaxDeductible,
      gst_hst_amount_cents: Number.isFinite(body.gst_hst_amount_cents)
        ? Math.round(Number(body.gst_hst_amount_cents))
        : 0,
      notes: body.notes ?? null,
      source: 'manual',
      applied_rule_id: appliedRuleId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Bump the rule's "times applied" counter (best-effort, fire and forget).
  if (appliedRuleId) {
    const { data: current } = await supabase
      .from('categorization_rules')
      .select('times_applied')
      .eq('id', appliedRuleId)
      .maybeSingle();
    if (current) {
      await supabase
        .from('categorization_rules')
        .update({ times_applied: current.times_applied + 1 })
        .eq('id', appliedRuleId);
    }
  }

  return NextResponse.json({ data });
}

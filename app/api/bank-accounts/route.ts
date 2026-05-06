import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import type { BankAccountType } from '@/lib/types';

const ALLOWED_TYPES: BankAccountType[] = [
  'chequing',
  'savings',
  'credit_card',
];

/**
 * Default chart-of-accounts name we link a new bank account to.
 * Mirrors the names seeded by lib/data/defaultAccounts.ts.
 */
const TYPE_TO_DEFAULT_ACCOUNT_NAME: Record<BankAccountType, string> = {
  chequing: 'Chequing Account',
  savings: 'Savings Account',
  credit_card: 'Credit Card Payable',
};

interface CreateBankAccountBody {
  name?: string;
  type?: string;
  institution?: string | null;
  last_four?: string | null;
  current_balance_cents?: number;
}

/** GET /api/bank-accounts — list active bank accounts. */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const includeInactive =
    request.nextUrl.searchParams.get('include_inactive') === 'true';

  const supabase = await createClient();
  let query = supabase.from('bank_accounts').select('*');
  if (!includeInactive) query = query.eq('is_active', true);
  query = query
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** POST /api/bank-accounts — create new bank account. */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: CreateBankAccountBody;
  try {
    body = (await request.json()) as CreateBankAccountBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const name = body.name?.trim();
  const type = body.type as BankAccountType | undefined;
  const institution = body.institution?.toString().trim() || null;
  const lastFourRaw = body.last_four?.toString().trim() || null;
  const balanceCents = Number.isFinite(body.current_balance_cents)
    ? Math.round(Number(body.current_balance_cents))
    : 0;

  if (!name) {
    return NextResponse.json(
      { error: 'Please give the bank account a name.' },
      { status: 400 }
    );
  }
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'Pick a valid account type.' },
      { status: 400 }
    );
  }
  if (lastFourRaw && !/^\d{4}$/.test(lastFourRaw)) {
    return NextResponse.json(
      { error: 'Last four needs to be exactly four digits.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Find the matching chart-of-accounts entry to link to.
  const { data: chartAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('name', TYPE_TO_DEFAULT_ACCOUNT_NAME[type])
    .eq('is_active', true)
    .maybeSingle();

  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({
      organization_id: ctx.organizationId,
      account_id: chartAccount?.id ?? null,
      name,
      type,
      institution,
      last_four: lastFourRaw,
      current_balance_cents: balanceCents,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

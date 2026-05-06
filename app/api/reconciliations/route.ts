import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { dollarsToCents } from '@/lib/utils/format';

interface CreateBody {
  bank_account_id?: string;
  statement_start_date?: string;
  statement_end_date?: string;
  statement_starting_balance_cents?: number;
  statement_ending_balance_cents?: number;
  statement_starting_balance_dollars?: number | string;
  statement_ending_balance_dollars?: number | string;
}

/** GET /api/reconciliations — list, optionally filtered by status. */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status');

  const supabase = await createClient();
  let query = supabase
    .from('reconciliations')
    .select('*, bank_accounts:bank_account_id(name, type, last_four)');

  if (status === 'in_progress' || status === 'completed') {
    query = query.eq('status', status);
  }

  query = query
    .order('statement_end_date', { ascending: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** POST /api/reconciliations — start a new reconciliation. */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const bankAccountId = body.bank_account_id?.trim();
  const start = body.statement_start_date?.trim();
  const end = body.statement_end_date?.trim();

  if (!bankAccountId) {
    return NextResponse.json(
      { error: 'Pick a bank account.' },
      { status: 400 }
    );
  }
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return NextResponse.json(
      { error: 'Pick a valid statement start date.' },
      { status: 400 }
    );
  }
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    return NextResponse.json(
      { error: 'End date must be on or after the start date.' },
      { status: 400 }
    );
  }

  const startingCents =
    body.statement_starting_balance_cents !== undefined &&
    Number.isFinite(body.statement_starting_balance_cents)
      ? Math.round(Number(body.statement_starting_balance_cents))
      : body.statement_starting_balance_dollars !== undefined
        ? dollarsToCents(body.statement_starting_balance_dollars)
        : 0;
  const endingCents =
    body.statement_ending_balance_cents !== undefined &&
    Number.isFinite(body.statement_ending_balance_cents)
      ? Math.round(Number(body.statement_ending_balance_cents))
      : body.statement_ending_balance_dollars !== undefined
        ? dollarsToCents(body.statement_ending_balance_dollars)
        : 0;

  const supabase = await createClient();

  // Confirm the bank account exists in this org.
  const { data: bank } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('id', bankAccountId)
    .maybeSingle();
  if (!bank) {
    return NextResponse.json(
      { error: "We couldn't find that bank account." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('reconciliations')
    .insert({
      organization_id: ctx.organizationId,
      bank_account_id: bankAccountId,
      statement_start_date: start,
      statement_end_date: end,
      statement_starting_balance_cents: startingCents,
      statement_ending_balance_cents: endingCents,
      status: 'in_progress',
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Couldn't start the reconciliation." },
      { status: 500 }
    );
  }
  return NextResponse.json({ data });
}

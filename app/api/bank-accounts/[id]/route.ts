import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateBankAccountBody {
  name?: string;
  institution?: string | null;
  last_four?: string | null;
  current_balance_cents?: number;
  is_active?: boolean;
}

/** GET /api/bank-accounts/[id] */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Bank account not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ data });
}

/** PATCH /api/bank-accounts/[id] — update name/institution/last_four/balance/is_active. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  let body: UpdateBankAccountBody;
  try {
    body = (await request.json()) as UpdateBankAccountBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: 'Name cannot be empty.' },
        { status: 400 }
      );
    }
    updates.name = name;
  }
  if ('institution' in body) {
    const inst =
      typeof body.institution === 'string' ? body.institution.trim() : null;
    updates.institution = inst || null;
  }
  if ('last_four' in body) {
    const raw =
      typeof body.last_four === 'string' ? body.last_four.trim() : null;
    if (raw && !/^\d{4}$/.test(raw)) {
      return NextResponse.json(
        { error: 'Last four needs to be exactly four digits.' },
        { status: 400 }
      );
    }
    updates.last_four = raw || null;
  }
  if (Number.isFinite(body.current_balance_cents)) {
    updates.current_balance_cents = Math.round(
      Number(body.current_balance_cents)
    );
  }
  if (typeof body.is_active === 'boolean') {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No changes provided.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Bank account not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ data });
}

/** DELETE /api/bank-accounts/[id] — soft-delete (is_active=false). */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Bank account not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ data });
}

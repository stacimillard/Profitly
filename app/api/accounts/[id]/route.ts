import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateAccountBody {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

/** GET /api/accounts/[id] */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/**
 * PATCH /api/accounts/[id]
 * Updates name, description, and/or is_active. Type is fixed at create time.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  let body: UpdateAccountBody;
  try {
    body = (await request.json()) as UpdateAccountBody;
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
  if ('description' in body) {
    const desc =
      typeof body.description === 'string' ? body.description.trim() : null;
    updates.description = desc || null;
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
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You already have an account with that name.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/**
 * DELETE /api/accounts/[id]
 * Soft-delete: marks the account inactive. Transactions stay attached so
 * historical reports remain accurate. Reactivate with PATCH { is_active: true }.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

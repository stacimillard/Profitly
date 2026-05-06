import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import type { AccountType } from '@/lib/types';

const ALLOWED_TYPES: AccountType[] = [
  'revenue',
  'cost_of_goods',
  'expense',
  'asset',
  'liability',
  'equity',
];

interface CreateAccountBody {
  name?: string;
  type?: string;
  description?: string | null;
}

/**
 * GET /api/accounts
 * Returns the org's chart of accounts. Active only by default;
 * pass ?include_inactive=true to also include deactivated accounts.
 */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const includeInactive =
    request.nextUrl.searchParams.get('include_inactive') === 'true';

  const supabase = await createClient();
  let query = supabase.from('accounts').select('*');
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

/**
 * POST /api/accounts
 * Creates a custom (non-default) account.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: CreateAccountBody;
  try {
    body = (await request.json()) as CreateAccountBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const name = body.name?.trim();
  const type = body.type as AccountType | undefined;
  const description = body.description?.toString().trim() || null;

  if (!name) {
    return NextResponse.json(
      { error: 'Please give the account a name.' },
      { status: 400 }
    );
  }
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'Pick a valid account type.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      organization_id: ctx.organizationId,
      name,
      type,
      description,
      is_default: false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You already have an account with that name.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface BulkCategorizeBody {
  ids?: string[];
  account_id?: string | null;
  is_tax_deductible?: boolean;
}

/**
 * POST /api/transactions/bulk-categorize
 * Body: { ids: string[], account_id: string, is_tax_deductible?: boolean }
 * Sets the same category on many transactions at once.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: BulkCategorizeBody;
  try {
    body = (await request.json()) as BulkCategorizeBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const ids = body.ids;
  const accountId = body.account_id;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: 'No transactions selected.' },
      { status: 400 }
    );
  }
  if (!accountId) {
    return NextResponse.json(
      { error: 'Pick a category first.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    account_id: accountId,
    status: 'categorized',
  };
  if (typeof body.is_tax_deductible === 'boolean') {
    updates.is_tax_deductible = body.is_tax_deductible;
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .in('id', ids)
    .neq('status', 'reconciled')
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { count: data?.length ?? 0 } });
}

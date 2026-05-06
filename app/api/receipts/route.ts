import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

/** GET /api/receipts — list receipts (?status=matched|unmatched optional). */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status');

  const supabase = await createClient();
  let query = supabase
    .from('receipts')
    .select(
      '*, transactions:transaction_id(id, date, description, amount_cents, direction)'
    );
  if (status === 'matched' || status === 'unmatched') {
    query = query.eq('status', status);
  }
  query = query
    .order('receipt_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

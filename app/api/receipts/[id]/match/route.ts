import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface MatchBody {
  transaction_id?: string;
}

/** POST /api/receipts/[id]/match — link receipt to a transaction. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  let body: MatchBody;
  try {
    body = (await request.json()) as MatchBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const transactionId = body.transaction_id?.toString().trim();
  if (!transactionId) {
    return NextResponse.json(
      { error: 'Pick a transaction to match this receipt to.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Confirm the transaction exists in this org (RLS handles tenancy).
  const { data: txn } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) {
    return NextResponse.json(
      { error: "We couldn't find that transaction." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('receipts')
    .update({ transaction_id: transactionId, status: 'matched' })
    .eq('id', id)
    .select(
      '*, transactions:transaction_id(id, date, description, amount_cents, direction)'
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** DELETE /api/receipts/[id]/match — unmatch the receipt. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('receipts')
    .update({ transaction_id: null, status: 'unmatched' })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

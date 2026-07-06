import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface MarkPaidBody {
  account_id?: string;
  bank_account_id?: string | null;
  paid_date?: string;
}

/**
 * POST /api/bills/[id]/mark-paid
 * Marks a bill paid AND creates a money_out transaction against the chosen
 * expense/liability account. Mirrors how invoices are marked paid.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  let body: MarkPaidBody;
  try {
    body = (await request.json()) as MarkPaidBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const accountId = body.account_id?.trim();
  if (!accountId) {
    return NextResponse.json(
      { error: 'Pick a category so we know how to record this.' },
      { status: 400 }
    );
  }

  const paidDate =
    body.paid_date && /^\d{4}-\d{2}-\d{2}$/.test(body.paid_date)
      ? body.paid_date
      : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  const { data: bill } = await supabase
    .from('bills')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!bill) {
    return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
  }
  if (bill.status === 'paid') {
    return NextResponse.json(
      { error: "That bill is already marked paid." },
      { status: 400 }
    );
  }
  if (bill.status === 'void') {
    return NextResponse.json(
      { error: "Voided bills can't be marked paid." },
      { status: 400 }
    );
  }

  // Confirm the chosen account exists and is a plausible category (expense
  // or cost of goods — most bills — but allow assets/liabilities too).
  const { data: account } = await supabase
    .from('accounts')
    .select('id, type')
    .eq('id', accountId)
    .maybeSingle();
  if (!account) {
    return NextResponse.json(
      { error: "We couldn't find that account." },
      { status: 400 }
    );
  }

  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .insert({
      organization_id: ctx.organizationId,
      bank_account_id: body.bank_account_id ?? null,
      account_id: accountId,
      date: paidDate,
      description: `Bill — ${bill.vendor_name}`,
      amount_cents: bill.amount_cents,
      direction: 'money_out',
      status: 'categorized',
      source: 'manual',
      notes: bill.notes,
    })
    .select()
    .single();

  if (txnError || !txn) {
    return NextResponse.json(
      { error: txnError?.message || "Couldn't record the payment." },
      { status: 500 }
    );
  }

  const { data: updatedBill, error: updateError } = await supabase
    .from('bills')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_transaction_id: txn.id,
      account_id: accountId,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError || !updatedBill) {
    await supabase.from('transactions').delete().eq('id', txn.id);
    return NextResponse.json(
      { error: updateError?.message || "Couldn't mark the bill paid." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { bill: updatedBill, transaction: txn },
  });
}

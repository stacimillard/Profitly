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
 * POST /api/invoices/[id]/mark-paid
 * Marks the invoice paid AND creates a money_in transaction for the
 * total amount. Body supplies which revenue account to record against
 * and (optionally) which bank account got the deposit.
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
      { error: 'Pick a revenue account so we know where to record this.' },
      { status: 400 }
    );
  }

  const paidDate =
    body.paid_date && /^\d{4}-\d{2}-\d{2}$/.test(body.paid_date)
      ? body.paid_date
      : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }
  if (invoice.status === 'paid') {
    return NextResponse.json(
      { error: "That invoice is already marked paid." },
      { status: 400 }
    );
  }
  if (invoice.status === 'void') {
    return NextResponse.json(
      { error: "Voided invoices can't be marked paid." },
      { status: 400 }
    );
  }

  // Confirm the chosen account is a revenue account.
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
  if (account.type !== 'revenue') {
    return NextResponse.json(
      { error: 'Pick a revenue account for the income.' },
      { status: 400 }
    );
  }

  // Create the money_in transaction.
  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .insert({
      organization_id: ctx.organizationId,
      bank_account_id: body.bank_account_id ?? null,
      account_id: accountId,
      date: paidDate,
      description: `Invoice ${invoice.invoice_number} — ${invoice.customer_name}`,
      amount_cents: invoice.total_cents,
      direction: 'money_in',
      status: 'categorized',
      source: 'invoice',
    })
    .select()
    .single();

  if (txnError || !txn) {
    return NextResponse.json(
      { error: txnError?.message || "Couldn't record the income." },
      { status: 500 }
    );
  }

  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_transaction_id: txn.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError || !updatedInvoice) {
    // Roll back the transaction since the invoice update failed.
    await supabase.from('transactions').delete().eq('id', txn.id);
    return NextResponse.json(
      { error: updateError?.message || "Couldn't mark the invoice paid." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { invoice: updatedInvoice, transaction: txn },
  });
}

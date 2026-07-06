import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { nextInvoiceNumber } from '@/lib/invoices/numbering';

interface LineItemInput {
  description?: string;
  quantity?: number;
  unit_price_cents?: number;
  account_id?: string | null;
}

interface CreateBody {
  invoice_number?: string;
  customer_name?: string;
  customer_email?: string | null;
  customer_address?: string | null;
  issue_date?: string;
  due_date?: string;
  gst_hst_rate?: number;
  notes?: string | null;
  items?: LineItemInput[];
}

/** GET /api/invoices — list. */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status');

  const supabase = await createClient();
  let query = supabase.from('invoices').select('*');
  if (status) query = query.eq('status', status);
  query = query
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** POST /api/invoices — create draft invoice with line items. */
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

  const customerName = body.customer_name?.trim();
  const issueDate = body.issue_date?.trim();
  const dueDate = body.due_date?.trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName) {
    return NextResponse.json(
      { error: "Who's this invoice for?" },
      { status: 400 }
    );
  }
  if (!issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
    return NextResponse.json(
      { error: 'Pick a valid issue date.' },
      { status: 400 }
    );
  }
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json(
      { error: 'Pick a valid due date.' },
      { status: 400 }
    );
  }
  if (items.length === 0) {
    return NextResponse.json(
      { error: 'Add at least one line item.' },
      { status: 400 }
    );
  }

  // Compute totals.
  let subtotal = 0;
  const cleanItems: {
    description: string;
    quantity: number;
    unit_price_cents: number;
    amount_cents: number;
    account_id: string | null;
  }[] = [];

  for (const it of items) {
    const desc = it.description?.toString().trim();
    const qty = Number.isFinite(it.quantity) ? Number(it.quantity) : 0;
    const unitCents = Number.isFinite(it.unit_price_cents)
      ? Math.round(Number(it.unit_price_cents))
      : 0;
    if (!desc) continue;
    const amountCents = Math.round(qty * unitCents);
    subtotal += amountCents;
    cleanItems.push({
      description: desc,
      quantity: qty,
      unit_price_cents: unitCents,
      amount_cents: amountCents,
      account_id: it.account_id ?? null,
    });
  }

  if (cleanItems.length === 0) {
    return NextResponse.json(
      { error: 'Each line item needs a description.' },
      { status: 400 }
    );
  }

  const taxRate = Number.isFinite(body.gst_hst_rate)
    ? Math.max(0, Number(body.gst_hst_rate))
    : 0;
  const taxCents = Math.round(subtotal * taxRate);
  const totalCents = subtotal + taxCents;

  const supabase = await createClient();

  // Use the supplied invoice number, or auto-generate one.
  let invoiceNumber = body.invoice_number?.trim();
  if (!invoiceNumber) {
    invoiceNumber = await nextInvoiceNumber(supabase);
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      organization_id: ctx.organizationId,
      invoice_number: invoiceNumber,
      customer_name: customerName,
      customer_email: body.customer_email?.trim() || null,
      customer_address: body.customer_address?.trim() || null,
      issue_date: issueDate,
      due_date: dueDate,
      status: 'draft',
      subtotal_cents: subtotal,
      gst_hst_rate: taxRate,
      gst_hst_amount_cents: taxCents,
      total_cents: totalCents,
      notes: body.notes?.trim() || null,
    })
    .select()
    .single();

  if (invoiceError || !invoice) {
    if (invoiceError?.code === '23505') {
      return NextResponse.json(
        { error: 'That invoice number is already in use.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: invoiceError?.message || "Couldn't create the invoice." },
      { status: 500 }
    );
  }

  const itemRows = cleanItems.map((it, idx) => ({
    organization_id: ctx.organizationId,
    invoice_id: invoice.id,
    description: it.description,
    quantity: it.quantity,
    unit_price_cents: it.unit_price_cents,
    amount_cents: it.amount_cents,
    account_id: it.account_id,
    sort_order: idx,
  }));

  const { error: itemsError } = await supabase
    .from('invoice_line_items')
    .insert(itemRows);

  if (itemsError) {
    // Roll back the invoice so we don't leave it without items.
    await supabase.from('invoices').delete().eq('id', invoice.id);
    return NextResponse.json(
      { error: itemsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: invoice });
}

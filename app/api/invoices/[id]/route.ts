import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import type { InvoiceStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateBody {
  status?: InvoiceStatus;
  customer_name?: string;
  customer_email?: string | null;
  customer_address?: string | null;
  notes?: string | null;
  due_date?: string;
}

/** GET /api/invoices/[id] — invoice + line items + paid transaction. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const { data: items } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });

  return NextResponse.json({
    data: { invoice, items: items ?? [] },
  });
}

/** PATCH /api/invoices/[id] — limited updates (status, customer details, notes). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (body.status === 'sent' || body.status === 'overdue' || body.status === 'void') {
    updates.status = body.status;
    if (body.status === 'sent') updates.sent_at = new Date().toISOString();
  }
  if (typeof body.customer_name === 'string') {
    const v = body.customer_name.trim();
    if (!v) {
      return NextResponse.json(
        { error: "Customer name can't be empty." },
        { status: 400 }
      );
    }
    updates.customer_name = v;
  }
  if ('customer_email' in body) {
    const v = typeof body.customer_email === 'string' ? body.customer_email.trim() : null;
    updates.customer_email = v || null;
  }
  if ('customer_address' in body) {
    const v = typeof body.customer_address === 'string' ? body.customer_address.trim() : null;
    updates.customer_address = v || null;
  }
  if ('notes' in body) {
    const v = typeof body.notes === 'string' ? body.notes.trim() : null;
    updates.notes = v || null;
  }
  if (typeof body.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
    updates.due_date = body.due_date;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No changes provided.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** DELETE /api/invoices/[id] — only allowed for drafts. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }
  if (invoice.status !== 'draft') {
    return NextResponse.json(
      {
        error:
          "Sent or paid invoices can't be deleted — mark them void instead.",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import type { BillStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateBody {
  vendor_name?: string;
  bill_date?: string;
  due_date?: string;
  amount_cents?: number;
  account_id?: string | null;
  notes?: string | null;
  status?: BillStatus;
}

/** GET /api/bills/[id]. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** PATCH /api/bills/[id] — limited updates while unpaid. */
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
  if (body.status === 'void') updates.status = 'void';
  if (typeof body.vendor_name === 'string') {
    const v = body.vendor_name.trim();
    if (!v) {
      return NextResponse.json(
        { error: "Vendor name can't be empty." },
        { status: 400 }
      );
    }
    updates.vendor_name = v;
  }
  if (
    typeof body.bill_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.bill_date)
  ) {
    updates.bill_date = body.bill_date;
  }
  if (
    typeof body.due_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.due_date)
  ) {
    updates.due_date = body.due_date;
  }
  if (Number.isFinite(body.amount_cents)) {
    updates.amount_cents = Math.round(Number(body.amount_cents));
  }
  if ('account_id' in body) {
    updates.account_id = body.account_id?.trim() || null;
  }
  if ('notes' in body) {
    const v = typeof body.notes === 'string' ? body.notes.trim() : null;
    updates.notes = v || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No changes provided.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bills')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** DELETE /api/bills/[id]. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data: bill } = await supabase
    .from('bills')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (!bill) {
    return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
  }
  if (bill.status === 'paid') {
    return NextResponse.json(
      { error: "Paid bills can't be deleted — the transaction is on the books." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}

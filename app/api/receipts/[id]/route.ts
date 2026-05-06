import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateBody {
  vendor?: string | null;
  receipt_date?: string | null;
  amount_cents?: number | null;
  gst_hst_amount_cents?: number;
  notes?: string | null;
}

/** GET /api/receipts/[id] */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('receipts')
    .select(
      '*, transactions:transaction_id(id, date, description, amount_cents, direction)'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** PATCH /api/receipts/[id] — update metadata (vendor, date, amount, notes). */
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
  if ('vendor' in body) {
    const v = typeof body.vendor === 'string' ? body.vendor.trim() : null;
    updates.vendor = v || null;
  }
  if ('receipt_date' in body) {
    const d =
      typeof body.receipt_date === 'string' ? body.receipt_date.trim() : null;
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return NextResponse.json(
        { error: 'Pick a valid date.' },
        { status: 400 }
      );
    }
    updates.receipt_date = d || null;
  }
  if ('amount_cents' in body) {
    if (body.amount_cents === null) {
      updates.amount_cents = null;
    } else if (Number.isFinite(body.amount_cents)) {
      updates.amount_cents = Math.round(Number(body.amount_cents));
    }
  }
  if (Number.isFinite(body.gst_hst_amount_cents)) {
    updates.gst_hst_amount_cents = Math.round(
      Number(body.gst_hst_amount_cents)
    );
  }
  if ('notes' in body) {
    const n = typeof body.notes === 'string' ? body.notes.trim() : null;
    updates.notes = n || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No changes provided.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('receipts')
    .update(updates)
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

/** DELETE /api/receipts/[id] — also removes the file from storage. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from('receipts')
    .select('id, file_url')
    .eq('id', id)
    .maybeSingle();

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
  }

  // Remove the file from storage first (best-effort).
  if (receipt.file_url) {
    await supabase.storage.from('receipts').remove([receipt.file_url]);
  }

  const { error } = await supabase.from('receipts').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}

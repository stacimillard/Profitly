import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { normalizeVendor } from '@/lib/utils/normalizeVendor';
import type {
  TransactionDirection,
  TransactionStatus,
} from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateTransactionBody {
  date?: string;
  description?: string;
  amount_cents?: number;
  direction?: TransactionDirection;
  bank_account_id?: string | null;
  account_id?: string | null;
  is_tax_deductible?: boolean;
  gst_hst_amount_cents?: number;
  notes?: string | null;
  status?: TransactionStatus;
}

/** GET /api/transactions/[id] */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      '*, accounts:account_id(name, type), bank_accounts:bank_account_id(name, last_four)'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Transaction not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ data });
}

/** PATCH /api/transactions/[id] — update fields. Refuses if month is closed. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  let body: UpdateTransactionBody;
  try {
    body = (await request.json()) as UpdateTransactionBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Look up current transaction so we can check closed-month + auto-status.
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, date, status, account_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: 'Transaction not found.' },
      { status: 404 }
    );
  }

  // Block edits in a closed month (unless reopening).
  const dateForCheck = body.date ?? existing.date;
  const [yearStr, monthStr] = dateForCheck.split('-');
  const { data: closed } = await supabase
    .from('closed_months')
    .select('id')
    .eq('year', parseInt(yearStr, 10))
    .eq('month', parseInt(monthStr, 10))
    .maybeSingle();
  if (closed) {
    return NextResponse.json(
      {
        error:
          "That month is closed — reopen it from Month-end close to make changes.",
      },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    updates.date = body.date;
  }
  if (typeof body.description === 'string') {
    const desc = body.description.trim();
    if (!desc) {
      return NextResponse.json(
        { error: 'Description cannot be empty.' },
        { status: 400 }
      );
    }
    updates.description = desc;
    updates.vendor_normalized = normalizeVendor(desc);
  }
  if (Number.isFinite(body.amount_cents)) {
    updates.amount_cents = Math.round(Number(body.amount_cents));
  }
  if (body.direction === 'money_in' || body.direction === 'money_out') {
    updates.direction = body.direction;
  }
  if ('bank_account_id' in body) {
    updates.bank_account_id = body.bank_account_id ?? null;
  }
  if ('account_id' in body) {
    updates.account_id = body.account_id ?? null;
    // Auto-flip status when assigning/clearing a category, unless already reconciled.
    if (existing.status !== 'reconciled') {
      updates.status = body.account_id ? 'categorized' : 'uncategorized';
    }
  }
  if (typeof body.is_tax_deductible === 'boolean') {
    updates.is_tax_deductible = body.is_tax_deductible;
  }
  if (Number.isFinite(body.gst_hst_amount_cents)) {
    updates.gst_hst_amount_cents = Math.round(
      Number(body.gst_hst_amount_cents)
    );
  }
  if ('notes' in body) {
    updates.notes = body.notes ?? null;
  }
  if (
    body.status === 'uncategorized' ||
    body.status === 'categorized' ||
    body.status === 'reconciled'
  ) {
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No changes provided.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select(
      '*, accounts:account_id(name, type), bank_accounts:bank_account_id(name, last_four)'
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Transaction not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ data });
}

/** DELETE /api/transactions/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();

  // Block deletes in a closed month.
  const { data: existing } = await supabase
    .from('transactions')
    .select('date')
    .eq('id', id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json(
      { error: 'Transaction not found.' },
      { status: 404 }
    );
  }
  const [yearStr, monthStr] = existing.date.split('-');
  const { data: closed } = await supabase
    .from('closed_months')
    .select('id')
    .eq('year', parseInt(yearStr, 10))
    .eq('month', parseInt(monthStr, 10))
    .maybeSingle();
  if (closed) {
    return NextResponse.json(
      { error: 'That month is closed — reopen it before deleting.' },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}

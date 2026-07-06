import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface CreateBody {
  vendor_name?: string;
  bill_date?: string;
  due_date?: string;
  amount_cents?: number;
  account_id?: string | null;
  notes?: string | null;
}

/** GET /api/bills — list all bills, unpaid first, sorted by due date. */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status');
  const supabase = await createClient();
  let query = supabase.from('bills').select('*');
  if (status) query = query.eq('status', status);
  query = query
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** POST /api/bills — create new unpaid bill. */
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

  const vendor = body.vendor_name?.trim();
  const billDate = body.bill_date?.trim();
  const dueDate = body.due_date?.trim();
  const amount = Number.isFinite(body.amount_cents)
    ? Math.round(Number(body.amount_cents))
    : 0;

  if (!vendor) {
    return NextResponse.json(
      { error: "Who's this bill from?" },
      { status: 400 }
    );
  }
  if (!billDate || !/^\d{4}-\d{2}-\d{2}$/.test(billDate)) {
    return NextResponse.json(
      { error: 'Pick a valid bill date.' },
      { status: 400 }
    );
  }
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json(
      { error: 'Pick a valid due date.' },
      { status: 400 }
    );
  }
  if (amount <= 0) {
    return NextResponse.json(
      { error: "How much is the bill for?" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bills')
    .insert({
      organization_id: ctx.organizationId,
      vendor_name: vendor,
      bill_date: billDate,
      due_date: dueDate,
      amount_cents: amount,
      account_id: body.account_id?.trim() || null,
      notes: body.notes?.trim() || null,
      status: 'unpaid',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

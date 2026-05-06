import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface CreateBody {
  title?: string;
  description?: string | null;
  amount_cents?: number | null;
  entry_date?: string;
}

/** GET /api/win-journal — list, newest first. */
export async function GET() {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('win_journal_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** POST /api/win-journal — save a new win. */
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

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json(
      { error: 'Give your win a title.' },
      { status: 400 }
    );
  }

  const entryDate =
    body.entry_date && /^\d{4}-\d{2}-\d{2}$/.test(body.entry_date)
      ? body.entry_date
      : new Date().toISOString().slice(0, 10);

  const description = body.description?.toString().trim() || null;
  const amountCents =
    body.amount_cents === null || body.amount_cents === undefined
      ? null
      : Number.isFinite(body.amount_cents)
        ? Math.round(Number(body.amount_cents))
        : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('win_journal_entries')
    .insert({
      organization_id: ctx.organizationId,
      profile_id: ctx.profile.id,
      title,
      description,
      amount_cents: amountCents,
      entry_date: entryDate,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

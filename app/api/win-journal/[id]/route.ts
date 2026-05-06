import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateBody {
  title?: string;
  description?: string | null;
  amount_cents?: number | null;
  entry_date?: string;
}

/** GET /api/win-journal/[id] */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('win_journal_entries')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Win not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** PATCH /api/win-journal/[id] */
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
  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (!t) {
      return NextResponse.json(
        { error: 'Title cannot be empty.' },
        { status: 400 }
      );
    }
    updates.title = t;
  }
  if ('description' in body) {
    const d = typeof body.description === 'string' ? body.description.trim() : null;
    updates.description = d || null;
  }
  if ('amount_cents' in body) {
    if (body.amount_cents === null) {
      updates.amount_cents = null;
    } else if (Number.isFinite(body.amount_cents)) {
      updates.amount_cents = Math.round(Number(body.amount_cents));
    }
  }
  if (typeof body.entry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.entry_date)) {
    updates.entry_date = body.entry_date;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No changes provided.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('win_journal_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Win not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** DELETE /api/win-journal/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase
    .from('win_journal_entries')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}

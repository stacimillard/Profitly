import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { recomputeStreakForCurrentUser } from '@/lib/monthEnd/checklist';

interface CreateBody {
  year?: number;
  month?: number;
  notes?: string | null;
}

/** GET /api/closed-months — list closed months newest first. */
export async function GET() {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('closed_months')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** POST /api/closed-months — close a month. */
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

  const year = Number(body.year);
  const month = Number(body.month);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json(
      { error: 'Pass a valid year and month (1-12).' },
      { status: 400 }
    );
  }

  // Don't let users close future months.
  const now = new Date();
  const monthLastDay = new Date(Date.UTC(year, month, 0));
  if (monthLastDay > now) {
    return NextResponse.json(
      { error: "Hold off — that month isn't over yet." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('closed_months')
    .insert({
      organization_id: ctx.organizationId,
      closed_by_profile_id: ctx.profile.id,
      year,
      month,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'That month is already closed.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const streak = await recomputeStreakForCurrentUser();

  return NextResponse.json({ data: { closed_month: data, streak } });
}

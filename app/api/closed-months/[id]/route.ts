import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { recomputeStreakForCurrentUser } from '@/lib/monthEnd/checklist';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** DELETE /api/closed-months/[id] — reopens a closed month. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('closed_months')
    .delete()
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Closed month not found.' },
      { status: 404 }
    );
  }

  const streak = await recomputeStreakForCurrentUser();
  return NextResponse.json({ data: { reopened: data, streak } });
}

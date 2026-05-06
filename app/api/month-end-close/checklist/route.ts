import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { getMonthEndChecklist } from '@/lib/monthEnd/checklist';

/** GET /api/month-end-close/checklist?year=YYYY&month=M */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const year = parseInt(params.get('year') ?? '', 10);
  const month = parseInt(params.get('month') ?? '', 10);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json(
      { error: 'Pass year and month (1-12).' },
      { status: 400 }
    );
  }

  const data = await getMonthEndChecklist(year, month);
  return NextResponse.json({ data });
}

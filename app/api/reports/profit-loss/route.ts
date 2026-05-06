import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { getProfitLoss } from '@/lib/reports/profitLoss';

/** GET /api/reports/profit-loss?start=YYYY-MM-DD&end=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const start = params.get('start') ?? '';
  const end = params.get('end') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json(
      { error: 'Pass start and end dates in YYYY-MM-DD format.' },
      { status: 400 }
    );
  }
  if (end < start) {
    return NextResponse.json(
      { error: 'End date must be on or after start date.' },
      { status: 400 }
    );
  }

  const data = await getProfitLoss(start, end);
  return NextResponse.json({ data });
}

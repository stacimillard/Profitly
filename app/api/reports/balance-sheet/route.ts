import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { getBalanceSheet } from '@/lib/reports/balanceSheet';

/** GET /api/reports/balance-sheet?as_of=YYYY-MM-DD (default today) */
export async function GET(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const asOf = request.nextUrl.searchParams.get('as_of') ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asOf)
    ? asOf
    : new Date().toISOString().slice(0, 10);

  const data = await getBalanceSheet(date);
  return NextResponse.json({ data });
}

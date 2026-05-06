import { NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { getDashboardData } from '@/lib/dashboard/queries';

/**
 * GET /api/dashboard
 * Returns KPI numbers, uncategorized count, recent transactions, recent wins.
 * Used by client-side refreshers; the dashboard page itself queries directly.
 */
export async function GET() {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const data = await getDashboardData();
  return NextResponse.json({ data });
}

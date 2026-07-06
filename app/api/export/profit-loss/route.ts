import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { getProfitLoss } from '@/lib/reports/profitLoss';
import { toCsv, centsToAmountString } from '@/lib/csv/format';

/** GET /api/export/profit-loss?start=YYYY-MM-DD&end=YYYY-MM-DD */
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

  const report = await getProfitLoss(start, end);

  const rows: (string | number | null | undefined)[][] = [];
  rows.push(['Profit & Loss']);
  rows.push([`From ${report.start_date} to ${report.end_date}`]);
  rows.push([]);
  rows.push(['Section', 'Account', 'Amount']);

  for (const line of report.revenue.lines) {
    rows.push(['Revenue', line.account_name, centsToAmountString(line.amount_cents)]);
  }
  rows.push(['Revenue', 'Total revenue', centsToAmountString(report.revenue.total_cents)]);
  rows.push([]);

  for (const line of report.cost_of_goods.lines) {
    rows.push(['Cost of goods sold', line.account_name, centsToAmountString(line.amount_cents)]);
  }
  rows.push(['Cost of goods sold', 'Total cost of goods sold', centsToAmountString(report.cost_of_goods.total_cents)]);
  rows.push([]);

  rows.push(['', 'Gross profit', centsToAmountString(report.gross_profit_cents)]);
  rows.push([]);

  for (const line of report.expense.lines) {
    rows.push(['Expenses', line.account_name, centsToAmountString(line.amount_cents)]);
  }
  rows.push(['Expenses', 'Total expenses', centsToAmountString(report.expense.total_cents)]);
  rows.push([]);

  rows.push(['', 'Net profit', centsToAmountString(report.net_profit_cents)]);

  const csv = toCsv(rows);
  const filename = `profitly-profit-loss-${start}-to-${end}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { getProfitLoss } from '@/lib/reports/profitLoss';
import { Card, CardBody } from '@/components/ui/Card';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface Props {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function ProfitLossPage({ searchParams }: Props) {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const params = await searchParams;
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const startDate = params.start ?? yearStart.toISOString().slice(0, 10);
  const endDate = params.end ?? today.toISOString().slice(0, 10);

  const report = await getProfitLoss(startDate, endDate);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to reports
        </Link>
        <h1 className="mt-2 font-heading font-bold text-3xl text-brand-ink leading-tight">
          Profit & loss
        </h1>
        <p className="mt-1 text-brand-ink/70">
          {formatDate(report.start_date)} — {formatDate(report.end_date)}
        </p>
      </div>

      <DateRangePicker startDate={startDate} endDate={endDate} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/60">Revenue</div>
            <div className="mt-1 font-heading font-bold text-2xl text-brand-ink">
              {formatCurrency(report.revenue.total_cents)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/60">Gross profit</div>
            <div
              className={`mt-1 font-heading font-bold text-2xl ${
                report.gross_profit_cents >= 0
                  ? 'text-brand-ink'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(report.gross_profit_cents)}
            </div>
            <div className="text-xs text-brand-ink/60 mt-1">
              Revenue − cost of goods
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/60">Net profit</div>
            <div
              className={`mt-1 font-heading font-bold text-2xl ${
                report.net_profit_cents >= 0
                  ? 'text-brand-teal'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(report.net_profit_cents)}
            </div>
            <div className="text-xs text-brand-ink/60 mt-1">
              {report.net_profit_cents >= 0
                ? 'What you kept this period.'
                : "You spent more than you brought in."}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            <SectionRows section={report.revenue} sign="positive" />
            {report.cost_of_goods.lines.length > 0 && (
              <SectionRows section={report.cost_of_goods} sign="negative" />
            )}
            <tr className="border-t-2 border-surface-border">
              <td className="px-5 py-3 font-semibold text-brand-ink">
                Gross profit
              </td>
              <td
                className={`px-5 py-3 text-right font-heading font-bold ${
                  report.gross_profit_cents >= 0
                    ? 'text-brand-ink'
                    : 'text-red-600'
                }`}
              >
                {formatCurrency(report.gross_profit_cents)}
              </td>
            </tr>
            <SectionRows section={report.expense} sign="negative" />
            <tr className="border-t-2 border-surface-border bg-surface-muted/40">
              <td className="px-5 py-4 font-heading font-semibold text-brand-ink">
                Net profit
              </td>
              <td
                className={`px-5 py-4 text-right font-heading font-bold text-lg ${
                  report.net_profit_cents >= 0
                    ? 'text-brand-teal'
                    : 'text-red-600'
                }`}
              >
                {formatCurrency(report.net_profit_cents)}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {report.revenue.lines.length === 0 &&
        report.cost_of_goods.lines.length === 0 &&
        report.expense.lines.length === 0 && (
          <p className="text-center text-sm text-brand-ink/60 py-6">
            No transactions in this period yet.
          </p>
        )}
    </div>
  );
}

interface SectionRowsProps {
  section: {
    label: string;
    lines: { account_id: string; account_name: string; amount_cents: number }[];
    total_cents: number;
  };
  sign: 'positive' | 'negative';
}

function SectionRows({ section, sign }: SectionRowsProps) {
  if (section.lines.length === 0) return null;
  return (
    <>
      <tr className="bg-surface-muted/40">
        <td
          colSpan={2}
          className="px-5 py-2 font-heading font-semibold text-brand-ink"
        >
          {section.label}
        </td>
      </tr>
      {section.lines.map((line) => (
        <tr key={line.account_id} className="border-b border-surface-border">
          <td className="px-5 py-2 pl-8 text-brand-ink/80">{line.account_name}</td>
          <td className="px-5 py-2 text-right text-brand-ink whitespace-nowrap">
            {sign === 'negative' ? '−' : ''}
            {formatCurrency(line.amount_cents)}
          </td>
        </tr>
      ))}
      <tr className="border-b border-surface-border">
        <td className="px-5 py-2 font-medium text-brand-ink">
          Total {section.label.toLowerCase()}
        </td>
        <td className="px-5 py-2 text-right font-semibold text-brand-ink whitespace-nowrap">
          {sign === 'negative' ? '−' : ''}
          {formatCurrency(section.total_cents)}
        </td>
      </tr>
    </>
  );
}

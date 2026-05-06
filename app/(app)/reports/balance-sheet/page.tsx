import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Landmark, CreditCard, FileText } from 'lucide-react';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { getBalanceSheet } from '@/lib/reports/balanceSheet';
import { Card, CardBody } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface Props {
  searchParams: Promise<{ as_of?: string }>;
}

export default async function BalanceSheetPage({ searchParams }: Props) {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const asOf = params.as_of ?? today;

  const report = await getBalanceSheet(asOf);

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
          Balance sheet
        </h1>
        <p className="mt-1 text-brand-ink/70">
          Snapshot as of {formatDate(report.as_of)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/60">Cash position</div>
            <div
              className={`mt-1 font-heading font-bold text-2xl ${
                report.cash_position_cents >= 0
                  ? 'text-brand-ink'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(report.cash_position_cents)}
            </div>
            <div className="text-xs text-brand-ink/60 mt-1">
              Bank balances minus credit card debt
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/60">Estimated net worth</div>
            <div
              className={`mt-1 font-heading font-bold text-2xl ${
                report.net_worth_cents >= 0
                  ? 'text-brand-teal'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(report.net_worth_cents)}
            </div>
            <div className="text-xs text-brand-ink/60 mt-1">
              Cash position + what customers owe you
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border bg-surface-muted/40">
          <h2 className="font-heading font-semibold text-brand-ink flex items-center gap-2">
            <Landmark className="h-5 w-5 text-brand-teal" aria-hidden />
            Cash on hand
          </h2>
        </div>
        {report.cash_accounts.length === 0 ? (
          <div className="px-5 py-4 text-sm text-brand-ink/60">
            Add a chequing or savings account to see your balance here.
          </div>
        ) : (
          <ul>
            {report.cash_accounts.map((row) => (
              <li
                key={row.label}
                className="flex items-center gap-3 px-5 py-3 border-b border-surface-border last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-brand-ink truncate">
                    {row.label}
                  </div>
                  {row.detail && (
                    <div className="text-xs text-brand-ink/60">
                      {row.detail}
                    </div>
                  )}
                </div>
                <div className="font-semibold text-brand-ink whitespace-nowrap">
                  {formatCurrency(row.amount_cents)}
                </div>
              </li>
            ))}
            <li className="flex items-center gap-3 px-5 py-3 bg-surface-muted/40 border-t border-surface-border">
              <div className="flex-1 font-medium text-brand-ink">
                Total cash
              </div>
              <div className="font-heading font-bold text-brand-ink">
                {formatCurrency(report.cash_total_cents)}
              </div>
            </li>
          </ul>
        )}
      </Card>

      {report.credit_card_accounts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border bg-surface-muted/40">
            <h2 className="font-heading font-semibold text-brand-ink flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-brand-orange" aria-hidden />
              Credit card balances owed
            </h2>
          </div>
          <ul>
            {report.credit_card_accounts.map((row) => (
              <li
                key={row.label}
                className="flex items-center gap-3 px-5 py-3 border-b border-surface-border last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-brand-ink truncate">
                    {row.label}
                  </div>
                  {row.detail && (
                    <div className="text-xs text-brand-ink/60">
                      {row.detail}
                    </div>
                  )}
                </div>
                <div className="font-semibold text-brand-ink whitespace-nowrap">
                  {formatCurrency(row.amount_cents)}
                </div>
              </li>
            ))}
            <li className="flex items-center gap-3 px-5 py-3 bg-surface-muted/40 border-t border-surface-border">
              <div className="flex-1 font-medium text-brand-ink">
                Total owed
              </div>
              <div className="font-heading font-bold text-brand-ink">
                {formatCurrency(report.credit_card_total_cents)}
              </div>
            </li>
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border bg-surface-muted/40">
          <h2 className="font-heading font-semibold text-brand-ink flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-purple" aria-hidden />
            Money customers owe you
          </h2>
        </div>
        <div className="px-5 py-4">
          {report.receivable_count === 0 ? (
            <p className="text-sm text-brand-ink/60">
              No outstanding invoices.
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-brand-ink">
                {report.receivable_count}{' '}
                {report.receivable_count === 1
                  ? 'open invoice'
                  : 'open invoices'}
              </span>
              <span className="font-heading font-bold text-brand-ink">
                {formatCurrency(report.receivable_total_cents)}
              </span>
            </div>
          )}
        </div>
      </Card>

      <p className="text-xs text-brand-ink/50 leading-relaxed">
        This is a simplified snapshot — Profitly tracks bank balances and
        unpaid invoices. For a full balance sheet (assets, liabilities, equity
        with double-entry depth), bring it to your accountant.
      </p>
    </div>
  );
}

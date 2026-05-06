import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { getDashboardData } from '@/lib/dashboard/queries';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function DashboardPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const data = await getDashboardData();

  const monthProfit =
    data.money_in_this_month_cents - data.money_out_this_month_cents;
  const ytdProfit = data.money_in_ytd_cents - data.money_out_ytd_cents;
  const firstName = ctx.profile.full_name?.split(' ')[0] || 'there';
  const hasMonthData =
    data.money_in_this_month_cents > 0 || data.money_out_this_month_cents > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
          Hi {firstName} — here&apos;s where you stand.
        </h1>
        <p className="mt-1 text-brand-ink/70">
          A snapshot of {data.month_label} and your year so far.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-brand-ink/70 font-medium">
                {data.month_label} profit
              </span>
              {hasMonthData && (
                <Badge variant={monthProfit >= 0 ? 'success' : 'danger'}>
                  {monthProfit >= 0 ? 'Up' : 'Down'}
                </Badge>
              )}
            </div>
            <p
              className={`mt-2 font-heading font-bold text-3xl ${
                monthProfit >= 0 ? 'text-brand-ink' : 'text-red-600'
              }`}
            >
              {formatCurrency(monthProfit)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-brand-ink/60">Money in</div>
                <div className="font-medium text-brand-ink">
                  {formatCurrency(data.money_in_this_month_cents)}
                </div>
              </div>
              <div>
                <div className="text-brand-ink/60">Money out</div>
                <div className="font-medium text-brand-ink">
                  {formatCurrency(data.money_out_this_month_cents)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <span className="text-sm text-brand-ink/70 font-medium">
              Year to date profit
            </span>
            <p
              className={`mt-2 font-heading font-bold text-3xl ${
                ytdProfit >= 0 ? 'text-brand-ink' : 'text-red-600'
              }`}
            >
              {formatCurrency(ytdProfit)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-brand-ink/60">Money in</div>
                <div className="font-medium text-brand-ink">
                  {formatCurrency(data.money_in_ytd_cents)}
                </div>
              </div>
              <div>
                <div className="text-brand-ink/60">Money out</div>
                <div className="font-medium text-brand-ink">
                  {formatCurrency(data.money_out_ytd_cents)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <span className="text-sm text-brand-ink/70 font-medium">
              Needs your attention
            </span>
            {data.uncategorized_count > 0 ? (
              <>
                <p className="mt-2 font-heading font-bold text-3xl text-brand-ink">
                  {data.uncategorized_count}
                </p>
                <p className="mt-1 text-sm text-brand-ink/60">
                  {data.uncategorized_count === 1
                    ? 'transaction needs a category'
                    : 'transactions need a category'}
                </p>
                <Link
                  href="/transactions?status=uncategorized"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:underline"
                >
                  Sort these out
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle2
                    className="h-7 w-7 text-brand-teal"
                    aria-hidden
                  />
                  <span className="font-heading font-bold text-2xl text-brand-ink">
                    All caught up
                  </span>
                </div>
                <p className="mt-2 text-sm text-brand-ink/60">
                  Every transaction has a category. Nice work.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent activity + wins */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold text-brand-ink">
                  Recent activity
                </h2>
                <Link
                  href="/transactions"
                  className="text-sm text-brand-teal font-medium hover:underline"
                >
                  See all
                </Link>
              </div>
            </CardHeader>
            {data.recent_transactions.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Your books are quiet."
                description="Once you import your first transactions, they'll show up here."
                action={
                  <Link
                    href="/transactions"
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90"
                  >
                    Add a transaction
                  </Link>
                }
              />
            ) : (
              <ul>
                {data.recent_transactions.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-5 py-3 border-b border-surface-border last:border-b-0"
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        t.direction === 'money_in'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-surface-muted text-brand-ink/70'
                      }`}
                    >
                      {t.direction === 'money_in' ? (
                        <TrendingUp className="h-5 w-5" aria-hidden />
                      ) : (
                        <TrendingDown className="h-5 w-5" aria-hidden />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-brand-ink truncate">
                        {t.description}
                      </div>
                      <div className="text-xs text-brand-ink/60 truncate">
                        {formatDate(t.date)}
                        {' · '}
                        {t.account_name ||
                          (t.status === 'uncategorized'
                            ? 'Needs a category'
                            : '—')}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-semibold whitespace-nowrap ${
                        t.direction === 'money_in'
                          ? 'text-green-700'
                          : 'text-brand-ink'
                      }`}
                    >
                      {t.direction === 'money_in' ? '+' : '−'}
                      {formatCurrency(t.amount_cents)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold text-brand-ink flex items-center gap-2">
                  <Sparkles
                    className="h-5 w-5 text-brand-orange"
                    aria-hidden
                  />
                  Recent wins
                </h2>
                <Link
                  href="/win-journal"
                  className="text-sm text-brand-teal font-medium hover:underline"
                >
                  See all
                </Link>
              </div>
            </CardHeader>
            <CardBody>
              {data.recent_wins.length === 0 ? (
                <p className="text-sm text-brand-ink/70 leading-relaxed">
                  Hit a milestone? Save it to your win journal so you remember
                  what&apos;s working.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.recent_wins.map((w) => (
                    <li key={w.id}>
                      <div className="text-sm font-medium text-brand-ink">
                        {w.title}
                      </div>
                      <div className="text-xs text-brand-ink/60">
                        {formatDate(w.entry_date)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

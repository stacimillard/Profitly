'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
  ArrowLeft,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react';
import type { MonthEndChecklist } from '@/lib/monthEnd/checklist';
import type { ClosedMonth } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Confetti } from '@/components/ui/Confetti';
import { formatMonthYear, formatDate } from '@/lib/utils/format';

interface Props {
  checklist: MonthEndChecklist;
  recentlyClosed: ClosedMonth[];
  currentStreak: number;
  monthOptions: { year: number; month: number; label: string }[];
}

export function MonthEndCloseView({
  checklist,
  recentlyClosed,
  currentStreak,
  monthOptions,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [streakAfter, setStreakAfter] = useState<number | null>(null);

  const selectedKey = `${checklist.year}-${String(checklist.month).padStart(2, '0')}`;

  function pickMonth(key: string) {
    const [yearStr, monthStr] = key.split('-');
    const params = new URLSearchParams();
    params.set('year', yearStr);
    params.set('month', String(parseInt(monthStr, 10)));
    router.push(`/month-end-close?${params.toString()}`);
  }

  async function handleClose() {
    if (!checklist.can_close && !window.confirm(
      "Some items still need attention. Close the month anyway?"
    )) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/closed-months', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: checklist.year,
        month: checklist.month,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't close the month.");
      return;
    }
    const body = await res.json();
    setStreakAfter(body?.data?.streak ?? null);
    setConfetti(true);
    router.refresh();
  }

  async function handleReopen(closedId: string, label: string) {
    if (!window.confirm(`Reopen ${label}? You'll be able to edit transactions in that month again.`)) {
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/closed-months/${closedId}`, {
      method: 'DELETE',
    });
    setSubmitting(false);
    if (res.ok) router.refresh();
  }

  const checks = useMemo(() => {
    return [
      {
        key: 'categorize',
        ok: checklist.uncategorized_count === 0,
        title:
          checklist.uncategorized_count === 0
            ? 'Every transaction has a category'
            : `${checklist.uncategorized_count} ${checklist.uncategorized_count === 1 ? 'transaction needs' : 'transactions need'} a category`,
        cta:
          checklist.uncategorized_count > 0
            ? {
                label: 'Sort these out',
                href: `/transactions?status=uncategorized`,
              }
            : null,
      },
      {
        key: 'receipts',
        ok: checklist.unmatched_receipts_count === 0,
        title:
          checklist.unmatched_receipts_count === 0
            ? 'All receipts are matched'
            : `${checklist.unmatched_receipts_count} ${checklist.unmatched_receipts_count === 1 ? 'receipt is' : 'receipts are'} still unmatched`,
        cta:
          checklist.unmatched_receipts_count > 0
            ? { label: 'Match receipts', href: '/receipts' }
            : null,
      },
      {
        key: 'bills',
        ok: checklist.unpaid_bills_count === 0,
        title:
          checklist.unpaid_bills_count === 0
            ? "No unpaid bills from this month"
            : `Do you have any unpaid bills from this month? ${checklist.unpaid_bills_count} ${checklist.unpaid_bills_count === 1 ? 'is' : 'are'} still open`,
        cta:
          checklist.unpaid_bills_count > 0
            ? { label: 'Review bills', href: '/bills' }
            : null,
      },
      ...checklist.reconciliation_status.map((rec) => ({
        key: `recon-${rec.bank_account_id}`,
        ok: rec.has_completed_recon,
        title: rec.has_completed_recon
          ? `${rec.bank_account_name} reconciled through ${checklist.month_label}`
          : `${rec.bank_account_name} hasn't been reconciled through ${checklist.month_label}`,
        cta: rec.has_completed_recon
          ? null
          : {
              label: 'Start a reconciliation',
              href: '/reconciliations',
            },
      })),
    ];
  }, [checklist]);

  return (
    <div className="space-y-6">
      <Confetti
        active={confetti}
        onComplete={() => setConfetti(false)}
      />

      <div>
        <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
          Month-end close
        </h1>
        <p className="mt-1 text-brand-ink/70">
          Wrap up a month so your books stay tight. We&apos;ll lock the month
          once you&apos;re done so nothing accidentally changes.
        </p>
      </div>

      {streakAfter !== null && streakAfter > 0 && (
        <Card className="border-brand-orange/40 bg-brand-orange/10">
          <CardBody className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand-orange" aria-hidden />
            <div>
              <div className="font-medium text-brand-ink">
                {streakAfter === 1
                  ? "That's one month closed. Welcome to the streak."
                  : `${streakAfter} months in a row — you're on fire.`}
              </div>
              <div className="text-sm text-brand-ink/70">
                Keep going next month to grow your streak.
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm text-brand-ink/60">Closing</div>
              <h2 className="font-heading font-bold text-2xl text-brand-ink">
                {checklist.month_label}
              </h2>
              {checklist.is_closed && (
                <Badge variant="success" className="mt-2">
                  Closed{checklist.closed_at && ` ${formatDate(checklist.closed_at)}`}
                </Badge>
              )}
            </div>
            <div className="min-w-[220px]">
              <Select
                label="Pick a month"
                value={selectedKey}
                onChange={(e) => pickMonth(e.target.value)}
              >
                {monthOptions.map((opt) => {
                  const key = `${opt.year}-${String(opt.month).padStart(2, '0')}`;
                  return (
                    <option key={key} value={key}>
                      {opt.label}
                    </option>
                  );
                })}
              </Select>
            </div>
          </div>

          {!checklist.is_closed && (
            <ul className="mt-6 space-y-2">
              {checks.map((c) => (
                <li
                  key={c.key}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg bg-surface-muted/40"
                >
                  {c.ok ? (
                    <CheckCircle2
                      className="h-5 w-5 text-brand-teal mt-0.5 shrink-0"
                      aria-hidden
                    />
                  ) : (
                    <AlertCircle
                      className="h-5 w-5 text-brand-orange mt-0.5 shrink-0"
                      aria-hidden
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-brand-ink">
                      {c.title}
                    </div>
                  </div>
                  {c.cta && (
                    <Link
                      href={c.cta.href}
                      className="text-sm font-medium text-brand-teal hover:underline shrink-0"
                    >
                      {c.cta.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
              {error}
            </div>
          )}

          {checklist.is_closed ? (
            <p className="mt-6 text-sm text-brand-ink/70">
              This month is locked. To make changes, reopen it from the list
              below.
            </p>
          ) : (
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleClose}
                loading={submitting}
                disabled={submitting}
              >
                <Lock className="h-4 w-4" />
                {checklist.can_close
                  ? `Close ${checklist.month_label}`
                  : 'Close anyway'}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {currentStreak > 0 && (
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-orange/15 flex items-center justify-center text-brand-orange">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="text-sm text-brand-ink/60">Your streak</div>
              <div className="font-heading font-semibold text-brand-ink">
                {currentStreak}{' '}
                {currentStreak === 1 ? 'month closed' : 'months in a row'}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {recentlyClosed.length > 0 && (
        <section>
          <h2 className="font-heading font-semibold text-brand-ink mb-3 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-brand-teal" aria-hidden />
            Recently closed
          </h2>
          <Card className="overflow-hidden">
            <ul>
              {recentlyClosed.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-surface-border last:border-b-0"
                >
                  <Lock className="h-4 w-4 text-brand-ink/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-brand-ink">
                      {formatMonthYear(c.month, c.year)}
                    </div>
                    <div className="text-xs text-brand-ink/60">
                      Closed {formatDate(c.closed_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleReopen(c.id, formatMonthYear(c.month, c.year))
                    }
                    disabled={submitting}
                    className="text-sm font-medium text-brand-ink/70 hover:text-brand-ink inline-flex items-center gap-1"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Reopen
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt, AlertTriangle } from 'lucide-react';
import type { Bill, BillStatus } from '@/lib/types';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface Props {
  initialBills: Bill[];
}

const STATUS_LABEL: Record<BillStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

const STATUS_BADGE: Record<
  BillStatus,
  'muted' | 'info' | 'success' | 'warning' | 'danger'
> = {
  unpaid: 'info',
  paid: 'success',
  overdue: 'danger',
  void: 'muted',
};

const FILTERS: { value: BillStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
];

export function BillsView({ initialBills }: Props) {
  const [filter, setFilter] = useState<BillStatus | 'all'>('unpaid');

  const today = new Date().toISOString().slice(0, 10);

  const withOverdue = useMemo(() => {
    // Soft-mark unpaid bills past due_date as overdue for display.
    return initialBills.map((b) => {
      const isOverdue = b.status === 'unpaid' && b.due_date < today;
      return {
        ...b,
        displayStatus: (isOverdue ? 'overdue' : b.status) as BillStatus,
      };
    });
  }, [initialBills, today]);

  const overdueCount = useMemo(
    () => withOverdue.filter((b) => b.displayStatus === 'overdue').length,
    [withOverdue]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return withOverdue;
    if (filter === 'unpaid') {
      // "Unpaid" tab should also include overdue bills.
      return withOverdue.filter(
        (b) => b.displayStatus === 'unpaid' || b.displayStatus === 'overdue'
      );
    }
    return withOverdue.filter((b) => b.displayStatus === filter);
  }, [filter, withOverdue]);

  const totalUnpaid = withOverdue
    .filter((b) => b.displayStatus === 'unpaid' || b.displayStatus === 'overdue')
    .reduce((sum, b) => sum + b.amount_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
            Bills
          </h1>
          <p className="mt-1 text-brand-ink/70">
            Track what you owe suppliers so nothing gets forgotten. Mark them
            paid once the money leaves your account.
          </p>
        </div>
        <Link
          href="/bills/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium text-sm hover:opacity-90 shrink-0"
        >
          <Plus className="h-4 w-4" />
          New bill
        </Link>
      </div>

      {overdueCount > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardBody className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="text-sm text-brand-ink">
              <span className="font-semibold">
                {overdueCount} {overdueCount === 1 ? 'bill is' : 'bills are'}{' '}
                past due.
              </span>{' '}
              Pay them soon so late fees don&apos;t pile up.
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/70 font-medium">
              Owed to suppliers
            </div>
            <div className="mt-2 font-heading font-bold text-2xl text-brand-ink">
              {formatCurrency(totalUnpaid)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/70 font-medium">
              Overdue
            </div>
            <div
              className={`mt-2 font-heading font-bold text-2xl ${
                overdueCount > 0 ? 'text-red-600' : 'text-brand-ink'
              }`}
            >
              {overdueCount}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="px-4 py-3 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-brand-teal text-white'
                  : 'bg-surface-muted text-brand-ink/70 hover:bg-surface-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title={
              initialBills.length === 0
                ? "You don't have any bills tracked yet."
                : 'Nothing in that view.'
            }
            description={
              initialBills.length === 0
                ? 'Add a bill as soon as one comes in so you never miss a payment.'
                : 'Try a different filter.'
            }
            action={
              initialBills.length === 0 ? (
                <Link
                  href="/bills/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add your first bill
                </Link>
              ) : null
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-brand-ink/60 border-b border-surface-border">
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Bill date</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const isOverdue = b.displayStatus === 'overdue';
                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-surface-border last:border-b-0 hover:bg-surface-muted/40 ${
                        isOverdue ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 align-middle">
                        <Link
                          href={`/bills/${b.id}`}
                          className="font-medium text-brand-ink hover:text-brand-teal"
                        >
                          {b.vendor_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle hidden sm:table-cell text-brand-ink/70">
                        {formatDate(b.bill_date)}
                      </td>
                      <td
                        className={`px-4 py-3 align-middle ${
                          isOverdue ? 'font-semibold text-red-700' : 'text-brand-ink/70'
                        }`}
                      >
                        {formatDate(b.due_date)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant={STATUS_BADGE[b.displayStatus]}>
                          {STATUS_LABEL[b.displayStatus]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-middle text-right font-semibold text-brand-ink whitespace-nowrap">
                        {formatCurrency(b.amount_cents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

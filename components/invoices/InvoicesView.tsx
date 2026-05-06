'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface Props {
  initialInvoices: Invoice[];
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

const STATUS_BADGE: Record<
  InvoiceStatus,
  'muted' | 'info' | 'success' | 'warning' | 'danger'
> = {
  draft: 'muted',
  sent: 'info',
  paid: 'success',
  overdue: 'warning',
  void: 'danger',
};

const FILTERS: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

export function InvoicesView({ initialInvoices }: Props) {
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');

  const today = new Date().toISOString().slice(0, 10);
  const withOverdue = useMemo(() => {
    // Soft-mark sent invoices past due_date as overdue for display.
    return initialInvoices.map((i) => {
      const isOverdue =
        i.status === 'sent' && i.due_date < today;
      return { ...i, displayStatus: (isOverdue ? 'overdue' : i.status) as InvoiceStatus };
    });
  }, [initialInvoices, today]);

  const filtered = useMemo(() => {
    if (filter === 'all') return withOverdue;
    return withOverdue.filter((i) => i.displayStatus === filter);
  }, [filter, withOverdue]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
            Invoices
          </h1>
          <p className="mt-1 text-brand-ink/70">
            Bill your customers, track what&apos;s outstanding, and book the
            money when it lands.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium text-sm hover:opacity-90 shrink-0"
        >
          <Plus className="h-4 w-4" />
          New invoice
        </Link>
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
            icon={FileText}
            title={
              initialInvoices.length === 0
                ? 'No invoices yet.'
                : 'Nothing in that view.'
            }
            description={
              initialInvoices.length === 0
                ? 'Create your first invoice to start billing.'
                : 'Try a different filter.'
            }
            action={
              initialInvoices.length === 0 ? (
                <Link
                  href="/invoices/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  New invoice
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
                  <th className="px-4 py-2">Invoice #</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Issued</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-surface-border last:border-b-0 hover:bg-surface-muted/40"
                  >
                    <td className="px-4 py-3 align-middle">
                      <Link
                        href={`/invoices/${i.id}`}
                        className="font-medium text-brand-ink hover:text-brand-teal"
                      >
                        {i.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle text-brand-ink/80">
                      {i.customer_name}
                    </td>
                    <td className="px-4 py-3 align-middle hidden sm:table-cell text-brand-ink/70">
                      {formatDate(i.issue_date)}
                    </td>
                    <td className="px-4 py-3 align-middle text-brand-ink/70">
                      {formatDate(i.due_date)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Badge variant={STATUS_BADGE[i.displayStatus]}>
                        {STATUS_LABEL[i.displayStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-middle text-right font-semibold text-brand-ink whitespace-nowrap">
                      {formatCurrency(i.total_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

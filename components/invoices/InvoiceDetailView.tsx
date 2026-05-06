'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Send,
  Trash2,
  Ban,
  CircleDollarSign,
} from 'lucide-react';
import type {
  Account,
  BankAccount,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface Props {
  invoice: Invoice;
  items: InvoiceLineItem[];
  revenueAccounts: Account[];
  bankAccounts: BankAccount[];
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

export function InvoiceDetailView({
  invoice,
  items,
  revenueAccounts,
  bankAccounts,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidModal, setPaidModal] = useState(false);
  const [paidAccountId, setPaidAccountId] = useState(
    revenueAccounts[0]?.id ?? ''
  );
  const [paidBankId, setPaidBankId] = useState('');
  const [paidDate, setPaidDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  async function patchInvoice(updates: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't update the invoice.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleMarkSent() {
    if (
      !window.confirm(
        `Mark ${invoice.invoice_number} as sent? You can mark it paid once the customer pays.`
      )
    ) {
      return;
    }
    await patchInvoice({ status: 'sent' });
  }

  async function handleMarkVoid() {
    if (!window.confirm(`Void ${invoice.invoice_number}? It'll stay on file but be marked unbillable.`)) {
      return;
    }
    await patchInvoice({ status: 'void' });
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${invoice.invoice_number}? Drafts can be recreated.`)) {
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE',
    });
    setSubmitting(false);
    if (res.ok) {
      router.push('/invoices');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't delete that one.");
    }
  }

  async function handleMarkPaidSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/invoices/${invoice.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: paidAccountId,
        bank_account_id: paidBankId || null,
        paid_date: paidDate,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't mark it paid.");
      return;
    }
    setPaidModal(false);
    router.refresh();
  }

  const isDraft = invoice.status === 'draft';
  const isSent = invoice.status === 'sent';
  const isPaid = invoice.status === 'paid';
  const isVoid = invoice.status === 'void';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
              {invoice.invoice_number}
            </h1>
            <p className="mt-1 text-brand-ink/70">
              For <span className="font-medium">{invoice.customer_name}</span>
            </p>
          </div>
          <Badge variant={STATUS_BADGE[invoice.status]}>
            {STATUS_LABEL[invoice.status]}
          </Badge>
        </div>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-brand-ink/60">Issued</div>
              <div className="font-medium text-brand-ink">
                {formatDate(invoice.issue_date)}
              </div>
            </div>
            <div>
              <div className="text-brand-ink/60">Due</div>
              <div className="font-medium text-brand-ink">
                {formatDate(invoice.due_date)}
              </div>
            </div>
            <div>
              <div className="text-brand-ink/60">Total</div>
              <div className="font-heading font-bold text-xl text-brand-ink">
                {formatCurrency(invoice.total_cents)}
              </div>
            </div>
          </div>

          {invoice.customer_email && (
            <div className="text-sm">
              <span className="text-brand-ink/60">Email:</span>{' '}
              <a
                href={`mailto:${invoice.customer_email}`}
                className="text-brand-teal hover:underline"
              >
                {invoice.customer_email}
              </a>
            </div>
          )}
          {invoice.customer_address && (
            <div className="text-sm">
              <div className="text-brand-ink/60">Address</div>
              <div className="text-brand-ink whitespace-pre-line">
                {invoice.customer_address}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <h2 className="font-heading font-semibold text-brand-ink">
            Line items
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-brand-ink/60 border-b border-surface-border">
                <th className="px-5 py-2">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit price</th>
                <th className="px-5 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.id}
                  className="border-b border-surface-border last:border-b-0"
                >
                  <td className="px-5 py-3 text-brand-ink">{it.description}</td>
                  <td className="px-3 py-3 text-right text-brand-ink/80">
                    {Number(it.quantity).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-brand-ink/80">
                    {formatCurrency(it.unit_price_cents)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-brand-ink whitespace-nowrap">
                    {formatCurrency(it.amount_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-border">
                <td colSpan={3} className="px-5 py-2 text-right text-brand-ink/70">
                  Subtotal
                </td>
                <td className="px-5 py-2 text-right font-medium text-brand-ink">
                  {formatCurrency(invoice.subtotal_cents)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="px-5 py-2 text-right text-brand-ink/70">
                  GST/HST ({(invoice.gst_hst_rate * 100).toFixed(2)}%)
                </td>
                <td className="px-5 py-2 text-right font-medium text-brand-ink">
                  {formatCurrency(invoice.gst_hst_amount_cents)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="px-5 py-3 text-right font-semibold text-brand-ink">
                  Total
                </td>
                <td className="px-5 py-3 text-right font-heading font-bold text-lg text-brand-ink">
                  {formatCurrency(invoice.total_cents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {invoice.notes && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-medium text-brand-ink/60 mb-1">
              Notes
            </h3>
            <p className="text-brand-ink whitespace-pre-line">
              {invoice.notes}
            </p>
          </CardBody>
        </Card>
      )}

      {isPaid && invoice.paid_at && (
        <Card className="border-brand-teal/30 bg-brand-teal/5">
          <CardBody className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-brand-teal" aria-hidden />
            <div className="text-sm text-brand-ink">
              Paid on{' '}
              <span className="font-medium">{formatDate(invoice.paid_at)}</span>
              . The income is recorded as a transaction.
            </div>
          </CardBody>
        </Card>
      )}

      {error && (
        <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        {isDraft && (
          <Button variant="danger" onClick={handleDelete} disabled={submitting}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
        {(isSent || isDraft) && !isPaid && !isVoid && (
          <Button variant="secondary" onClick={handleMarkVoid} disabled={submitting}>
            <Ban className="h-4 w-4" />
            Mark void
          </Button>
        )}
        {isDraft && (
          <Button variant="secondary" onClick={handleMarkSent} disabled={submitting}>
            <Send className="h-4 w-4" />
            Mark sent
          </Button>
        )}
        {(isDraft || isSent) && (
          <Button onClick={() => setPaidModal(true)} disabled={submitting}>
            <CircleDollarSign className="h-4 w-4" />
            Mark paid
          </Button>
        )}
      </div>

      <Modal
        open={paidModal}
        onClose={() => setPaidModal(false)}
        title="Mark this invoice paid"
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPaidModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="mark-paid-form" loading={submitting}>
              Record payment
            </Button>
          </>
        }
      >
        <form
          id="mark-paid-form"
          onSubmit={handleMarkPaidSubmit}
          className="space-y-4"
        >
          <p className="text-sm text-brand-ink/70">
            We&apos;ll record {formatCurrency(invoice.total_cents)} as money in
            for this invoice.
          </p>
          <Select
            label="Record income to"
            value={paidAccountId}
            onChange={(e) => setPaidAccountId(e.target.value)}
            required
          >
            {revenueAccounts.length === 0 && (
              <option value="">No revenue accounts found</option>
            )}
            {revenueAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            label="Deposited into (optional)"
            value={paidBankId}
            onChange={(e) => setPaidBankId(e.target.value)}
          >
            <option value="">— None —</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input
            label="Paid on"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}

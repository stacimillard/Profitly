'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Ban,
  CircleDollarSign,
  AlertTriangle,
} from 'lucide-react';
import type {
  Account,
  BankAccount,
  Bill,
  BillStatus,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface Props {
  bill: Bill;
  expenseAccounts: Account[];
  bankAccounts: BankAccount[];
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

export function BillDetailView({ bill, expenseAccounts, bankAccounts }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidModal, setPaidModal] = useState(false);
  const [paidAccountId, setPaidAccountId] = useState(
    bill.account_id ?? expenseAccounts[0]?.id ?? ''
  );
  const [paidBankId, setPaidBankId] = useState('');
  const [paidDate, setPaidDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = bill.status === 'unpaid' && bill.due_date < today;
  const displayStatus: BillStatus = isOverdue ? 'overdue' : bill.status;

  async function patchBill(updates: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/bills/${bill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't update the bill.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleMarkVoid() {
    if (
      !window.confirm(
        `Void this bill from ${bill.vendor_name}? It'll stay on file but be marked unpayable.`
      )
    ) {
      return;
    }
    await patchBill({ status: 'void' });
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete this bill from ${bill.vendor_name}? This can't be undone.`
      )
    ) {
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/bills/${bill.id}`, { method: 'DELETE' });
    setSubmitting(false);
    if (res.ok) {
      router.push('/bills');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't delete that one.");
    }
  }

  async function handleMarkPaidSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/bills/${bill.id}/mark-paid`, {
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

  const isUnpaid = bill.status === 'unpaid';
  const isPaid = bill.status === 'paid';
  const isVoid = bill.status === 'void';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/bills"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bills
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
              {bill.vendor_name}
            </h1>
            <p className="mt-1 text-brand-ink/70">
              Bill dated {formatDate(bill.bill_date)}
            </p>
          </div>
          <Badge variant={STATUS_BADGE[displayStatus]}>
            {STATUS_LABEL[displayStatus]}
          </Badge>
        </div>
      </div>

      {isOverdue && (
        <Card className="border-red-300 bg-red-50">
          <CardBody className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div className="text-sm text-brand-ink">
              This bill was due{' '}
              <span className="font-semibold">{formatDate(bill.due_date)}</span>{' '}
              — pay it soon to avoid late fees.
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-brand-ink/60">Bill date</div>
              <div className="font-medium text-brand-ink">
                {formatDate(bill.bill_date)}
              </div>
            </div>
            <div>
              <div className="text-brand-ink/60">Due</div>
              <div
                className={`font-medium ${
                  isOverdue ? 'text-red-700' : 'text-brand-ink'
                }`}
              >
                {formatDate(bill.due_date)}
              </div>
            </div>
            <div>
              <div className="text-brand-ink/60">Amount</div>
              <div className="font-heading font-bold text-xl text-brand-ink">
                {formatCurrency(bill.amount_cents)}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {bill.notes && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-medium text-brand-ink/60 mb-1">
              Notes
            </h3>
            <p className="text-brand-ink whitespace-pre-line">{bill.notes}</p>
          </CardBody>
        </Card>
      )}

      {isPaid && bill.paid_at && (
        <Card className="border-brand-teal/30 bg-brand-teal/5">
          <CardBody className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-brand-teal" />
            <div className="text-sm text-brand-ink">
              Paid on{' '}
              <span className="font-medium">{formatDate(bill.paid_at)}</span>.
              A transaction was booked for this payment.
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
        {isUnpaid && (
          <Button variant="danger" onClick={handleDelete} disabled={submitting}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
        {isUnpaid && !isVoid && (
          <Button
            variant="secondary"
            onClick={handleMarkVoid}
            disabled={submitting}
          >
            <Ban className="h-4 w-4" />
            Mark void
          </Button>
        )}
        {isUnpaid && (
          <Button onClick={() => setPaidModal(true)} disabled={submitting}>
            <CircleDollarSign className="h-4 w-4" />
            Mark as paid
          </Button>
        )}
      </div>

      <Modal
        open={paidModal}
        onClose={() => setPaidModal(false)}
        title="Mark this bill paid"
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPaidModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="bill-paid-form" loading={submitting}>
              Record payment
            </Button>
          </>
        }
      >
        <form
          id="bill-paid-form"
          onSubmit={handleMarkPaidSubmit}
          className="space-y-4"
        >
          <p className="text-sm text-brand-ink/70">
            We&apos;ll book {formatCurrency(bill.amount_cents)} as money out for
            this bill.
          </p>
          <Select
            label="Book it as"
            value={paidAccountId}
            onChange={(e) => setPaidAccountId(e.target.value)}
            required
          >
            {expenseAccounts.length === 0 && (
              <option value="">No accounts available</option>
            )}
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            label="Paid from (optional)"
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

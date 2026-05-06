'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, BookCheck, ChevronRight, CheckCircle2 } from 'lucide-react';
import type {
  BankAccount,
  Reconciliation,
  ReconciliationStatus,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export type ReconciliationListRow = Reconciliation & {
  bank_accounts: {
    name: string;
    type: string;
    last_four: string | null;
  } | null;
};

interface Props {
  initialReconciliations: ReconciliationListRow[];
  bankAccounts: BankAccount[];
}

const STATUS_LABEL: Record<ReconciliationStatus, string> = {
  in_progress: 'In progress',
  completed: 'Done',
};

export function ReconciliationsView({
  initialReconciliations,
  bankAccounts,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const monthAgoStr = oneMonthAgo.toISOString().slice(0, 10);

  const [bankAccountId, setBankAccountId] = useState(
    bankAccounts[0]?.id ?? ''
  );
  const [startDate, setStartDate] = useState(monthAgoStr);
  const [endDate, setEndDate] = useState(today);
  const [endingBalance, setEndingBalance] = useState('0.00');
  const [startingBalance, setStartingBalance] = useState('0.00');

  function openModal() {
    setBankAccountId(bankAccounts[0]?.id ?? '');
    setStartDate(monthAgoStr);
    setEndDate(today);
    setStartingBalance('0.00');
    setEndingBalance('0.00');
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/reconciliations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank_account_id: bankAccountId,
        statement_start_date: startDate,
        statement_end_date: endDate,
        statement_starting_balance_dollars: startingBalance,
        statement_ending_balance_dollars: endingBalance,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't start the reconciliation.");
      return;
    }
    const body = await res.json();
    router.push(`/reconciliations/${body.data.id}`);
  }

  const inProgress = initialReconciliations.filter(
    (r) => r.status === 'in_progress'
  );
  const completed = initialReconciliations.filter(
    (r) => r.status === 'completed'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
            Reconciliations
          </h1>
          <p className="mt-1 text-brand-ink/70">
            Match Profitly to your bank&apos;s reality, one statement at a
            time. Start with the period you want to clean up.
          </p>
        </div>
        <Button
          onClick={openModal}
          className="shrink-0"
          disabled={bankAccounts.length === 0}
        >
          <Plus className="h-4 w-4" />
          Start a reconciliation
        </Button>
      </div>

      {bankAccounts.length === 0 && (
        <Card>
          <EmptyState
            icon={BookCheck}
            title="Add a bank account first."
            description="We need a bank account to reconcile against."
            action={
              <Link
                href="/settings/bank-accounts"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90"
              >
                Add a bank account
              </Link>
            }
          />
        </Card>
      )}

      {bankAccounts.length > 0 && initialReconciliations.length === 0 && (
        <Card>
          <EmptyState
            icon={BookCheck}
            title="Nothing reconciled yet."
            description="Start your first reconciliation when you've got a bank statement to compare against."
            action={
              <Button onClick={openModal}>
                <Plus className="h-4 w-4" />
                Start a reconciliation
              </Button>
            }
          />
        </Card>
      )}

      {inProgress.length > 0 && (
        <section>
          <h2 className="font-heading font-semibold text-brand-ink mb-3">
            In progress
          </h2>
          <div className="space-y-3">
            {inProgress.map((r) => (
              <ReconRow key={r.id} recon={r} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="font-heading font-semibold text-brand-ink mb-3">
            Done
          </h2>
          <div className="space-y-3">
            {completed.map((r) => (
              <ReconRow key={r.id} recon={r} />
            ))}
          </div>
        </section>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start a reconciliation"
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="recon-form" loading={submitting}>
              Start
            </Button>
          </>
        }
      >
        <form id="recon-form" onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Bank account"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            required
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.last_four ? ` ···· ${b.last_four}` : ''}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Statement start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Statement end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Starting balance"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              helperText="Per the statement."
            />
            <Input
              label="Ending balance"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={endingBalance}
              onChange={(e) => setEndingBalance(e.target.value)}
              helperText="Per the statement."
            />
          </div>
          {error && (
            <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
              {error}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

function ReconRow({ recon }: { recon: ReconciliationListRow }) {
  return (
    <Link
      href={`/reconciliations/${recon.id}`}
      className="block rounded-xl border border-surface-border bg-white shadow-card hover:bg-surface-muted/40 px-5 py-4"
    >
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal">
          {recon.status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <BookCheck className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-brand-ink">
              {recon.bank_accounts?.name ?? 'Bank'}
            </span>
            <Badge
              variant={recon.status === 'completed' ? 'success' : 'warning'}
            >
              {STATUS_LABEL[recon.status]}
            </Badge>
          </div>
          <div className="text-sm text-brand-ink/60">
            {formatDate(recon.statement_start_date)} —{' '}
            {formatDate(recon.statement_end_date)}
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-xs text-brand-ink/60">Ending balance</div>
          <div className="font-semibold text-brand-ink">
            {formatCurrency(recon.statement_ending_balance_cents)}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-brand-ink/40 shrink-0" />
      </div>
    </Link>
  );
}

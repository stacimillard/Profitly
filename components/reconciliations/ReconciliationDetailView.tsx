'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  Loader2,
} from 'lucide-react';
import type {
  BankAccountType,
  Reconciliation,
  ReconciliationLine,
  TransactionDirection,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import {
  daysBetween,
  expectedTransactionForLine,
} from '@/lib/reconciliations/matching';

export type ReconciliationLineWithTxn = ReconciliationLine & {
  matched_transaction: {
    id: string;
    date: string;
    description: string;
    amount_cents: number;
    direction: TransactionDirection;
  } | null;
};

export interface ReconciliationDetail extends Reconciliation {
  bank_accounts: {
    name: string;
    type: BankAccountType;
    last_four: string | null;
  } | null;
}

export interface CandidateTransaction {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  direction: TransactionDirection;
  status: string;
}

interface Props {
  reconciliation: ReconciliationDetail;
  initialLines: ReconciliationLineWithTxn[];
  candidateTransactions: CandidateTransaction[];
}

export function ReconciliationDetailView({
  reconciliation,
  initialLines,
  candidateTransactions,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchModalLine, setMatchModalLine] =
    useState<ReconciliationLineWithTxn | null>(null);
  const [matchSearch, setMatchSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const isReadOnly = reconciliation.status === 'completed';
  const bankType = reconciliation.bank_accounts?.type ?? 'chequing';

  const matchedLines = useMemo(
    () => initialLines.filter((l) => l.is_matched),
    [initialLines]
  );
  const unmatchedLines = useMemo(
    () => initialLines.filter((l) => !l.is_matched),
    [initialLines]
  );

  const matchedSum = useMemo(
    () =>
      matchedLines.reduce((acc, l) => acc + l.statement_amount_cents, 0),
    [matchedLines]
  );

  const expectedDelta =
    reconciliation.statement_ending_balance_cents -
    reconciliation.statement_starting_balance_cents;
  const difference = expectedDelta - matchedSum;
  const isBalanced =
    initialLines.length > 0 && unmatchedLines.length === 0 && difference === 0;

  // Track transaction ids already used by other lines so they don't show in match modal.
  const usedTxnIds = useMemo(() => {
    const set = new Set<string>();
    for (const l of initialLines) {
      if (l.matched_transaction_id) set.add(l.matched_transaction_id);
    }
    return set;
  }, [initialLines]);

  const filteredCandidates = useMemo(() => {
    if (!matchModalLine) return [];
    const expected = expectedTransactionForLine(
      bankType,
      matchModalLine.statement_amount_cents
    );
    const q = matchSearch.trim().toLowerCase();
    return candidateTransactions
      .filter((t) => !usedTxnIds.has(t.id))
      .filter((t) =>
        q
          ? t.description.toLowerCase().includes(q) ||
            (t.amount_cents / 100).toFixed(2).includes(q)
          : true
      )
      .sort((a, b) => {
        const aMatch =
          a.direction === expected.direction &&
          a.amount_cents === expected.amount_cents
            ? 0
            : 1;
        const bMatch =
          b.direction === expected.direction &&
          b.amount_cents === expected.amount_cents
            ? 0
            : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        const aDays = daysBetween(a.date, matchModalLine.statement_date);
        const bDays = daysBetween(b.date, matchModalLine.statement_date);
        return aDays - bDays;
      });
  }, [
    matchModalLine,
    matchSearch,
    candidateTransactions,
    usedTxnIds,
    bankType,
  ]);

  async function handleStatementUpload(file: File) {
    setImporting(true);
    setImportError(null);
    setImportResult(null);

    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(
      `/api/reconciliations/${reconciliation.id}/import`,
      { method: 'POST', body: fd }
    );

    setImporting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setImportError(body.error || "Couldn't read that statement CSV.");
      return;
    }
    const body = await res.json();
    setImportResult(
      `Imported ${body.data.imported} lines. Auto-matched ${body.data.auto_matched}.`
    );
    router.refresh();
  }

  async function handleMatch(transactionId: string) {
    if (!matchModalLine) return;
    setSubmitting(true);
    const res = await fetch(
      `/api/reconciliations/${reconciliation.id}/match`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_id: matchModalLine.id,
          transaction_id: transactionId,
        }),
      }
    );
    setSubmitting(false);
    if (res.ok) {
      setMatchModalLine(null);
      setMatchSearch('');
      router.refresh();
    }
  }

  async function handleUnmatch(line: ReconciliationLineWithTxn) {
    setSubmitting(true);
    const res = await fetch(
      `/api/reconciliations/${reconciliation.id}/match`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_id: line.id,
          transaction_id: null,
        }),
      }
    );
    setSubmitting(false);
    if (res.ok) router.refresh();
  }

  async function handleComplete() {
    if (!window.confirm('Lock in this reconciliation? Matched transactions will be marked reconciled.')) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(
      `/api/reconciliations/${reconciliation.id}/complete`,
      { method: 'POST' }
    );
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't complete the reconciliation.");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm('Cancel this reconciliation? Imported statement lines will be removed.')) {
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/reconciliations/${reconciliation.id}`, {
      method: 'DELETE',
    });
    setSubmitting(false);
    if (res.ok) {
      router.push('/reconciliations');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reconciliations"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to reconciliations
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
              {reconciliation.bank_accounts?.name ?? 'Reconciliation'}
            </h1>
            <p className="mt-1 text-brand-ink/70">
              {formatDate(reconciliation.statement_start_date)} —{' '}
              {formatDate(reconciliation.statement_end_date)}
            </p>
          </div>
          {reconciliation.status === 'completed' ? (
            <Badge variant="success">Done</Badge>
          ) : (
            <Badge variant="warning">In progress</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/60">Statement says</div>
            <div className="mt-1 font-heading font-bold text-2xl text-brand-ink">
              {formatCurrency(expectedDelta)}
            </div>
            <div className="text-xs text-brand-ink/60 mt-1">
              {formatCurrency(reconciliation.statement_starting_balance_cents)}{' '}
              →{' '}
              {formatCurrency(reconciliation.statement_ending_balance_cents)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/60">Matched in Profitly</div>
            <div className="mt-1 font-heading font-bold text-2xl text-brand-ink">
              {formatCurrency(matchedSum)}
            </div>
            <div className="text-xs text-brand-ink/60 mt-1">
              {matchedLines.length} of {initialLines.length} statement lines
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-brand-ink/60">Difference</div>
            <div
              className={`mt-1 font-heading font-bold text-2xl ${
                difference === 0 ? 'text-brand-ink' : 'text-red-600'
              }`}
            >
              {formatCurrency(difference)}
            </div>
            <div className="text-xs text-brand-ink/60 mt-1">
              {difference === 0
                ? 'Books match the bank.'
                : "We'll need this to be $0 to finish."}
            </div>
          </CardBody>
        </Card>
      </div>

      {!isReadOnly && initialLines.length === 0 && (
        <Card>
          <CardBody>
            <h2 className="font-heading font-semibold text-brand-ink">
              Step 1 — Import your bank statement
            </h2>
            <p className="text-sm text-brand-ink/70 mt-1">
              Upload the CSV your bank gave you for{' '}
              {formatDate(reconciliation.statement_start_date)} —{' '}
              {formatDate(reconciliation.statement_end_date)}. We&apos;ll
              line it up against what&apos;s already in Profitly.
            </p>
            <label
              htmlFor="recon-statement"
              className="mt-4 flex flex-col items-center justify-center px-6 py-8 rounded-xl border-2 border-dashed border-surface-border bg-surface-muted/40 hover:bg-surface-muted cursor-pointer text-center"
            >
              {importing ? (
                <>
                  <Loader2 className="h-7 w-7 text-brand-teal animate-spin mb-2" />
                  <span className="font-medium text-brand-ink">
                    Reading your statement…
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-7 w-7 text-brand-ink/40 mb-2" />
                  <span className="font-medium text-brand-ink">
                    Click to upload statement CSV
                  </span>
                </>
              )}
              <input
                id="recon-statement"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleStatementUpload(file);
                }}
              />
            </label>
            {importError && (
              <p className="mt-3 text-sm text-red-600">{importError}</p>
            )}
            {importResult && (
              <p className="mt-3 text-sm text-brand-ink/80">{importResult}</p>
            )}
          </CardBody>
        </Card>
      )}

      {initialLines.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-heading font-semibold text-brand-ink">
              Statement lines
            </h2>
            <p className="text-sm text-brand-ink/60">
              {unmatchedLines.length === 0
                ? 'All lines matched.'
                : `${unmatchedLines.length} ${unmatchedLines.length === 1 ? 'line still needs' : 'lines still need'} a match.`}
            </p>
          </div>
          <ul>
            {initialLines.map((l) => {
              const expected = expectedTransactionForLine(
                bankType,
                l.statement_amount_cents
              );
              return (
                <li
                  key={l.id}
                  className="px-5 py-3 border-b border-surface-border last:border-b-0 flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0">
                    {l.is_matched ? (
                      <CheckCircle2 className="h-5 w-5 text-brand-teal" />
                    ) : (
                      <XCircle className="h-5 w-5 text-brand-ink/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-brand-ink truncate">
                      {l.statement_description}
                    </div>
                    <div className="text-xs text-brand-ink/60 truncate">
                      {formatDate(l.statement_date)}
                      {l.matched_transaction
                        ? ` · matched to "${l.matched_transaction.description}"`
                        : ` · expects ${expected.direction === 'money_in' ? '+' : '−'}${formatCurrency(expected.amount_cents)} in Profitly`}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-semibold whitespace-nowrap ${
                      l.statement_amount_cents >= 0
                        ? 'text-green-700'
                        : 'text-brand-ink'
                    }`}
                  >
                    {l.statement_amount_cents >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(l.statement_amount_cents))}
                  </div>
                  {!isReadOnly && (
                    <div className="shrink-0">
                      {l.is_matched ? (
                        <button
                          type="button"
                          onClick={() => handleUnmatch(l)}
                          disabled={submitting}
                          className="text-sm text-brand-ink/60 hover:text-brand-ink"
                        >
                          Unmatch
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMatchModalLine(l);
                            setMatchSearch('');
                          }}
                          className="text-sm font-medium text-brand-teal hover:underline"
                        >
                          Match
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-brand-pink/30 bg-brand-pink/15 px-4 py-3 text-sm text-brand-ink">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <div className="flex justify-between gap-3 flex-wrap">
          <Button
            variant="secondary"
            onClick={handleDelete}
            disabled={submitting}
          >
            <Trash2 className="h-4 w-4" />
            Cancel reconciliation
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!isBalanced || submitting}
            loading={submitting}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isBalanced
              ? 'Lock in this reconciliation'
              : initialLines.length === 0
                ? 'Upload a statement to begin'
                : 'Match all lines first'}
          </Button>
        </div>
      )}

      {/* Match modal */}
      <Modal
        open={matchModalLine !== null}
        onClose={() => setMatchModalLine(null)}
        size="lg"
        title="Match to a Profitly transaction"
        footer={
          <Button
            variant="secondary"
            type="button"
            onClick={() => setMatchModalLine(null)}
          >
            Cancel
          </Button>
        }
      >
        {matchModalLine && (
          <div>
            <div className="mb-4 p-3 rounded-lg bg-surface-muted">
              <div className="font-medium text-brand-ink">
                {matchModalLine.statement_description}
              </div>
              <div className="text-sm text-brand-ink/60">
                {formatDate(matchModalLine.statement_date)} ·{' '}
                {matchModalLine.statement_amount_cents >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(matchModalLine.statement_amount_cents))}
              </div>
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-ink/40" />
              <input
                type="search"
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                placeholder="Search description or amount…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-border bg-white text-sm text-brand-ink"
              />
            </div>

            {filteredCandidates.length === 0 ? (
              <p className="text-sm text-brand-ink/70 py-4 text-center">
                No matching transactions in this period. Add the transaction
                manually first, then come back to match it.
              </p>
            ) : (
              <ul className="border border-surface-border rounded-lg divide-y divide-surface-border max-h-80 overflow-y-auto">
                {filteredCandidates.slice(0, 80).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => handleMatch(t.id)}
                      disabled={submitting}
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-muted flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-brand-ink truncate">
                          {t.description}
                        </div>
                        <div className="text-xs text-brand-ink/60">
                          {formatDate(t.date)}
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
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

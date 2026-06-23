'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { BankAccount, TransactionDirection } from '@/lib/types';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface ParsedTransaction {
  client_id: string;
  date: string;
  description: string;
  amount_cents: number;
  direction: TransactionDirection;
}

interface DuplicateInfo {
  client_id: string;
  matched_transaction_id: string;
  matched_description: string;
}

interface ParseResponse {
  source: 'csv' | 'pdf';
  bank_account: { id: string; name: string; type: string };
  transactions: ParsedTransaction[];
  duplicates: DuplicateInfo[];
  skipped: number;
  date_range: { start: string; end: string };
}

interface ImportResult {
  imported: number;
  auto_categorized: number;
  uncategorized: number;
  skipped: number;
}

interface Props {
  bankAccounts: BankAccount[];
}

type Stage = 'upload' | 'parsing' | 'review' | 'submitting' | 'done';

export function TransactionImportView({ bankAccounts }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('upload');
  const [bankAccountId, setBankAccountId] = useState(
    bankAccounts[0]?.id ?? ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  if (bankAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
            Import transactions
          </h1>
        </div>
        <Card>
          <EmptyState
            icon={Upload}
            title="Add a bank account first."
            description="We need to know which account these transactions belong to before we can import them."
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
      </div>
    );
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !bankAccountId) return;
    setError(null);
    setStage('parsing');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bank_account_id', bankAccountId);

    let res: Response;
    try {
      res = await fetch('/api/transactions/import/parse', {
        method: 'POST',
        body: formData,
      });
    } catch {
      setStage('upload');
      setError("We couldn't reach the server — check your connection?");
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStage('upload');
      setError(
        body.error || "We couldn't read that file — try a different one?"
      );
      return;
    }

    const body = await res.json();
    const data = body.data as ParseResponse;

    const dupIds = new Set(data.duplicates.map((d) => d.client_id));
    const initialSelected: Record<string, boolean> = {};
    for (const t of data.transactions) {
      initialSelected[t.client_id] = !dupIds.has(t.client_id);
    }
    setSelected(initialSelected);
    setParsed(data);
    setStage('review');
  }

  async function handleConfirmImport() {
    if (!parsed) return;
    setError(null);
    setStage('submitting');

    const toImport = parsed.transactions.filter((t) => selected[t.client_id]);
    if (toImport.length === 0) {
      setStage('review');
      setError('Pick at least one transaction to import.');
      return;
    }

    let res: Response;
    try {
      res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_account_id: parsed.bank_account.id,
          transactions: toImport.map((t) => ({
            date: t.date,
            description: t.description,
            amount_cents: t.amount_cents,
            direction: t.direction,
          })),
        }),
      });
    } catch {
      setStage('review');
      setError("We couldn't reach the server — try again?");
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStage('review');
      setError(body.error || 'Import failed — try again?');
      return;
    }

    const body = await res.json();
    setResult(body.data as ImportResult);
    setStage('done');
  }

  function reset() {
    setStage('upload');
    setFile(null);
    setParsed(null);
    setSelected({});
    setResult(null);
    setError(null);
  }

  if (stage === 'done' && result) {
    return (
      <div className="space-y-6 max-w-xl">
        <Card>
          <CardBody className="text-center py-10 px-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal mb-4">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="font-heading font-bold text-2xl text-brand-ink">
              Imported {result.imported}{' '}
              {result.imported === 1 ? 'transaction' : 'transactions'}.
            </h2>
            <p className="mt-2 text-brand-ink/70">
              {result.auto_categorized > 0
                ? `${result.auto_categorized} matched a rule and got auto-categorized. `
                : ''}
              {result.uncategorized > 0
                ? `${result.uncategorized} still need a category — let's sort those out.`
                : "You're all caught up."}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="secondary" onClick={reset}>
                Import another
              </Button>
              <Button
                onClick={() =>
                  router.push(
                    result.uncategorized > 0
                      ? '/transactions?status=uncategorized'
                      : '/transactions'
                  )
                }
              >
                See transactions
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (stage === 'review' && parsed) {
    return (
      <ReviewStep
        parsed={parsed}
        selected={selected}
        setSelected={setSelected}
        error={error}
        submitting={stage !== 'review'}
        onCancel={reset}
        onConfirm={handleConfirmImport}
      />
    );
  }

  if (stage === 'submitting' && parsed) {
    return (
      <ReviewStep
        parsed={parsed}
        selected={selected}
        setSelected={setSelected}
        error={error}
        submitting
        onCancel={reset}
        onConfirm={handleConfirmImport}
      />
    );
  }

  const isParsing = stage === 'parsing';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to transactions
        </Link>
        <h1 className="mt-2 font-heading font-bold text-3xl text-brand-ink leading-tight">
          Import transactions
        </h1>
        <p className="mt-1 text-brand-ink/70">
          Upload a CSV or PDF from your bank or credit card. We&apos;ll read it,
          flag anything we&apos;ve seen before, and let you review every line
          before saving.
        </p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleUpload} className="space-y-5">
            <Select
              label="Which account is this from?"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              required
              disabled={isParsing}
            >
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.last_four ? ` ···· ${b.last_four}` : ''}
                </option>
              ))}
            </Select>

            <div>
              <label
                htmlFor="statement-file"
                className="block text-sm font-medium text-brand-ink mb-1"
              >
                Statement file
              </label>
              <label
                htmlFor="statement-file"
                className={`flex flex-col items-center justify-center px-6 py-10 rounded-xl border-2 border-dashed text-center ${
                  isParsing
                    ? 'border-surface-border bg-surface-muted/40 cursor-not-allowed opacity-70'
                    : 'border-surface-border bg-surface-muted/40 hover:bg-surface-muted cursor-pointer'
                }`}
              >
                {file ? (
                  <>
                    <FileText className="h-7 w-7 text-brand-teal mb-2" />
                    <span className="font-medium text-brand-ink">
                      {file.name}
                    </span>
                    <span className="text-xs text-brand-ink/60">
                      {(file.size / 1024).toFixed(1)} KB · click to change
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-brand-ink/40 mb-2" />
                    <span className="font-medium text-brand-ink">
                      Click to choose a file
                    </span>
                    <span className="text-xs text-brand-ink/60 mt-1">
                      .csv or .pdf, up to 15 MB
                    </span>
                  </>
                )}
                <input
                  id="statement-file"
                  type="file"
                  accept=".csv,text/csv,.pdf,application/pdf"
                  className="sr-only"
                  disabled={isParsing}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
                {error}
              </div>
            )}

            {isParsing && (
              <div className="rounded-lg bg-brand-teal/10 border border-brand-teal/20 px-4 py-3 text-sm text-brand-ink flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-teal" />
                Reading your statement
                {file?.name.toLowerCase().endsWith('.pdf')
                  ? ' with AI — this can take 20–40 seconds for a PDF.'
                  : '…'}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Link
                href="/transactions"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-surface-border text-brand-ink font-medium text-sm hover:bg-surface-muted"
              >
                Cancel
              </Link>
              <Button
                type="submit"
                disabled={!file || !bankAccountId || isParsing}
                loading={isParsing}
              >
                Read file
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-surface-border text-sm text-brand-ink/60 leading-relaxed">
            <p className="font-medium text-brand-ink mb-1">
              What works here:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium">CSV exports</span> — column order
                doesn&apos;t matter. We&apos;ll find the Date, Description, and
                Amount (or Debit/Credit) columns automatically.
              </li>
              <li>
                <span className="font-medium">PDF statements</span> — we use AI
                to read each posted transaction off the page.
              </li>
              <li>
                Nothing is saved until you review the list and confirm.
              </li>
            </ul>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

interface ReviewStepProps {
  parsed: ParseResponse;
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ReviewStep({
  parsed,
  selected,
  setSelected,
  error,
  submitting,
  onCancel,
  onConfirm,
}: ReviewStepProps) {
  const duplicateIds = useMemo(
    () => new Set(parsed.duplicates.map((d) => d.client_id)),
    [parsed.duplicates]
  );
  const duplicateLookup = useMemo(() => {
    const m = new Map<string, DuplicateInfo>();
    for (const d of parsed.duplicates) m.set(d.client_id, d);
    return m;
  }, [parsed.duplicates]);

  const selectedCount = parsed.transactions.filter(
    (t) => selected[t.client_id]
  ).length;
  const selectedDupes = parsed.transactions.filter(
    (t) => selected[t.client_id] && duplicateIds.has(t.client_id)
  ).length;

  const allSelected = selectedCount === parsed.transactions.length;

  function toggleAll() {
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      for (const t of parsed.transactions) next[t.client_id] = true;
      setSelected(next);
    }
  }
  function toggleNonDuplicates() {
    const next: Record<string, boolean> = {};
    for (const t of parsed.transactions) {
      next[t.client_id] = !duplicateIds.has(t.client_id);
    }
    setSelected(next);
  }
  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Start over
        </button>
        <h1 className="mt-2 font-heading font-bold text-3xl text-brand-ink leading-tight">
          Review before importing
        </h1>
        <p className="mt-1 text-brand-ink/70">
          We pulled {parsed.transactions.length}{' '}
          {parsed.transactions.length === 1 ? 'transaction' : 'transactions'}{' '}
          from your {parsed.source === 'pdf' ? 'PDF statement' : 'CSV'} for{' '}
          <span className="font-medium text-brand-ink">
            {parsed.bank_account.name}
          </span>
          {parsed.transactions.length > 0 && (
            <>
              {' '}covering {formatDate(parsed.date_range.start)} —{' '}
              {formatDate(parsed.date_range.end)}
            </>
          )}
          . Uncheck anything you don&apos;t want.
        </p>
      </div>

      {parsed.duplicates.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardBody className="px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5"
                aria-hidden
              />
              <div className="flex-1">
                <h3 className="font-heading font-semibold text-brand-ink">
                  Possible duplicates: {parsed.duplicates.length}
                </h3>
                <p className="mt-1 text-sm text-brand-ink/80">
                  These dates &amp; amounts already exist for{' '}
                  {parsed.bank_account.name}. We unchecked them by default — go
                  through them and re-check anything you do want to import.
                </p>
                <button
                  type="button"
                  onClick={toggleNonDuplicates}
                  className="mt-3 inline-flex items-center text-sm font-medium text-amber-800 hover:underline"
                >
                  Reset to: skip duplicates, keep everything else
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {parsed.skipped > 0 && (
        <p className="text-sm text-brand-ink/60">
          We skipped {parsed.skipped}{' '}
          {parsed.skipped === 1 ? 'row' : 'rows'} that didn&apos;t look like
          transactions.
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-brand-ink">
              <span className="font-medium">
                {selectedCount} of {parsed.transactions.length} selected
              </span>
              {selectedDupes > 0 && (
                <span className="text-amber-700">
                  · including {selectedDupes}{' '}
                  {selectedDupes === 1 ? 'duplicate' : 'duplicates'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm font-medium text-brand-teal hover:underline"
            >
              {allSelected ? 'Uncheck all' : 'Select all'}
            </button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-brand-ink/70">
              <tr>
                <th className="px-4 py-2 text-left w-10"></th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody>
              {parsed.transactions.map((t) => {
                const isChecked = !!selected[t.client_id];
                const isDup = duplicateIds.has(t.client_id);
                const dup = duplicateLookup.get(t.client_id);
                return (
                  <tr
                    key={t.client_id}
                    className={`border-t border-surface-border ${
                      isDup ? 'bg-amber-50/60' : ''
                    }`}
                  >
                    <td className="px-4 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(t.client_id)}
                        className="h-4 w-4 rounded border-surface-border text-brand-teal focus:ring-brand-teal"
                        aria-label={`Include ${t.description}`}
                      />
                    </td>
                    <td className="px-4 py-2 align-top whitespace-nowrap text-brand-ink">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-2 align-top text-brand-ink">
                      <div className="font-medium break-words">
                        {t.description}
                      </div>
                      {isDup && dup && (
                        <div className="mt-0.5 text-xs text-amber-800">
                          Matches existing: {dup.matched_description}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 align-top whitespace-nowrap text-right font-medium ${
                        t.direction === 'money_in'
                          ? 'text-green-700'
                          : 'text-brand-ink'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        {t.direction === 'money_in' ? (
                          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <TrendingDown
                            className="h-3.5 w-3.5 text-brand-ink/60"
                            aria-hidden
                          />
                        )}
                        {t.direction === 'money_in' ? '+' : '−'}
                        {formatCurrency(t.amount_cents)}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top hidden md:table-cell">
                      {isDup && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Possible duplicate
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {error && (
        <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={selectedCount === 0 || submitting}
          loading={submitting}
        >
          Import {selectedCount}{' '}
          {selectedCount === 1 ? 'transaction' : 'transactions'}
        </Button>
      </div>
    </div>
  );
}

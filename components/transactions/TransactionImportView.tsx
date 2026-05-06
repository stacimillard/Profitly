'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { BankAccount } from '@/lib/types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';

interface ImportResult {
  imported: number;
  auto_categorized: number;
  uncategorized: number;
  skipped: number;
}

interface Props {
  bankAccounts: BankAccount[];
}

export function TransactionImportView({ bankAccounts }: Props) {
  const router = useRouter();
  const [bankAccountId, setBankAccountId] = useState(
    bankAccounts[0]?.id ?? ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !bankAccountId) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bank_account_id', bankAccountId);

    const res = await fetch('/api/transactions/import', {
      method: 'POST',
      body: formData,
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't read that CSV — try a different file?");
      return;
    }

    const body = await res.json();
    setResult(body.data as ImportResult);
  }

  if (result) {
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
            {result.skipped > 0 && (
              <p className="mt-2 text-sm text-brand-ink/60">
                We skipped {result.skipped}{' '}
                {result.skipped === 1 ? 'row' : 'rows'} that didn&apos;t look
                like transactions.
              </p>
            )}
            <div className="mt-6 flex justify-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
              >
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
          Upload a CSV from your bank or credit card. We&apos;ll auto-detect the
          columns and apply your categorization rules.
        </p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Select
              label="Which account is this from?"
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

            <div>
              <label
                htmlFor="csv-file"
                className="block text-sm font-medium text-brand-ink mb-1"
              >
                CSV file
              </label>
              <label
                htmlFor="csv-file"
                className="flex flex-col items-center justify-center px-6 py-10 rounded-xl border-2 border-dashed border-surface-border bg-surface-muted/40 hover:bg-surface-muted cursor-pointer text-center"
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
                      .csv, up to ~10,000 rows
                    </span>
                  </>
                )}
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
                {error}
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
                disabled={!file || !bankAccountId}
                loading={submitting}
              >
                Import
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-surface-border text-sm text-brand-ink/60 leading-relaxed">
            <p className="font-medium text-brand-ink mb-1">
              What we look for in your CSV:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                A <span className="font-medium">Date</span> column (any common
                format works)
              </li>
              <li>
                A <span className="font-medium">Description</span> column
                (sometimes called Details or Memo)
              </li>
              <li>
                Either an <span className="font-medium">Amount</span> column,
                or separate <span className="font-medium">Debit</span> and{' '}
                <span className="font-medium">Credit</span> columns
              </li>
            </ul>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

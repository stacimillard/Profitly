'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, Upload, CheckCircle2, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { parseCSV, parseCsvAmountCents, parseCsvDate } from '@/lib/csv/parse';
import { formatCurrency } from '@/lib/utils/format';
import type {
  ApLedgerRow,
  ArLedgerRow,
  OnboardingData,
  ReconciliationStartingPoint,
  TrialBalanceRow,
} from './types';

interface Props {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

type SubStep = 'trial_balance' | 'reconciliation' | 'ledgers';

const SOURCE_LABEL: Record<string, string> = {
  quickbooks: 'QuickBooks',
  wave: 'Wave',
  spreadsheets: 'your spreadsheets',
  other: 'your old software',
};

export function Step3Migration({ data, updateData, onNext, onBack }: Props) {
  const [subStep, setSubStep] = useState<SubStep>('trial_balance');

  function goSubNext() {
    if (subStep === 'trial_balance') setSubStep('reconciliation');
    else if (subStep === 'reconciliation') setSubStep('ledgers');
    else onNext();
  }
  function goSubBack() {
    if (subStep === 'ledgers') setSubStep('reconciliation');
    else if (subStep === 'reconciliation') setSubStep('trial_balance');
    else onBack();
  }

  const sourceLabel =
    SOURCE_LABEL[data.migration_source ?? ''] ?? 'your old software';

  return (
    <div>
      {subStep === 'trial_balance' && (
        <TrialBalanceSub
          data={data}
          updateData={updateData}
          sourceLabel={sourceLabel}
          onNext={goSubNext}
          onBack={goSubBack}
        />
      )}
      {subStep === 'reconciliation' && (
        <ReconciliationSub
          data={data}
          updateData={updateData}
          onNext={goSubNext}
          onBack={goSubBack}
        />
      )}
      {subStep === 'ledgers' && (
        <LedgersSub
          data={data}
          updateData={updateData}
          onNext={goSubNext}
          onBack={goSubBack}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-step A — Trial balance CSV upload
// ---------------------------------------------------------------------------
function TrialBalanceSub({
  data,
  updateData,
  sourceLabel,
  onNext,
  onBack,
}: {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  sourceLabel: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setError("That file didn't have any rows we could read.");
      return;
    }
    const headers = rows[0].map((h) => h.toLowerCase());
    const nameIdx = headers.findIndex(
      (h) => h.includes('account') || h.includes('name')
    );
    const balIdx = headers.findIndex(
      (h) => h.includes('balance') || h.includes('amount') || h.includes('total')
    );
    if (nameIdx < 0 || balIdx < 0) {
      setError(
        "Couldn't find an account name column and a balance column. Column headers like \"Account\" and \"Balance\" work best."
      );
      return;
    }
    const parsed: TrialBalanceRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = r[nameIdx]?.trim();
      if (!name) continue;
      const cents = parseCsvAmountCents(r[balIdx] ?? '');
      if (cents === 0 && !r[balIdx]) continue;
      parsed.push({ account_name: name, balance_cents: cents });
    }
    if (parsed.length === 0) {
      setError('We could read the file but every row was blank.');
      return;
    }
    updateData({ trial_balance_rows: parsed });
  }

  function clearRows() {
    updateData({ trial_balance_rows: [] });
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-brand-ink leading-tight">
        Bring over your trial balance
      </h2>
      <p className="mt-2 text-brand-ink/70">
        A trial balance is a snapshot of every account and what it&apos;s worth
        right now. It&apos;s how we know your starting point.
      </p>

      <Card className="mt-4">
        <CardBody>
          <h3 className="font-semibold text-brand-ink text-sm">
            How to export from {sourceLabel}
          </h3>
          <ul className="mt-2 text-sm text-brand-ink/70 space-y-1 list-disc list-inside">
            {sourceLabel === 'QuickBooks' && (
              <>
                <li>Go to Reports → For my accountant → Trial Balance</li>
                <li>Set the report date to today (or your migration date)</li>
                <li>Click Export → Export to Excel/CSV</li>
              </>
            )}
            {sourceLabel === 'Wave' && (
              <>
                <li>Go to Reports → Trial Balance</li>
                <li>Set the date to today, click Export CSV</li>
              </>
            )}
            {sourceLabel === 'your spreadsheets' && (
              <>
                <li>
                  Make a two-column sheet: account name and current balance
                </li>
                <li>Save it as CSV (File → Download → CSV)</li>
              </>
            )}
            {sourceLabel === 'your old software' && (
              <>
                <li>Find the &ldquo;trial balance&rdquo; or &ldquo;chart of accounts&rdquo; report</li>
                <li>Export it as CSV — two columns is enough: account name and balance</li>
              </>
            )}
          </ul>
          <p className="mt-3 text-xs text-brand-ink/60">
            No trial balance handy? Skip this — you can add opening balances
            later in Settings.
          </p>
        </CardBody>
      </Card>

      <div className="mt-6">
        {data.trial_balance_rows.length === 0 ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-surface-border rounded-xl p-8 cursor-pointer hover:bg-surface-muted">
            <Upload className="h-8 w-8 text-brand-ink/50" />
            <span className="mt-2 font-medium text-brand-ink">
              Upload your trial balance CSV
            </span>
            <span className="mt-1 text-sm text-brand-ink/60">
              We&apos;ll match accounts and set opening balances.
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        ) : (
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 text-brand-teal">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  Got {data.trial_balance_rows.length} accounts from your file
                </span>
              </div>
              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-surface-border">
                <table className="w-full text-sm">
                  <tbody>
                    {data.trial_balance_rows.map((r, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-surface-border last:border-b-0"
                      >
                        <td className="px-3 py-2 text-brand-ink">
                          {r.account_name}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-brand-ink whitespace-nowrap">
                          {formatCurrency(r.balance_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={clearRows}
                className="mt-3 inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
              >
                <Trash2 className="h-4 w-4" />
                Clear and re-upload
              </button>
            </CardBody>
          </Card>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
          {error}
        </div>
      )}

      <div className="mt-8 flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onNext}>
            Skip this
          </Button>
          <Button onClick={onNext}>Next</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-step B — Last bank reconciliation
// ---------------------------------------------------------------------------
function ReconciliationSub({
  data,
  updateData,
  onNext,
  onBack,
}: {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  function updateRow(idx: number, patch: Partial<ReconciliationStartingPoint>) {
    const rows = [...data.reconciliation_starting_points];
    rows[idx] = { ...rows[idx], ...patch };
    updateData({ reconciliation_starting_points: rows });
  }
  function addRow() {
    updateData({
      reconciliation_starting_points: [
        ...data.reconciliation_starting_points,
        {
          bank_account_name: '',
          bank_account_type: 'chequing',
          last_reconciled_balance_cents: 0,
          last_reconciled_date: new Date().toISOString().slice(0, 10),
        },
      ],
    });
  }
  function removeRow(idx: number) {
    const rows = [...data.reconciliation_starting_points];
    rows.splice(idx, 1);
    updateData({ reconciliation_starting_points: rows });
  }

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-brand-ink leading-tight">
        Where did you last leave off?
      </h2>
      <p className="mt-2 text-brand-ink/70">
        For each bank or credit card, tell us the last time you reconciled and
        what the balance was on that date. We&apos;ll pick up from there so no
        transactions get counted twice.
      </p>

      <div className="mt-6 space-y-4">
        {data.reconciliation_starting_points.map((row, idx) => (
          <Card key={idx}>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-brand-ink">
                  Account {idx + 1}
                </h3>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-sm text-brand-ink/60 hover:text-brand-ink inline-flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Account nickname"
                  placeholder="Main chequing, Visa, etc."
                  value={row.bank_account_name}
                  onChange={(e) =>
                    updateRow(idx, { bank_account_name: e.target.value })
                  }
                />
                <Select
                  label="What kind of account?"
                  value={row.bank_account_type}
                  onChange={(e) =>
                    updateRow(idx, {
                      bank_account_type: e.target.value as
                        | 'chequing'
                        | 'savings'
                        | 'credit_card',
                    })
                  }
                >
                  <option value="chequing">Chequing</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit card</option>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Balance on that date ($)"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={(row.last_reconciled_balance_cents / 100).toString()}
                  onChange={(e) =>
                    updateRow(idx, {
                      last_reconciled_balance_cents: Math.round(
                        (parseFloat(e.target.value) || 0) * 100
                      ),
                    })
                  }
                />
                <Input
                  label="Last reconciled on"
                  type="date"
                  value={row.last_reconciled_date}
                  onChange={(e) =>
                    updateRow(idx, { last_reconciled_date: e.target.value })
                  }
                />
              </div>
            </CardBody>
          </Card>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="w-full py-3 rounded-lg border-2 border-dashed border-surface-border text-brand-ink/70 hover:bg-surface-muted inline-flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="h-4 w-4" />
          Add an account
        </button>
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onNext}>
            Skip this
          </Button>
          <Button onClick={onNext}>Next</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-step C — AR and AP ledgers
// ---------------------------------------------------------------------------
function LedgersSub({
  data,
  updateData,
  onNext,
  onBack,
}: {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [hasOutstanding, setHasOutstanding] = useState<boolean | null>(
    data.ar_ledger_rows.length > 0 || data.ap_ledger_rows.length > 0
      ? true
      : null
  );
  const [arError, setArError] = useState<string | null>(null);
  const [apError, setApError] = useState<string | null>(null);

  async function handleArFile(e: React.ChangeEvent<HTMLInputElement>) {
    setArError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setArError("That file didn't have any rows we could read.");
      return;
    }
    const headers = rows[0].map((h) => h.toLowerCase());
    const custIdx = headers.findIndex((h) => h.includes('customer') || h.includes('client') || h.includes('name'));
    const invIdx = headers.findIndex((h) => h.includes('invoice') || h.includes('number') || h.includes('#'));
    const issueIdx = headers.findIndex((h) => h.includes('issue') || h.includes('date'));
    const dueIdx = headers.findIndex((h) => h.includes('due'));
    const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('total') || h.includes('balance'));

    if (custIdx < 0 || amountIdx < 0) {
      setArError(
        "Couldn't find a customer column and an amount column. Column headers like \"Customer\" and \"Amount\" work best."
      );
      return;
    }

    const parsed: ArLedgerRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const customer = r[custIdx]?.trim();
      if (!customer) continue;
      const amount = parseCsvAmountCents(r[amountIdx] ?? '');
      if (amount === 0) continue;
      const issue =
        issueIdx >= 0 ? parseCsvDate(r[issueIdx] ?? '') : null;
      const due = dueIdx >= 0 ? parseCsvDate(r[dueIdx] ?? '') : null;
      parsed.push({
        customer_name: customer,
        invoice_number: invIdx >= 0 ? r[invIdx]?.trim() || '' : '',
        issue_date: issue ?? new Date().toISOString().slice(0, 10),
        due_date:
          due ?? issue ?? new Date().toISOString().slice(0, 10),
        amount_cents: amount,
      });
    }
    updateData({ ar_ledger_rows: parsed });
  }

  async function handleApFile(e: React.ChangeEvent<HTMLInputElement>) {
    setApError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setApError("That file didn't have any rows we could read.");
      return;
    }
    const headers = rows[0].map((h) => h.toLowerCase());
    const vendorIdx = headers.findIndex((h) => h.includes('vendor') || h.includes('supplier') || h.includes('name'));
    const billIdx = headers.findIndex((h) => h.includes('bill date') || h.includes('issue') || h === 'date');
    const dueIdx = headers.findIndex((h) => h.includes('due'));
    const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('total') || h.includes('balance'));

    if (vendorIdx < 0 || amountIdx < 0) {
      setApError(
        "Couldn't find a vendor column and an amount column. Column headers like \"Vendor\" and \"Amount\" work best."
      );
      return;
    }

    const parsed: ApLedgerRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const vendor = r[vendorIdx]?.trim();
      if (!vendor) continue;
      const amount = parseCsvAmountCents(r[amountIdx] ?? '');
      if (amount === 0) continue;
      const billDate =
        billIdx >= 0 ? parseCsvDate(r[billIdx] ?? '') : null;
      const due = dueIdx >= 0 ? parseCsvDate(r[dueIdx] ?? '') : null;
      parsed.push({
        vendor_name: vendor,
        bill_date: billDate ?? new Date().toISOString().slice(0, 10),
        due_date:
          due ?? billDate ?? new Date().toISOString().slice(0, 10),
        amount_cents: amount,
        notes: null,
      });
    }
    updateData({ ap_ledger_rows: parsed });
  }

  function clearAr() {
    updateData({ ar_ledger_rows: [] });
  }
  function clearAp() {
    updateData({ ap_ledger_rows: [] });
  }

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-brand-ink leading-tight">
        Any open invoices or bills?
      </h2>
      <p className="mt-2 text-brand-ink/70">
        These are invoices customers still owe you, or bills you haven&apos;t
        paid yet. Bringing them over means nothing falls through the cracks.
      </p>

      {hasOutstanding === null && (
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => setHasOutstanding(true)}
            className="w-full text-left rounded-xl border border-surface-border bg-white hover:bg-surface-muted p-4"
          >
            <div className="font-heading font-semibold text-brand-ink">
              Yes, I&apos;ve got some open
            </div>
            <div className="mt-1 text-sm text-brand-ink/70">
              We&apos;ll pull them in from a CSV.
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setHasOutstanding(false);
              onNext();
            }}
            className="w-full text-left rounded-xl border border-surface-border bg-white hover:bg-surface-muted p-4"
          >
            <div className="font-heading font-semibold text-brand-ink">
              Nope, I&apos;m all caught up
            </div>
            <div className="mt-1 text-sm text-brand-ink/70">
              Skip to the next step.
            </div>
          </button>
        </div>
      )}

      {hasOutstanding && (
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="font-heading font-semibold text-brand-ink">
              Invoices customers owe you (AR)
            </h3>
            <p className="text-sm text-brand-ink/70 mt-1">
              CSV with columns like Customer, Invoice #, Issue date, Due date,
              Amount.
            </p>
            {data.ar_ledger_rows.length === 0 ? (
              <label className="mt-3 flex items-center justify-center border-2 border-dashed border-surface-border rounded-xl p-6 cursor-pointer hover:bg-surface-muted">
                <Upload className="h-5 w-5 text-brand-ink/50 mr-2" />
                <span className="text-sm text-brand-ink">
                  Upload AR ledger CSV
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleArFile}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="mt-3 rounded-lg bg-brand-teal/5 border border-brand-teal/30 px-4 py-3 text-sm text-brand-ink flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-teal" />
                  {data.ar_ledger_rows.length} invoices ready to import
                </span>
                <button
                  type="button"
                  onClick={clearAr}
                  className="text-brand-ink/70 hover:text-brand-ink inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            )}
            {arError && (
              <div className="mt-2 rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-2 text-sm text-brand-ink">
                {arError}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-heading font-semibold text-brand-ink">
              Bills you owe suppliers (AP)
            </h3>
            <p className="text-sm text-brand-ink/70 mt-1">
              CSV with columns like Vendor, Bill date, Due date, Amount.
            </p>
            {data.ap_ledger_rows.length === 0 ? (
              <label className="mt-3 flex items-center justify-center border-2 border-dashed border-surface-border rounded-xl p-6 cursor-pointer hover:bg-surface-muted">
                <Upload className="h-5 w-5 text-brand-ink/50 mr-2" />
                <span className="text-sm text-brand-ink">
                  Upload AP ledger CSV
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleApFile}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="mt-3 rounded-lg bg-brand-teal/5 border border-brand-teal/30 px-4 py-3 text-sm text-brand-ink flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-teal" />
                  {data.ap_ledger_rows.length} bills ready to import
                </span>
                <button
                  type="button"
                  onClick={clearAp}
                  className="text-brand-ink/70 hover:text-brand-ink inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            )}
            {apError && (
              <div className="mt-2 rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-2 text-sm text-brand-ink">
                {apError}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {hasOutstanding !== null && (
          <Button onClick={onNext}>Next</Button>
        )}
      </div>
    </div>
  );
}

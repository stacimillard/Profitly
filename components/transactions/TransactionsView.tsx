'use client';

import { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Upload,
  TrendingUp,
  TrendingDown,
  Pencil,
  Trash2,
  X,
  Search,
  Sparkles,
} from 'lucide-react';
import type {
  Account,
  AccountType,
  BankAccount,
  Transaction,
  TransactionDirection,
  TransactionStatus,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RuleSuggestionBanner } from '@/components/RuleSuggestionBanner';
import {
  formatCurrency,
  formatDate,
  centsToDollars,
  dollarsToCents,
} from '@/lib/utils/format';

export type TransactionWithRelations = Transaction & {
  accounts: { name: string; type: AccountType } | null;
  bank_accounts: { name: string; last_four: string | null } | null;
  ai_account?: { name: string; type: AccountType } | null;
};

const ACCOUNT_GROUP_ORDER: AccountType[] = [
  'expense',
  'cost_of_goods',
  'revenue',
  'asset',
  'liability',
  'equity',
];

const ACCOUNT_GROUP_LABEL: Record<AccountType, string> = {
  expense: 'Expenses',
  cost_of_goods: 'Cost of goods',
  revenue: 'Revenue',
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
};

interface Props {
  initialTransactions: TransactionWithRelations[];
  accounts: Account[];
  bankAccounts: BankAccount[];
}

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; txn: TransactionWithRelations }
  | null;

const STATUS_FILTERS: { value: TransactionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'uncategorized', label: 'Needs a category' },
  { value: 'categorized', label: 'Categorized' },
  { value: 'reconciled', label: 'Reconciled' },
];

export function TransactionsView({
  initialTransactions,
  accounts,
  bankAccounts,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = (searchParams.get('status') as TransactionStatus | null) ?? 'all';
  const bankAccountFilter = searchParams.get('bank_account') ?? 'all';

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [lastCategorized, setLastCategorized] = useState<{
    txnId: string;
    vendorLabel: string;
    vendorPattern: string;
    accountId: string;
    accountName: string;
    isTaxDeductible: boolean;
  } | null>(null);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDirection, setFormDirection] = useState<TransactionDirection>(
    'money_out'
  );
  const [formBankAccountId, setFormBankAccountId] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formTaxDeductible, setFormTaxDeductible] = useState(false);
  const [formNotes, setFormNotes] = useState('');

  const accountsByType = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      revenue: [],
      cost_of_goods: [],
      expense: [],
      asset: [],
      liability: [],
      equity: [],
    };
    for (const a of accounts) groups[a.type].push(a);
    return groups;
  }, [accounts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return initialTransactions;
    const q = search.trim().toLowerCase();
    return initialTransactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.vendor_normalized ?? '').toLowerCase().includes(q) ||
        (t.accounts?.name ?? '').toLowerCase().includes(q)
    );
  }, [search, initialTransactions]);

  function setQueryParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function openAdd() {
    const today = new Date().toISOString().slice(0, 10);
    setFormDate(today);
    setFormDescription('');
    setFormAmount('');
    setFormDirection('money_out');
    setFormBankAccountId(bankAccounts[0]?.id ?? '');
    setFormAccountId('');
    setFormTaxDeductible(false);
    setFormNotes('');
    setError(null);
    setModal({ kind: 'add' });
  }

  function openEdit(txn: TransactionWithRelations) {
    setFormDate(txn.date);
    setFormDescription(txn.description);
    setFormAmount(centsToDollars(txn.amount_cents).toFixed(2));
    setFormDirection(txn.direction);
    setFormBankAccountId(txn.bank_account_id ?? '');
    setFormAccountId(txn.account_id ?? '');
    setFormTaxDeductible(txn.is_tax_deductible);
    setFormNotes(txn.notes ?? '');
    setError(null);
    setModal({ kind: 'edit', txn });
  }

  function closeModal() {
    setModal(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setSubmitting(true);
    setError(null);

    const isAdd = modal.kind === 'add';
    const url = isAdd
      ? '/api/transactions'
      : `/api/transactions/${modal.txn.id}`;
    const method = isAdd ? 'POST' : 'PATCH';

    const payload = {
      date: formDate,
      description: formDescription,
      amount_cents: dollarsToCents(formAmount),
      direction: formDirection,
      bank_account_id: formBankAccountId || null,
      account_id: formAccountId || null,
      is_tax_deductible: formTaxDeductible,
      notes: formNotes || null,
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the transaction.");
      return;
    }

    closeModal();
    router.refresh();
  }

  async function handleDelete(txn: TransactionWithRelations) {
    if (!window.confirm(`Delete "${txn.description}"? This can't be undone.`)) {
      return;
    }
    const res = await fetch(`/api/transactions/${txn.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body.error || "Couldn't delete that one.");
      return;
    }
    router.refresh();
  }

  async function handleInlineCategorize(
    txnId: string,
    accountId: string
  ) {
    const txn = initialTransactions.find((t) => t.id === txnId);
    const account = accounts.find((a) => a.id === accountId);

    const res = await fetch(`/api/transactions/${txnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId }),
    });
    if (!res.ok) return;

    if (txn && account && txn.vendor_normalized) {
      setLastCategorized({
        txnId,
        vendorLabel: txn.description,
        vendorPattern: txn.vendor_normalized,
        accountId,
        accountName: account.name,
        isTaxDeductible: txn.is_tax_deductible,
      });
    }
    router.refresh();
  }

  async function handleAskAI() {
    setAiLoading(true);
    setAiMessage(null);
    const res = await fetch('/api/ai-categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setAiLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setAiMessage({
        kind: 'error',
        text: body.error || "Couldn't reach the AI right now.",
      });
      return;
    }
    const body = await res.json();
    const count = body?.data?.suggested ?? 0;
    setAiMessage({
      kind: 'success',
      text:
        count === 0
          ? "No new suggestions — looks like everything's already sorted or already had a guess."
          : `Got suggestions for ${count} transaction${count === 1 ? '' : 's'}. Review the orange ✨ rows below.`,
    });
    router.refresh();
  }

  async function handleApproveAISuggestion(txn: TransactionWithRelations) {
    if (!txn.ai_suggested_account_id || !txn.ai_account) return;
    const res = await fetch(`/api/transactions/${txn.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: txn.ai_suggested_account_id }),
    });
    if (!res.ok) return;

    if (txn.vendor_normalized) {
      setLastCategorized({
        txnId: txn.id,
        vendorLabel: txn.description,
        vendorPattern: txn.vendor_normalized,
        accountId: txn.ai_suggested_account_id,
        accountName: txn.ai_account.name,
        isTaxDeductible: txn.is_tax_deductible,
      });
    }
    router.refresh();
  }

  const uncategorizedCount = useMemo(
    () => initialTransactions.filter((t) => t.status === 'uncategorized').length,
    [initialTransactions]
  );

  const similarCount = useMemo(() => {
    if (!lastCategorized) return 0;
    return initialTransactions.filter(
      (t) =>
        t.id !== lastCategorized.txnId &&
        t.status === 'uncategorized' &&
        t.vendor_normalized === lastCategorized.vendorPattern
    ).length;
  }, [initialTransactions, lastCategorized]);

  async function handleBulkCategorize() {
    if (selected.size === 0 || !bulkCategoryId) return;
    setSubmitting(true);
    const res = await fetch('/api/transactions/bulk-categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(selected),
        account_id: bulkCategoryId,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSelected(new Set());
      setBulkCategoryId('');
      router.refresh();
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  }

  function renderAccountOptions(includeEmpty = true) {
    return (
      <>
        {includeEmpty && <option value="">— Pick a category —</option>}
        {ACCOUNT_GROUP_ORDER.map((typeKey) => {
          const list = accountsByType[typeKey];
          if (list.length === 0) return null;
          return (
            <optgroup key={typeKey} label={ACCOUNT_GROUP_LABEL[typeKey]}>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
            Transactions
          </h1>
          <p className="mt-1 text-brand-ink/70">
            Every dollar in and out, sorted into the right categories.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {uncategorizedCount > 0 && (
            <Button
              variant="secondary"
              onClick={handleAskAI}
              loading={aiLoading}
            >
              <Sparkles className="h-4 w-4 text-brand-orange" />
              {aiLoading ? 'Thinking…' : 'Suggest with AI'}
            </Button>
          )}
          <Link
            href="/transactions/import"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-surface-border text-brand-ink font-medium text-sm hover:bg-surface-muted"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Link>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add transaction
          </Button>
        </div>
      </div>

      {aiMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
            aiMessage.kind === 'success'
              ? 'border-brand-teal/40 bg-brand-teal/5 text-brand-ink'
              : 'border-brand-pink/30 bg-brand-pink/15 text-brand-ink'
          }`}
        >
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 text-brand-orange shrink-0" aria-hidden />
            <span>{aiMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAiMessage(null)}
            className="p-1 rounded-md hover:bg-white text-brand-ink/60 shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Rule suggestion banner (after the user manually categorizes) */}
      {lastCategorized && similarCount >= 1 && (
        <RuleSuggestionBanner
          vendorLabel={lastCategorized.vendorLabel}
          matchPattern={lastCategorized.vendorPattern}
          matchField="vendor"
          matchType="contains"
          accountId={lastCategorized.accountId}
          accountName={lastCategorized.accountName}
          isTaxDeductible={lastCategorized.isTaxDeductible}
          similarCount={similarCount}
          onCreated={() => setLastCategorized(null)}
          onDismiss={() => setLastCategorized(null)}
        />
      )}

      {/* Filters */}
      <Card>
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() =>
                  setQueryParam('status', f.value === 'all' ? null : f.value)
                }
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  status === f.value
                    ? 'bg-brand-teal text-white'
                    : 'bg-surface-muted text-brand-ink/70 hover:bg-surface-border'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {bankAccounts.length > 0 && (
            <div className="min-w-[200px]">
              <select
                value={bankAccountFilter}
                onChange={(e) =>
                  setQueryParam(
                    'bank_account',
                    e.target.value === 'all' ? null : e.target.value
                  )
                }
                className="w-full px-3 py-1.5 rounded-lg border border-surface-border bg-white text-sm text-brand-ink"
              >
                <option value="all">All bank accounts</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-ink/40"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, vendor, category…"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-surface-border bg-white text-sm text-brand-ink placeholder:text-brand-ink/40"
            />
          </div>
        </div>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card className="border-brand-teal/40 bg-brand-teal/5">
          <div className="px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-brand-ink">
              {selected.size} selected
            </span>
            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-surface-border bg-white text-sm text-brand-ink"
            >
              {renderAccountOptions(true)}
            </select>
            <Button
              size="sm"
              onClick={handleBulkCategorize}
              disabled={!bulkCategoryId || submitting}
              loading={submitting}
            >
              Categorize all
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="p-1.5 rounded-md hover:bg-white text-brand-ink/70"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Upload}
            title={
              initialTransactions.length === 0
                ? 'No transactions yet.'
                : 'Nothing matches those filters.'
            }
            description={
              initialTransactions.length === 0
                ? 'Import your bank statement or add a transaction by hand to get started.'
                : 'Try clearing the filters or adjusting your search.'
            }
            action={
              initialTransactions.length === 0 ? (
                <div className="flex gap-2 justify-center">
                  <Link
                    href="/transactions/import"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90"
                  >
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Link>
                  <Button variant="secondary" onClick={openAdd}>
                    <Plus className="h-4 w-4" />
                    Add manually
                  </Button>
                </div>
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
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filtered.length > 0 && selected.size === filtered.length
                      }
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Bank</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-surface-border last:border-b-0 hover:bg-surface-muted/40"
                  >
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        aria-label={`Select ${t.description}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap text-brand-ink/80">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="text-left font-medium text-brand-ink hover:underline"
                      >
                        {t.description}
                      </button>
                      {t.is_tax_deductible && (
                        <Badge variant="info" className="ml-2">
                          Tax-deductible
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle hidden sm:table-cell text-brand-ink/70">
                      {t.bank_accounts?.name ?? '—'}
                    </td>
                    <td className="px-3 py-3 align-middle min-w-[240px]">
                      {t.status === 'uncategorized' ? (
                        <div className="space-y-1.5">
                          {t.ai_suggested_account_id && t.ai_account && (
                            <div className="flex items-center gap-2 text-sm">
                              <Sparkles
                                className="h-3.5 w-3.5 text-brand-orange shrink-0"
                                aria-hidden
                              />
                              <span className="text-brand-ink/80 truncate">
                                Looks like{' '}
                                <span className="font-medium">
                                  {t.ai_account.name}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleApproveAISuggestion(t)}
                                className="ml-auto text-brand-teal font-medium hover:underline whitespace-nowrap"
                              >
                                Use this
                              </button>
                            </div>
                          )}
                          <select
                            value=""
                            onChange={(e) =>
                              handleInlineCategorize(t.id, e.target.value)
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-surface-border bg-white text-sm text-brand-ink"
                          >
                            {renderAccountOptions(true)}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-brand-ink/80">
                            {t.accounts?.name ?? '—'}
                          </span>
                          {t.status === 'reconciled' && (
                            <Badge variant="success">Reconciled</Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
                      <div
                        className={`inline-flex items-center gap-1 font-semibold ${
                          t.direction === 'money_in'
                            ? 'text-green-700'
                            : 'text-brand-ink'
                        }`}
                      >
                        {t.direction === 'money_in' ? (
                          <TrendingUp className="h-4 w-4" aria-hidden />
                        ) : (
                          <TrendingDown className="h-4 w-4" aria-hidden />
                        )}
                        {t.direction === 'money_in' ? '+' : '−'}
                        {formatCurrency(t.amount_cents)}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded-md hover:bg-surface-muted text-brand-ink/70"
                          aria-label={`Edit ${t.description}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          className="p-1.5 rounded-md hover:bg-surface-muted text-brand-ink/70"
                          aria-label={`Delete ${t.description}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={modal !== null}
        onClose={closeModal}
        size="lg"
        title={modal?.kind === 'add' ? 'Add a transaction' : 'Edit transaction'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" form="txn-form" loading={submitting}>
              {modal?.kind === 'add' ? 'Add transaction' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="txn-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
            <Select
              label="Direction"
              value={formDirection}
              onChange={(e) =>
                setFormDirection(e.target.value as TransactionDirection)
              }
            >
              <option value="money_in">Money in</option>
              <option value="money_out">Money out</option>
            </Select>
          </div>
          <Input
            label="Description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="e.g. Office supplies — Staples"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
              required
            />
            <Select
              label="Bank account"
              value={formBankAccountId}
              onChange={(e) => setFormBankAccountId(e.target.value)}
            >
              <option value="">— None —</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <Select
            label="Category"
            value={formAccountId}
            onChange={(e) => setFormAccountId(e.target.value)}
          >
            {renderAccountOptions(true)}
          </Select>
          <label className="flex items-center gap-2 text-sm text-brand-ink">
            <input
              type="checkbox"
              checked={formTaxDeductible}
              onChange={(e) => setFormTaxDeductible(e.target.checked)}
            />
            Tax-deductible
          </label>
          <Input
            label="Notes (optional)"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Anything you want to remember about this one"
          />
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

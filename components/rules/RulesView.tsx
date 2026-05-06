'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Sparkles, Wand2 } from 'lucide-react';
import type {
  Account,
  AccountType,
  CategorizationRule,
  RuleMatchField,
  RuleMatchType,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export type RuleWithAccount = CategorizationRule & {
  accounts: { name: string; type: AccountType } | null;
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

const MATCH_FIELD_LABEL: Record<RuleMatchField, string> = {
  description: 'description',
  vendor: 'vendor',
};

const MATCH_TYPE_LABEL: Record<RuleMatchType, string> = {
  contains: 'contains',
  equals: 'equals',
  starts_with: 'starts with',
  ends_with: 'ends with',
};

interface Props {
  initialRules: RuleWithAccount[];
  accounts: Account[];
}

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; rule: RuleWithAccount }
  | null;

export function RulesView({ initialRules, accounts }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [accountId, setAccountId] = useState('');
  const [matchField, setMatchField] = useState<RuleMatchField>('description');
  const [matchType, setMatchType] = useState<RuleMatchType>('contains');
  const [matchPattern, setMatchPattern] = useState('');
  const [taxDeductible, setTaxDeductible] = useState(false);
  const [priority, setPriority] = useState('100');
  const [applyNow, setApplyNow] = useState(true);

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

  function openAdd() {
    setAccountId('');
    setMatchField('description');
    setMatchType('contains');
    setMatchPattern('');
    setTaxDeductible(false);
    setPriority('100');
    setApplyNow(true);
    setError(null);
    setModal({ kind: 'add' });
  }

  function openEdit(rule: RuleWithAccount) {
    setAccountId(rule.account_id);
    setMatchField(rule.match_field);
    setMatchType(rule.match_type);
    setMatchPattern(rule.match_pattern);
    setTaxDeductible(rule.is_tax_deductible);
    setPriority(String(rule.priority));
    setApplyNow(false);
    setError(null);
    setModal({ kind: 'edit', rule });
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
      ? '/api/categorization-rules'
      : `/api/categorization-rules/${modal.rule.id}`;
    const method = isAdd ? 'POST' : 'PATCH';

    const payload: Record<string, unknown> = {
      account_id: accountId,
      match_field: matchField,
      match_type: matchType,
      match_pattern: matchPattern,
      is_tax_deductible: taxDeductible,
      priority: parseInt(priority, 10) || 100,
    };
    if (isAdd) payload.apply_now = applyNow;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the rule.");
      return;
    }

    const body = await res.json();
    closeModal();
    if (isAdd && applyNow) {
      const count = body?.data?.applied_count ?? 0;
      setSuccessMessage(
        count === 0
          ? 'Rule saved. Nothing to retroactively categorize yet.'
          : `Rule saved — ${count} transaction${count === 1 ? '' : 's'} categorized.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    }
    router.refresh();
  }

  async function handleDelete(rule: RuleWithAccount) {
    if (
      !window.confirm(
        `Delete this rule? Future transactions matching "${rule.match_pattern}" won't be auto-categorized.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/categorization-rules/${rule.id}`, {
      method: 'DELETE',
    });
    if (res.ok) router.refresh();
  }

  async function toggleActive(rule: RuleWithAccount) {
    setSubmitting(true);
    await fetch(`/api/categorization-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    });
    setSubmitting(false);
    router.refresh();
  }

  function renderAccountOptions() {
    return (
      <>
        <option value="">— Pick a category —</option>
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
            Categorization rules
          </h1>
          <p className="mt-1 text-brand-ink/70">
            Tell us how to sort recurring transactions and we&apos;ll do it
            for you. Rules run automatically when you import or add a
            transaction.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add rule
        </Button>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-brand-teal/40 bg-brand-teal/10 px-4 py-3 text-sm text-brand-ink flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-teal" aria-hidden />
          {successMessage}
        </div>
      )}

      {initialRules.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wand2}
            title="No rules yet."
            description="Set up your first rule and we'll auto-categorize matching transactions every time they show up."
            action={
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add a rule
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-brand-ink/60 border-b border-surface-border">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2 hidden md:table-cell">Priority</th>
                  <th className="px-4 py-2 hidden md:table-cell">Used</th>
                  <th className="px-4 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {initialRules.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-surface-border last:border-b-0 hover:bg-surface-muted/40 ${
                      !r.is_active ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="text-brand-ink">
                        {MATCH_FIELD_LABEL[r.match_field]}{' '}
                        {MATCH_TYPE_LABEL[r.match_type]}{' '}
                        <span className="font-medium">
                          &ldquo;{r.match_pattern}&rdquo;
                        </span>
                      </div>
                      {!r.is_active && (
                        <Badge variant="muted" className="mt-1">
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-brand-ink">
                          {r.accounts?.name ?? '—'}
                        </span>
                        {r.is_tax_deductible && (
                          <Badge variant="info">Tax-deductible</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle hidden md:table-cell text-brand-ink/70">
                      {r.priority}
                    </td>
                    <td className="px-4 py-3 align-middle hidden md:table-cell text-brand-ink/70">
                      {r.times_applied}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => toggleActive(r)}
                          className="px-2 py-1 rounded-md text-xs font-medium text-brand-ink/70 hover:bg-surface-muted"
                          title={r.is_active ? 'Pause this rule' : 'Resume this rule'}
                        >
                          {r.is_active ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-md hover:bg-surface-muted text-brand-ink/70"
                          aria-label="Edit rule"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          className="p-1.5 rounded-md hover:bg-surface-muted text-brand-ink/70"
                          aria-label="Delete rule"
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

      <Modal
        open={modal !== null}
        onClose={closeModal}
        size="lg"
        title={modal?.kind === 'add' ? 'Add a rule' : 'Edit rule'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" form="rule-form" loading={submitting}>
              {modal?.kind === 'add' ? 'Add rule' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="rule-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="When the"
              value={matchField}
              onChange={(e) =>
                setMatchField(e.target.value as RuleMatchField)
              }
            >
              <option value="description">Description</option>
              <option value="vendor">Vendor</option>
            </Select>
            <Select
              label="Match type"
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as RuleMatchType)}
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="starts_with">Starts with</option>
              <option value="ends_with">Ends with</option>
            </Select>
            <Input
              label="This text"
              value={matchPattern}
              onChange={(e) => setMatchPattern(e.target.value)}
              placeholder="e.g. starbucks"
              required
            />
          </div>

          <Select
            label="Categorize as"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            {renderAccountOptions()}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Priority"
              type="number"
              inputMode="numeric"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              helperText="Lower numbers run first when multiple rules match."
            />
            <label className="flex items-center gap-2 text-sm text-brand-ink mt-7">
              <input
                type="checkbox"
                checked={taxDeductible}
                onChange={(e) => setTaxDeductible(e.target.checked)}
              />
              Mark matched transactions tax-deductible
            </label>
          </div>

          {modal?.kind === 'add' && (
            <label className="flex items-start gap-2 text-sm text-brand-ink rounded-lg bg-brand-teal/5 border border-brand-teal/20 p-3">
              <input
                type="checkbox"
                checked={applyNow}
                onChange={(e) => setApplyNow(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Apply to existing transactions</span>{' '}
                — also categorize any uncategorized transactions that match
                this rule right now.
              </span>
            </label>
          )}

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

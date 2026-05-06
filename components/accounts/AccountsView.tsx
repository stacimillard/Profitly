'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, EyeOff, Eye, BookOpen } from 'lucide-react';
import type { Account, AccountType } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

const TYPE_LABEL: Record<AccountType, string> = {
  revenue: 'Revenue',
  cost_of_goods: 'Cost of goods sold',
  expense: 'Expenses',
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
};

const TYPE_DESCRIPTION: Record<AccountType, string> = {
  revenue: 'Money coming into your business.',
  cost_of_goods: 'Direct costs tied to what you sell.',
  expense: 'Day-to-day operating costs.',
  asset: 'Things you own.',
  liability: 'Things you owe.',
  equity: 'Your stake in the business.',
};

const TYPE_ORDER: AccountType[] = [
  'revenue',
  'cost_of_goods',
  'expense',
  'asset',
  'liability',
  'equity',
];

interface AccountsViewProps {
  initialAccounts: Account[];
}

type ModalMode = { kind: 'add' } | { kind: 'edit'; account: Account } | null;

export function AccountsView({ initialAccounts }: AccountsViewProps) {
  const router = useRouter();
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<ModalMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('expense');
  const [description, setDescription] = useState('');

  function openAdd() {
    setName('');
    setType('expense');
    setDescription('');
    setError(null);
    setModal({ kind: 'add' });
  }

  function openEdit(account: Account) {
    setName(account.name);
    setType(account.type);
    setDescription(account.description ?? '');
    setError(null);
    setModal({ kind: 'edit', account });
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
    const url = isAdd ? '/api/accounts' : `/api/accounts/${modal.account.id}`;
    const method = isAdd ? 'POST' : 'PATCH';
    const payload = isAdd
      ? { name, type, description }
      : { name, description };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the account.");
      return;
    }

    closeModal();
    router.refresh();
  }

  async function toggleActive(account: Account) {
    setSubmitting(true);
    const res = await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !account.is_active }),
    });
    setSubmitting(false);
    if (res.ok) router.refresh();
  }

  const groupedActive = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      revenue: [],
      cost_of_goods: [],
      expense: [],
      asset: [],
      liability: [],
      equity: [],
    };
    for (const acc of initialAccounts) {
      if (acc.is_active) groups[acc.type].push(acc);
    }
    return groups;
  }, [initialAccounts]);

  const inactive = useMemo(
    () => initialAccounts.filter((a) => !a.is_active),
    [initialAccounts]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
            Your accounts
          </h1>
          <p className="mt-1 text-brand-ink/70">
            These are the buckets we use to sort your money. We&apos;ve set up
            the basics — add your own when you need to.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add account
        </Button>
      </div>

      {initialAccounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No accounts yet."
            description="Add your first account to start sorting your money."
            action={
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.map((typeKey) => {
            const list = groupedActive[typeKey];
            if (list.length === 0) return null;
            return (
              <Card key={typeKey}>
                <div className="px-5 py-4 border-b border-surface-border">
                  <h2 className="font-heading font-semibold text-brand-ink">
                    {TYPE_LABEL[typeKey]}
                  </h2>
                  <p className="text-sm text-brand-ink/60">
                    {TYPE_DESCRIPTION[typeKey]}
                  </p>
                </div>
                <ul>
                  {list.map((acc) => (
                    <li
                      key={acc.id}
                      className="flex items-center gap-3 px-5 py-3 border-b border-surface-border last:border-b-0 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-brand-ink">
                            {acc.name}
                          </span>
                          {acc.is_default && (
                            <Badge variant="muted">Default</Badge>
                          )}
                        </div>
                        {acc.description && (
                          <p className="text-sm text-brand-ink/60 truncate">
                            {acc.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openEdit(acc)}
                          className="p-2 rounded-md hover:bg-surface-muted text-brand-ink/70"
                          aria-label={`Edit ${acc.name}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(acc)}
                          disabled={submitting}
                          className="p-2 rounded-md hover:bg-surface-muted text-brand-ink/70"
                          aria-label={`Deactivate ${acc.name}`}
                          title="Deactivate"
                        >
                          <EyeOff className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}

          {inactive.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowInactive((s) => !s)}
                className="text-sm text-brand-ink/70 hover:text-brand-ink"
              >
                {showInactive ? 'Hide' : 'Show'} inactive ({inactive.length})
              </button>
              {showInactive && (
                <Card className="mt-2 opacity-80">
                  <ul>
                    {inactive.map((acc) => (
                      <li
                        key={acc.id}
                        className="flex items-center gap-3 px-5 py-3 border-b border-surface-border last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-brand-ink line-through">
                              {acc.name}
                            </span>
                            <Badge variant="muted">{TYPE_LABEL[acc.type]}</Badge>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleActive(acc)}
                          disabled={submitting}
                          className="p-2 rounded-md hover:bg-surface-muted text-brand-ink/70"
                          aria-label={`Reactivate ${acc.name}`}
                          title="Reactivate"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal?.kind === 'add' ? 'Add an account' : 'Edit account'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" form="account-form" loading={submitting}>
              {modal?.kind === 'add' ? 'Add account' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="account-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Coaching Sessions"
            required
            autoFocus
          />
          {modal?.kind === 'add' && (
            <Select
              label="What kind of account is this?"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              helperText={TYPE_DESCRIPTION[type]}
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this account for?"
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

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Pencil,
  EyeOff,
  Eye,
  Landmark,
  PiggyBank,
  CreditCard,
} from 'lucide-react';
import type { BankAccount, BankAccountType } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  formatCurrency,
  centsToDollars,
  dollarsToCents,
} from '@/lib/utils/format';

const TYPE_LABEL: Record<BankAccountType, string> = {
  chequing: 'Chequing',
  savings: 'Savings',
  credit_card: 'Credit card',
};

const TYPE_GROUP_LABEL: Record<BankAccountType, string> = {
  chequing: 'Chequing accounts',
  savings: 'Savings accounts',
  credit_card: 'Credit cards',
};

const TYPE_ICON: Record<BankAccountType, typeof Landmark> = {
  chequing: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
};

const TYPE_ORDER: BankAccountType[] = ['chequing', 'savings', 'credit_card'];

interface BankAccountsViewProps {
  initialAccounts: BankAccount[];
}

type ModalMode =
  | { kind: 'add' }
  | { kind: 'edit'; account: BankAccount }
  | null;

export function BankAccountsView({ initialAccounts }: BankAccountsViewProps) {
  const router = useRouter();
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<ModalMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<BankAccountType>('chequing');
  const [institution, setInstitution] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [balance, setBalance] = useState('0.00');

  function openAdd() {
    setName('');
    setType('chequing');
    setInstitution('');
    setLastFour('');
    setBalance('0.00');
    setError(null);
    setModal({ kind: 'add' });
  }

  function openEdit(account: BankAccount) {
    setName(account.name);
    setType(account.type);
    setInstitution(account.institution ?? '');
    setLastFour(account.last_four ?? '');
    setBalance(centsToDollars(account.current_balance_cents).toFixed(2));
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
    const url = isAdd
      ? '/api/bank-accounts'
      : `/api/bank-accounts/${modal.account.id}`;
    const method = isAdd ? 'POST' : 'PATCH';

    const balanceCents = dollarsToCents(balance);
    const payload = isAdd
      ? {
          name,
          type,
          institution: institution || null,
          last_four: lastFour || null,
          current_balance_cents: balanceCents,
        }
      : {
          name,
          institution: institution || null,
          last_four: lastFour || null,
          current_balance_cents: balanceCents,
        };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the bank account.");
      return;
    }

    closeModal();
    router.refresh();
  }

  async function toggleActive(account: BankAccount) {
    setSubmitting(true);
    const res = await fetch(`/api/bank-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !account.is_active }),
    });
    setSubmitting(false);
    if (res.ok) router.refresh();
  }

  const grouped = useMemo(() => {
    const groups: Record<BankAccountType, BankAccount[]> = {
      chequing: [],
      savings: [],
      credit_card: [],
    };
    for (const a of initialAccounts) {
      if (a.is_active) groups[a.type].push(a);
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
            Your bank accounts
          </h1>
          <p className="mt-1 text-brand-ink/70">
            Add the chequing, savings, and credit cards your business uses.
            We&apos;ll match transactions to the right one when you import.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add bank account
        </Button>
      </div>

      {initialAccounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="No bank accounts yet."
            description="Add your first one so we can keep track of your money."
            action={
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add bank account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.map((typeKey) => {
            const list = grouped[typeKey];
            if (list.length === 0) return null;
            const Icon = TYPE_ICON[typeKey];
            return (
              <Card key={typeKey}>
                <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
                  <Icon className="h-5 w-5 text-brand-teal" aria-hidden />
                  <h2 className="font-heading font-semibold text-brand-ink">
                    {TYPE_GROUP_LABEL[typeKey]}
                  </h2>
                </div>
                <ul>
                  {list.map((acc) => (
                    <li
                      key={acc.id}
                      className="flex items-center gap-3 px-5 py-4 border-b border-surface-border last:border-b-0 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-brand-ink">
                            {acc.name}
                          </span>
                          {acc.last_four && (
                            <span className="text-xs text-brand-ink/60">
                              •••• {acc.last_four}
                            </span>
                          )}
                        </div>
                        {acc.institution && (
                          <p className="text-sm text-brand-ink/60">
                            {acc.institution}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-brand-ink/60">
                          {acc.type === 'credit_card' ? 'Owed' : 'Balance'}
                        </div>
                        <div className="font-semibold text-brand-ink">
                          {formatCurrency(acc.current_balance_cents)}
                        </div>
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
        title={
          modal?.kind === 'add' ? 'Add a bank account' : 'Edit bank account'
        }
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="bank-account-form"
              loading={submitting}
            >
              {modal?.kind === 'add' ? 'Add account' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form
          id="bank-account-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. TD Business Chequing"
            required
            autoFocus
          />
          {modal?.kind === 'add' && (
            <Select
              label="What kind of account is this?"
              value={type}
              onChange={(e) => setType(e.target.value as BankAccountType)}
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
          <Input
            label="Bank or card issuer (optional)"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. TD, RBC, Amex"
          />
          <Input
            label="Last 4 digits (optional)"
            value={lastFour}
            onChange={(e) =>
              setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            placeholder="1234"
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
          />
          <Input
            label={
              type === 'credit_card'
                ? 'Current balance owed'
                : 'Current balance'
            }
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            type="number"
            step="0.01"
            inputMode="decimal"
            helperText={
              type === 'credit_card'
                ? 'How much you currently owe on the card.'
                : "What's in the account right now."
            }
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

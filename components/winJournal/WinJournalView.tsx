'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles, Pencil, Trash2 } from 'lucide-react';
import type { WinJournalEntry } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Confetti } from '@/components/ui/Confetti';
import {
  formatCurrency,
  formatDate,
  centsToDollars,
  dollarsToCents,
} from '@/lib/utils/format';

interface Props {
  initialEntries: WinJournalEntry[];
}

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; entry: WinJournalEntry }
  | null;

export function WinJournalView({ initialEntries }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  function openAdd() {
    setTitle('');
    setDescription('');
    setAmount('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setError(null);
    setModal({ kind: 'add' });
  }

  function openEdit(entry: WinJournalEntry) {
    setTitle(entry.title);
    setDescription(entry.description ?? '');
    setAmount(
      entry.amount_cents !== null
        ? centsToDollars(entry.amount_cents).toFixed(2)
        : ''
    );
    setEntryDate(entry.entry_date);
    setError(null);
    setModal({ kind: 'edit', entry });
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
      ? '/api/win-journal'
      : `/api/win-journal/${modal.entry.id}`;
    const method = isAdd ? 'POST' : 'PATCH';

    const payload = {
      title,
      description: description || null,
      amount_cents: amount ? dollarsToCents(amount) : null,
      entry_date: entryDate,
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the win.");
      return;
    }
    closeModal();
    if (isAdd) setConfetti(true);
    router.refresh();
  }

  async function handleDelete(entry: WinJournalEntry) {
    if (!window.confirm(`Remove "${entry.title}" from your wins?`)) return;
    const res = await fetch(`/api/win-journal/${entry.id}`, {
      method: 'DELETE',
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <Confetti active={confetti} onComplete={() => setConfetti(false)} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
            Win journal
          </h1>
          <p className="mt-1 text-brand-ink/70">
            Save the wins so you remember what&apos;s working. Big revenue
            moments, hard decisions, brave asks — they all count.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" />
          Save a win
        </Button>
      </div>

      {initialEntries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Your wins live here."
            description="What's something you're proud of this week? Save it before you forget."
            action={
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Save your first win
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {initialEntries.map((w) => (
            <li key={w.id}>
              <Card className="group">
                <CardBody>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-orange/15 flex items-center justify-center text-brand-orange shrink-0">
                      <Sparkles className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="font-heading font-semibold text-brand-ink">
                          {w.title}
                        </h3>
                        <span className="text-xs text-brand-ink/60">
                          {formatDate(w.entry_date)}
                        </span>
                        {w.amount_cents !== null && (
                          <span className="text-sm font-medium text-brand-teal">
                            {formatCurrency(w.amount_cents)}
                          </span>
                        )}
                      </div>
                      {w.description && (
                        <p className="mt-1 text-sm text-brand-ink/80 leading-relaxed">
                          {w.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(w)}
                        className="p-1.5 rounded-md hover:bg-surface-muted text-brand-ink/70"
                        aria-label="Edit win"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(w)}
                        className="p-1.5 rounded-md hover:bg-surface-muted text-brand-ink/70"
                        aria-label="Delete win"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal?.kind === 'add' ? 'Save a win' : 'Edit win'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" form="win-form" loading={submitting}>
              {modal?.kind === 'add' ? 'Save win' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="win-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="What's the win?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Landed a 6-month retainer"
            required
            autoFocus
          />
          <Input
            label="Tell me more (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What made this one special?"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (optional)"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              helperText="If it had a $ value."
            />
            <Input
              label="When"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
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

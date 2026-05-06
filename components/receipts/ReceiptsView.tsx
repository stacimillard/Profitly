'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  Pencil,
  X,
  Search,
  ExternalLink,
} from 'lucide-react';
import type { Receipt } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReceiptUploader } from '@/components/ReceiptUploader';
import {
  formatCurrency,
  formatDate,
  centsToDollars,
  dollarsToCents,
} from '@/lib/utils/format';

export type ReceiptWithTransaction = Receipt & {
  signed_url: string | null;
  transactions: {
    id: string;
    date: string;
    description: string;
    amount_cents: number;
    direction: 'money_in' | 'money_out';
  } | null;
};

export interface UnmatchedTransaction {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  direction: 'money_in' | 'money_out';
}

interface Props {
  initialReceipts: ReceiptWithTransaction[];
  unmatchedTransactions: UnmatchedTransaction[];
}

type ModalState =
  | { kind: 'detail'; receipt: ReceiptWithTransaction }
  | { kind: 'match'; receipt: ReceiptWithTransaction }
  | null;

export function ReceiptsView({ initialReceipts, unmatchedTransactions }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vendor, setVendor] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [amount, setAmount] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [matchSearch, setMatchSearch] = useState('');

  const unmatched = useMemo(
    () => initialReceipts.filter((r) => r.status === 'unmatched'),
    [initialReceipts]
  );
  const matched = useMemo(
    () => initialReceipts.filter((r) => r.status === 'matched'),
    [initialReceipts]
  );

  function openDetail(receipt: ReceiptWithTransaction) {
    setVendor(receipt.vendor ?? '');
    setReceiptDate(receipt.receipt_date ?? '');
    setAmount(
      receipt.amount_cents !== null
        ? centsToDollars(receipt.amount_cents).toFixed(2)
        : ''
    );
    setGstAmount(
      receipt.gst_hst_amount_cents
        ? centsToDollars(receipt.gst_hst_amount_cents).toFixed(2)
        : ''
    );
    setNotes(receipt.notes ?? '');
    setError(null);
    setModal({ kind: 'detail', receipt });
  }

  function openMatch(receipt: ReceiptWithTransaction) {
    setMatchSearch('');
    setError(null);
    setModal({ kind: 'match', receipt });
  }

  function closeModal() {
    setModal(null);
    setError(null);
  }

  async function saveMetadata(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.kind !== 'detail') return;
    setSubmitting(true);
    setError(null);

    const payload = {
      vendor: vendor || null,
      receipt_date: receiptDate || null,
      amount_cents: amount ? dollarsToCents(amount) : null,
      gst_hst_amount_cents: gstAmount ? dollarsToCents(gstAmount) : 0,
      notes: notes || null,
    };

    const res = await fetch(`/api/receipts/${modal.receipt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the receipt.");
      return;
    }
    closeModal();
    router.refresh();
  }

  async function handleDelete(receipt: ReceiptWithTransaction) {
    if (
      !window.confirm(
        `Delete this receipt${
          receipt.vendor ? ` from ${receipt.vendor}` : ''
        }? This can't be undone.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/receipts/${receipt.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      closeModal();
      router.refresh();
    }
  }

  async function handleMatch(transactionId: string) {
    if (modal?.kind !== 'match') return;
    setSubmitting(true);
    const res = await fetch(`/api/receipts/${modal.receipt.id}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: transactionId }),
    });
    setSubmitting(false);
    if (res.ok) {
      closeModal();
      router.refresh();
    }
  }

  async function handleUnmatch(receipt: ReceiptWithTransaction) {
    setSubmitting(true);
    const res = await fetch(`/api/receipts/${receipt.id}/match`, {
      method: 'DELETE',
    });
    setSubmitting(false);
    if (res.ok) {
      closeModal();
      router.refresh();
    }
  }

  const filteredCandidates = useMemo(() => {
    const q = matchSearch.trim().toLowerCase();
    if (modal?.kind !== 'match') return [];

    // Prefer transactions with a matching amount (within ~$1) when receipt amount known.
    const target = modal.receipt.amount_cents;
    const list = unmatchedTransactions
      .filter((t) =>
        q
          ? t.description.toLowerCase().includes(q) ||
            String(centsToDollars(t.amount_cents).toFixed(2)).includes(q)
          : true
      )
      .sort((a, b) => {
        if (target == null) return 0;
        return (
          Math.abs(a.amount_cents - target) - Math.abs(b.amount_cents - target)
        );
      });
    return list;
  }, [matchSearch, modal, unmatchedTransactions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
          Receipts
        </h1>
        <p className="mt-1 text-brand-ink/70">
          Snap or upload your receipts here. We&apos;ll keep them organized and
          link them to the matching transactions.
        </p>
      </div>

      <Card>
        <div className="p-4">
          <ReceiptUploader />
        </div>
      </Card>

      {/* Unmatched section */}
      {unmatched.length > 0 && (
        <section>
          <h2 className="font-heading font-semibold text-brand-ink mb-3 flex items-center gap-2">
            Needs a match
            <Badge variant="warning">{unmatched.length}</Badge>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {unmatched.map((r) => (
              <ReceiptCard
                key={r.id}
                receipt={r}
                onView={() => openDetail(r)}
                onMatch={() => openMatch(r)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Matched section */}
      {matched.length > 0 && (
        <section>
          <h2 className="font-heading font-semibold text-brand-ink mb-3">
            Matched
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {matched.map((r) => (
              <ReceiptCard
                key={r.id}
                receipt={r}
                onView={() => openDetail(r)}
              />
            ))}
          </div>
        </section>
      )}

      {initialReceipts.length === 0 && (
        <Card>
          <EmptyState
            icon={ImageIcon}
            title="No receipts yet."
            description="Drop your first receipt above. We accept photos and PDFs up to 10 MB."
          />
        </Card>
      )}

      {/* Detail modal */}
      <Modal
        open={modal?.kind === 'detail'}
        onClose={closeModal}
        size="lg"
        title="Receipt details"
        footer={
          <>
            <Button
              variant="danger"
              type="button"
              onClick={() =>
                modal?.kind === 'detail' && handleDelete(modal.receipt)
              }
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="receipt-form"
              loading={submitting}
            >
              Save
            </Button>
          </>
        }
      >
        {modal?.kind === 'detail' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <ReceiptPreview receipt={modal.receipt} large />
              {modal.receipt.signed_url && (
                <a
                  href={modal.receipt.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-brand-teal hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in new tab
                </a>
              )}
            </div>
            <div>
              <form
                id="receipt-form"
                onSubmit={saveMetadata}
                className="space-y-3"
              >
                <Input
                  label="Vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. Staples"
                />
                <Input
                  label="Date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Amount"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <Input
                    label="GST/HST"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Input
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you want to remember"
                />
                {error && (
                  <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-3 py-2 text-sm text-brand-ink">
                    {error}
                  </div>
                )}
              </form>

              <div className="mt-5 pt-5 border-t border-surface-border">
                {modal.receipt.transactions ? (
                  <div>
                    <p className="text-sm text-brand-ink/60 mb-1">
                      Linked to
                    </p>
                    <p className="font-medium text-brand-ink">
                      {modal.receipt.transactions.description}
                    </p>
                    <p className="text-sm text-brand-ink/60">
                      {formatDate(modal.receipt.transactions.date)} ·{' '}
                      {formatCurrency(modal.receipt.transactions.amount_cents)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleUnmatch(modal.receipt)}
                      className="mt-2 text-sm text-brand-teal hover:underline"
                    >
                      Unlink
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openMatch(modal.receipt)}
                  >
                    <LinkIcon className="h-4 w-4" />
                    Match to a transaction
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Match modal */}
      <Modal
        open={modal?.kind === 'match'}
        onClose={closeModal}
        size="lg"
        title="Match to a transaction"
        footer={
          <Button variant="secondary" type="button" onClick={closeModal}>
            Cancel
          </Button>
        }
      >
        {modal?.kind === 'match' && (
          <div>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-surface-muted">
              <ReceiptPreview receipt={modal.receipt} small />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-brand-ink truncate">
                  {modal.receipt.vendor || modal.receipt.file_name}
                </p>
                <p className="text-sm text-brand-ink/60">
                  {modal.receipt.receipt_date
                    ? formatDate(modal.receipt.receipt_date)
                    : '—'}{' '}
                  ·{' '}
                  {modal.receipt.amount_cents !== null
                    ? formatCurrency(modal.receipt.amount_cents)
                    : 'amount unknown'}
                </p>
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
                No matching transactions yet. Add one or import a CSV first.
              </p>
            ) : (
              <ul className="border border-surface-border rounded-lg divide-y divide-surface-border max-h-80 overflow-y-auto">
                {filteredCandidates.slice(0, 50).map((t) => (
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

interface CardProps {
  receipt: ReceiptWithTransaction;
  onView: () => void;
  onMatch?: () => void;
}

function ReceiptCard({ receipt, onView, onMatch }: CardProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-white shadow-card overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={onView}
        className="aspect-square bg-surface-muted/40 flex items-center justify-center overflow-hidden"
      >
        <ReceiptPreview receipt={receipt} fillCard />
      </button>
      <div className="p-3 text-sm flex-1 flex flex-col">
        <div className="font-medium text-brand-ink truncate">
          {receipt.vendor || receipt.file_name}
        </div>
        <div className="text-xs text-brand-ink/60 mt-0.5">
          {receipt.receipt_date ? formatDate(receipt.receipt_date) : '—'}
          {receipt.amount_cents !== null && (
            <> · {formatCurrency(receipt.amount_cents)}</>
          )}
        </div>
        <div className="mt-3 flex items-center gap-1">
          {onMatch && (
            <button
              type="button"
              onClick={onMatch}
              className="flex-1 text-xs font-medium text-brand-teal hover:underline text-left"
            >
              Match
            </button>
          )}
          <button
            type="button"
            onClick={onView}
            className="text-xs font-medium text-brand-ink/70 hover:text-brand-ink"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

interface PreviewProps {
  receipt: ReceiptWithTransaction;
  large?: boolean;
  small?: boolean;
  fillCard?: boolean;
}

function ReceiptPreview({ receipt, large, small, fillCard }: PreviewProps) {
  const isImage = receipt.mime_type?.startsWith('image/');
  if (small) {
    return (
      <div className="h-12 w-12 rounded-md bg-white flex items-center justify-center overflow-hidden">
        {isImage && receipt.signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={receipt.signed_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <FileText className="h-5 w-5 text-brand-ink/50" />
        )}
      </div>
    );
  }
  if (large) {
    return isImage && receipt.signed_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={receipt.signed_url}
        alt={receipt.vendor || receipt.file_name}
        className="w-full max-h-[60vh] object-contain rounded-lg border border-surface-border bg-surface-muted/30"
      />
    ) : (
      <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-surface-border bg-surface-muted/40">
        <FileText className="h-12 w-12 text-brand-ink/40 mb-2" />
        <span className="text-sm text-brand-ink/70 truncate max-w-full px-4">
          {receipt.file_name}
        </span>
        {receipt.signed_url && (
          <a
            href={receipt.signed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-sm text-brand-teal hover:underline"
          >
            Open PDF
          </a>
        )}
      </div>
    );
  }
  // fillCard / default
  return isImage && receipt.signed_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={receipt.signed_url}
      alt=""
      className={fillCard ? 'h-full w-full object-cover' : ''}
    />
  ) : (
    <FileText className="h-8 w-8 text-brand-ink/40" />
  );
}

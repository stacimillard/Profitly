'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  formatCurrency,
  dollarsToCents,
} from '@/lib/utils/format';

interface Props {
  defaultInvoiceNumber: string;
  defaultGstHstRate: number;
}

interface LineRow {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

function newRow(): LineRow {
  return {
    id: Math.random().toString(36).slice(2),
    description: '',
    quantity: '1',
    unit_price: '0.00',
  };
}

export function InvoiceFormView({
  defaultInvoiceNumber,
  defaultGstHstRate,
}: Props) {
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const due30 = in30.toISOString().slice(0, 10);

  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(due30);
  const [taxRate, setTaxRate] = useState(
    (defaultGstHstRate * 100).toFixed(2)
  );
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineRow[]>([newRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(id: string, patch: Partial<LineRow>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }
  function addRow() {
    setItems((prev) => [...prev, newRow()]);
  }
  function removeRow(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  const totals = useMemo(() => {
    let subtotalCents = 0;
    for (const it of items) {
      const qty = parseFloat(it.quantity || '0') || 0;
      const unitCents = dollarsToCents(it.unit_price || '0');
      subtotalCents += Math.round(qty * unitCents);
    }
    const rate = (parseFloat(taxRate || '0') || 0) / 100;
    const taxCents = Math.round(subtotalCents * rate);
    return {
      subtotal_cents: subtotalCents,
      tax_cents: taxCents,
      total_cents: subtotalCents + taxCents,
      rate,
    };
  }, [items, taxRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      invoice_number: invoiceNumber,
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_address: customerAddress || null,
      issue_date: issueDate,
      due_date: dueDate,
      gst_hst_rate: totals.rate,
      notes: notes || null,
      items: items.map((it) => ({
        description: it.description,
        quantity: parseFloat(it.quantity || '0') || 0,
        unit_price_cents: dollarsToCents(it.unit_price || '0'),
      })),
    };

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the invoice.");
      return;
    }
    const body = await res.json();
    router.push(`/invoices/${body.data.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </Link>
        <h1 className="mt-2 font-heading font-bold text-3xl text-brand-ink leading-tight">
          New invoice
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Invoice number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
              <Input
                label="Issue date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                placeholder="Acme Inc."
              />
              <Input
                label="Customer email (optional)"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="billing@acme.com"
              />
            </div>
            <Input
              label="Customer address (optional)"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="123 Bay Street, Toronto, ON"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
              <Input
                label="GST/HST rate (%)"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                helperText="Use 0 if you're not registered."
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="font-heading font-semibold text-brand-ink mb-3">
              Line items
            </h2>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className="grid grid-cols-12 gap-2 items-end"
                >
                  <div className="col-span-12 sm:col-span-6">
                    <Input
                      label={idx === 0 ? 'Description' : undefined}
                      value={it.description}
                      onChange={(e) =>
                        updateItem(it.id, { description: e.target.value })
                      }
                      placeholder="What did you bill for?"
                      required
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      label={idx === 0 ? 'Qty' : undefined}
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(it.id, { quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-7 sm:col-span-3">
                    <Input
                      label={idx === 0 ? 'Unit price' : undefined}
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={it.unit_price}
                      onChange={(e) =>
                        updateItem(it.id, { unit_price: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(it.id)}
                        className="p-2 rounded-md hover:bg-surface-muted text-brand-ink/60"
                        aria-label="Remove line"
                        title="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:underline"
            >
              <Plus className="h-4 w-4" />
              Add line
            </button>

            <div className="mt-6 pt-4 border-t border-surface-border space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-ink/70">Subtotal</span>
                <span className="font-medium text-brand-ink">
                  {formatCurrency(totals.subtotal_cents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-ink/70">
                  GST/HST ({(totals.rate * 100).toFixed(2)}%)
                </span>
                <span className="font-medium text-brand-ink">
                  {formatCurrency(totals.tax_cents)}
                </span>
              </div>
              <div className="flex justify-between text-base">
                <span className="font-semibold text-brand-ink">Total</span>
                <span className="font-heading font-bold text-brand-ink">
                  {formatCurrency(totals.total_cents)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Input
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment instructions, thank you note, etc."
            />
          </CardBody>
        </Card>

        {error && (
          <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href="/invoices"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-surface-border text-brand-ink font-medium text-sm hover:bg-surface-muted"
          >
            Cancel
          </Link>
          <Button type="submit" loading={submitting}>
            Save invoice
          </Button>
        </div>
      </form>
    </div>
  );
}

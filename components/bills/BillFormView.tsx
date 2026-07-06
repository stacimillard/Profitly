'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { dollarsToCents } from '@/lib/utils/format';
import type { Account } from '@/lib/types';

interface Props {
  expenseAccounts: Account[];
}

export function BillFormView({ expenseAccounts }: Props) {
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const due30 = in30.toISOString().slice(0, 10);

  const [vendorName, setVendorName] = useState('');
  const [billDate, setBillDate] = useState(today);
  const [dueDate, setDueDate] = useState(due30);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_name: vendorName,
        bill_date: billDate,
        due_date: dueDate,
        amount_cents: dollarsToCents(amount || '0'),
        account_id: accountId || null,
        notes: notes || null,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the bill.");
      return;
    }
    const body = await res.json();
    router.push(`/bills/${body.data.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/bills"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bills
        </Link>
        <h1 className="mt-2 font-heading font-bold text-3xl text-brand-ink leading-tight">
          New bill
        </h1>
        <p className="mt-1 text-brand-ink/70">
          Log a bill as soon as it comes in — even if you don&apos;t pay it
          right away. That way you won&apos;t miss anything.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardBody className="space-y-4">
            <Input
              label="Who's the bill from?"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Landlord, phone company, supplier..."
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Date of the bill"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                required
              />
              <Input
                label="When is it due?"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <Input
              label="How much?"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
            <Select
              label="Category (optional — pick when you pay)"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              helperText="This is the expense category we'll book against when the bill is paid."
            >
              <option value="">— Choose later —</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <div>
              <label className="block text-sm font-medium text-brand-ink mb-1">
                Notes (optional)
              </label>
              <textarea
                className="w-full px-4 py-3 rounded-lg border border-surface-border bg-white text-brand-ink placeholder:text-brand-ink/40 min-h-24"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Invoice number, reference, anything you'll want to remember."
              />
            </div>
          </CardBody>
        </Card>

        {error && (
          <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href="/bills"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-surface-border text-brand-ink font-medium text-sm hover:bg-surface-muted"
          >
            Cancel
          </Link>
          <Button type="submit" loading={submitting}>
            Save bill
          </Button>
        </div>
      </form>
    </div>
  );
}

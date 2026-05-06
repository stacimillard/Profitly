'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Organization } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface Props {
  organization: Organization;
}

export function OrganizationSettingsView({ organization }: Props) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [legalName, setLegalName] = useState(organization.legal_name ?? '');
  const [businessNumber, setBusinessNumber] = useState(
    organization.business_number ?? ''
  );
  const [fiscalMonth, setFiscalMonth] = useState(
    String(organization.fiscal_year_start_month)
  );
  const [taxRate, setTaxRate] = useState(
    (Number(organization.default_gst_hst_rate) * 100).toFixed(2)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/organization', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        legal_name: legalName || null,
        business_number: businessNumber || null,
        fiscal_year_start_month: parseInt(fiscalMonth, 10),
        default_gst_hst_rate: (parseFloat(taxRate) || 0) / 100,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save your settings.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </Link>
        <h1 className="mt-2 font-heading font-bold text-3xl text-brand-ink leading-tight">
          Business details
        </h1>
        <p className="mt-1 text-brand-ink/70">
          Used on invoices and reports.
        </p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Business name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Legal name (optional)"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Bennett Studio Inc."
              helperText="If different from your business name."
            />
            <Input
              label="Business number / GST/HST number (optional)"
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="123456789RT0001"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Fiscal year starts in"
                value={fiscalMonth}
                onChange={(e) => setFiscalMonth(e.target.value)}
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </Select>
              <Input
                label="Default GST/HST rate (%)"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                helperText="Used as the default on new invoices."
              />
            </div>

            {error && (
              <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
                {error}
              </div>
            )}
            {saved && (
              <div className="rounded-lg bg-brand-teal/10 border border-brand-teal/30 px-4 py-3 text-sm text-brand-ink">
                Saved.
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" loading={submitting}>
                Save changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

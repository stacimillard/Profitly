'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { MigrationSource } from '@/lib/types';
import type { OnboardingData } from './types';

interface Props {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const OPTIONS: { value: MigrationSource; label: string; blurb: string }[] = [
  {
    value: 'brand_new',
    label: 'Brand new business',
    blurb: "Starting fresh — you don't have books anywhere yet.",
  },
  {
    value: 'quickbooks',
    label: 'Moving from QuickBooks',
    blurb: "We'll help you bring your history over.",
  },
  {
    value: 'wave',
    label: 'Moving from Wave',
    blurb: "We'll help you bring your history over.",
  },
  {
    value: 'spreadsheets',
    label: 'Moving from spreadsheets',
    blurb: "We'll get your numbers in without the headaches.",
  },
  {
    value: 'other',
    label: 'Moving from something else',
    blurb: "Xero, FreshBooks, another tool — we've got you.",
  },
];

export function Step2MigrationChoice({ data, updateData, onNext, onBack }: Props) {
  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
        Is this a brand new business, or moving from another system?
      </h1>
      <p className="mt-2 text-brand-ink/70">
        This helps us know whether to set you up fresh, or bring your existing
        numbers over the right way.
      </p>

      <div className="mt-8 space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => updateData({ migration_source: opt.value })}
            className={`w-full text-left rounded-xl border p-4 transition-colors ${
              data.migration_source === opt.value
                ? 'border-brand-teal bg-brand-teal/5 ring-2 ring-brand-teal/30'
                : 'border-surface-border bg-white hover:bg-surface-muted'
            }`}
          >
            <div className="font-heading font-semibold text-brand-ink">
              {opt.label}
            </div>
            <div className="mt-1 text-sm text-brand-ink/70">{opt.blurb}</div>
          </button>
        ))}
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
        <Button onClick={onNext} disabled={!data.migration_source} size="lg">
          Next
        </Button>
      </div>
    </div>
  );
}

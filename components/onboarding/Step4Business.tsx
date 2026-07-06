'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { OnboardingData } from './types';

interface Props {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const QUESTIONS = [
  {
    key: 'has_inventory' as const,
    label: 'Do you sell physical products?',
    hint: "We'll set up Inventory and Cost of Goods Sold if yes.",
  },
  {
    key: 'has_prepaid_expenses' as const,
    label: 'Do you pay deposits ahead of time — like first and last month rent?',
    hint: "Anything you pay for now but use later.",
  },
  {
    key: 'has_deferred_revenue' as const,
    label: 'Do customers ever pay you before you’ve done the work?',
    hint: 'Retainers, prepayments, deposits from clients.',
  },
  {
    key: 'has_loans' as const,
    label: 'Do you have any business loans or financing?',
    hint: 'Lines of credit, term loans, equipment financing.',
  },
  {
    key: 'has_equipment' as const,
    label: 'Do you own equipment, vehicles, or other big assets worth tracking?',
    hint: 'Anything you’d depreciate over more than a year.',
  },
];

export function Step4Business({ data, updateData, onNext, onBack }: Props) {
  const allAnswered = QUESTIONS.every((q) => typeof data[q.key] === 'boolean');

  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
        A few quick yes-or-no questions.
      </h1>
      <p className="mt-2 text-brand-ink/70">
        These help us know which accounts to set up for you. If you&apos;re not
        sure, pick No — you can always change it later.
      </p>

      <div className="mt-8 space-y-3">
        {QUESTIONS.map((q) => {
          const value = data[q.key];
          return (
            <fieldset
              key={q.key}
              className="rounded-xl border border-surface-border p-4 bg-white"
            >
              <legend className="sr-only">{q.label}</legend>
              <p className="font-medium text-brand-ink">{q.label}</p>
              <p className="text-xs text-brand-ink/60 mt-1">{q.hint}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateData({ [q.key]: true })}
                  className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                    value === true
                      ? 'bg-brand-teal text-white border-brand-teal'
                      : 'border-surface-border text-brand-ink hover:bg-surface-muted'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => updateData({ [q.key]: false })}
                  className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                    value === false
                      ? 'bg-brand-teal text-white border-brand-teal'
                      : 'border-surface-border text-brand-ink hover:bg-surface-muted'
                  }`}
                >
                  No
                </button>
              </div>
            </fieldset>
          );
        })}
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
        <Button onClick={onNext} disabled={!allAnswered} size="lg">
          Next
        </Button>
      </div>
    </div>
  );
}

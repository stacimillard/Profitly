'use client';

import { ArrowLeft, Upload, PencilLine, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { OnboardingData } from './types';
import type { BankImportPreference } from '@/lib/types';

interface Props {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const OPTIONS: {
  value: BankImportPreference;
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: 'import',
    title: 'Import bank statements',
    blurb:
      'Upload CSV or PDF statements from your bank. We&apos;ll parse them and let you review every line before saving. Best if you want everything in one place fast.',
    icon: Upload,
  },
  {
    value: 'manual',
    title: "I'll add transactions manually",
    blurb:
      'Type them in yourself as they happen. Good if you prefer control or only have a few transactions.',
    icon: PencilLine,
  },
];

export function Step5Bank({ data, updateData, onNext, onBack }: Props) {
  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
        How do you want to get your transactions in?
      </h1>
      <p className="mt-2 text-brand-ink/70">
        Pick the one that fits how you like to work. You can change your mind
        any time — we&apos;ll always let you do both.
      </p>

      <div className="mt-8 space-y-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = data.bank_import_preference === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateData({ bank_import_preference: opt.value })}
              className={`w-full text-left rounded-xl border p-5 transition-colors ${
                selected
                  ? 'border-brand-teal bg-brand-teal/5 ring-2 ring-brand-teal/30'
                  : 'border-surface-border bg-white hover:bg-surface-muted'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selected
                      ? 'bg-brand-teal/15 text-brand-teal'
                      : 'bg-surface-muted text-brand-ink/60'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-heading font-semibold text-brand-ink">
                      {opt.title}
                    </div>
                    {selected && (
                      <CheckCircle2 className="h-4 w-4 text-brand-teal" />
                    )}
                  </div>
                  <p
                    className="mt-1 text-sm text-brand-ink/70"
                    dangerouslySetInnerHTML={{ __html: opt.blurb }}
                  />
                </div>
              </div>
            </button>
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
        <Button
          onClick={onNext}
          disabled={!data.bank_import_preference}
          size="lg"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

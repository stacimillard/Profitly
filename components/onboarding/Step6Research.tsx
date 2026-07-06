'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { OnboardingData } from './types';

interface Props {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  onBack: () => void;
  onFinish: () => void;
  submitting: boolean;
  error: string | null;
}

const MOTIVATIONS = [
  { value: 'old_too_complicated', label: 'My old software was too complicated' },
  { value: 'accountant_recommended', label: 'My accountant recommended it' },
  { value: 'needed_canada', label: 'I needed something built for Canada' },
  { value: 'spreadsheets', label: 'I was doing it in spreadsheets' },
  { value: 'other', label: 'Other' },
];

export function Step6Research({
  data,
  updateData,
  onBack,
  onFinish,
  submitting,
  error,
}: Props) {
  function toggleMotivation(value: string) {
    const current = data.motivations;
    if (current.includes(value)) {
      updateData({ motivations: current.filter((m) => m !== value) });
    } else {
      updateData({ motivations: [...current, value] });
    }
  }

  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
        One last thing — help us help you.
      </h1>
      <p className="mt-2 text-brand-ink/70">
        Two totally optional questions. Skip if you&apos;d rather just get into
        your books.
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <p className="font-medium text-brand-ink">
            What made you try Profitly? Pick any that apply.
          </p>
          <div className="mt-3 space-y-2">
            {MOTIVATIONS.map((m) => {
              const checked = data.motivations.includes(m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggleMotivation(m.value)}
                  className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                    checked
                      ? 'border-brand-teal bg-brand-teal/5 text-brand-ink'
                      : 'border-surface-border bg-white text-brand-ink hover:bg-surface-muted'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`h-4 w-4 rounded border flex items-center justify-center ${
                        checked
                          ? 'bg-brand-teal border-brand-teal text-white'
                          : 'border-surface-border'
                      }`}
                    >
                      {checked && (
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block font-medium text-brand-ink mb-1">
            What&apos;s the one thing you most want Profitly to help you with?
          </label>
          <textarea
            className="w-full px-4 py-3 rounded-lg border border-surface-border bg-white text-brand-ink placeholder:text-brand-ink/40 min-h-24"
            placeholder="Something like: stop dreading tax time, know if I'm actually making money, keep receipts organized..."
            value={data.help_goal}
            onChange={(e) => updateData({ help_goal: e.target.value })}
          />
          <p className="mt-1 text-xs text-brand-ink/60">
            Totally optional. Helps us focus on making the things you care about
            better.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
          {error}
        </div>
      )}

      <div className="mt-8 flex justify-between items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-brand-ink/70 hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              updateData({ motivations: [], help_goal: '' });
              onFinish();
            }}
            disabled={submitting}
          >
            Skip and finish
          </Button>
          <Button onClick={onFinish} loading={submitting} size="lg">
            All done — take me in
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CANADIAN_PROVINCES } from '@/lib/data/canadianProvinces';
import type { BusinessStructure } from '@/lib/types';
import type { OnboardingData } from './types';

interface Props {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
}

const STRUCTURES: { value: BusinessStructure; label: string }[] = [
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'partnership',     label: 'Partnership' },
  { value: 'corporation',     label: 'Corporation' },
  { value: 'other',           label: 'Other' },
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function daysInMonth(month: number): number {
  // Use 2024 (leap year) so Feb 29 is available.
  return new Date(2024, month, 0).getDate();
}

export function Step1Basics({ data, updateData, onNext }: Props) {
  const canContinue =
    data.business_name.trim().length > 0 &&
    data.province.trim().length > 0 &&
    data.business_structure;

  const maxDay = daysInMonth(data.fiscal_year_end_month);

  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
        First — the basics about your business.
      </h1>
      <p className="mt-2 text-brand-ink/70">
        Tell us where you&apos;re at so we can set up your books the right way.
        Don&apos;t worry — you can change any of this later.
      </p>

      <div className="mt-8 space-y-4">
        <Input
          label="What&apos;s your business name?"
          value={data.business_name}
          onChange={(e) => updateData({ business_name: e.target.value })}
          placeholder="Acme Inc."
          required
        />

        <Select
          label="How is your business set up?"
          value={data.business_structure}
          onChange={(e) =>
            updateData({
              business_structure: e.target.value as BusinessStructure,
            })
          }
          helperText="Not sure? Sole Proprietor is the most common for solo owners."
        >
          {STRUCTURES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>

        <Select
          label="Which province or territory?"
          value={data.province}
          onChange={(e) => updateData({ province: e.target.value })}
          helperText="This tells us the right GST/HST/PST rates to use."
        >
          {CANADIAN_PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>

        <div>
          <label className="block text-sm font-medium text-brand-ink mb-1">
            When does your business year end?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={String(data.fiscal_year_end_month)}
              onChange={(e) => {
                const m = parseInt(e.target.value, 10);
                const d = Math.min(data.fiscal_year_end_day, daysInMonth(m));
                updateData({ fiscal_year_end_month: m, fiscal_year_end_day: d });
              }}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select
              value={String(data.fiscal_year_end_day)}
              onChange={(e) =>
                updateData({ fiscal_year_end_day: parseInt(e.target.value, 10) })
              }
            >
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-1 text-sm text-brand-ink/60">
            Most small businesses use December 31. Corporations sometimes pick a
            different one — go with what your accountant told you.
          </p>
        </div>

        <div>
          <p className="block text-sm font-medium text-brand-ink mb-2">
            Do you have employees on payroll?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateData({ has_employees: true })}
              className={`px-4 py-3 rounded-lg border font-medium transition-colors ${
                data.has_employees
                  ? 'bg-brand-teal text-white border-brand-teal'
                  : 'border-surface-border text-brand-ink hover:bg-surface-muted'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => updateData({ has_employees: false })}
              className={`px-4 py-3 rounded-lg border font-medium transition-colors ${
                !data.has_employees
                  ? 'bg-brand-teal text-white border-brand-teal'
                  : 'border-surface-border text-brand-ink hover:bg-surface-muted'
              }`}
            >
              No
            </button>
          </div>
          <p className="mt-1 text-sm text-brand-ink/60">
            Contractors don&apos;t count — this is people you pay a regular
            paycheck to.
          </p>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={onNext} disabled={!canContinue} size="lg">
          Next
        </Button>
      </div>
    </div>
  );
}

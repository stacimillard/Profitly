'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Step1Basics } from './Step1Basics';
import { Step2MigrationChoice } from './Step2MigrationChoice';
import { Step3Migration } from './Step3Migration';
import { Step4Business } from './Step4Business';
import { Step5Bank } from './Step5Bank';
import { Step6Research } from './Step6Research';
import type { OnboardingData } from './types';

interface Props {
  businessName: string;
}

const TOTAL_STEPS = 6;

export function OnboardingFlow({ businessName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    business_name: businessName,
    business_structure: 'sole_proprietor',
    province: 'ON',
    fiscal_year_end_month: 12,
    fiscal_year_end_day: 31,
    has_employees: false,
    migration_source: null,
    trial_balance_rows: [],
    reconciliation_starting_points: [],
    ar_ledger_rows: [],
    ap_ledger_rows: [],
    has_inventory: false,
    has_prepaid_expenses: false,
    has_deferred_revenue: false,
    has_loans: false,
    has_equipment: false,
    bank_import_preference: null,
    motivations: [],
    help_goal: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateData(patch: Partial<OnboardingData>) {
    setData((d) => ({ ...d, ...patch }));
  }

  function goNext() {
    setError(null);
    // Skip migration step if brand new.
    if (step === 2 && data.migration_source === 'brand_new') {
      setStep(4);
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setError(null);
    // Skip migration step going back if brand new.
    if (step === 4 && data.migration_source === 'brand_new') {
      setStep(2);
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something didn't work. Try again?");
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  // Progress: count 6 steps but hide the migration step from the bar
  // when brand-new was chosen so the bar still reflects real progress.
  const shownSteps = data.migration_source === 'brand_new' ? 5 : 6;
  const shownIndex =
    data.migration_source === 'brand_new' && step > 3 ? step - 1 : step;
  const progressPct = Math.round((shownIndex / shownSteps) * 100);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-brand-ink/60 mb-2">
          <span>
            Step {shownIndex} of {shownSteps}
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full bg-brand-teal transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <Step1Basics
          data={data}
          updateData={updateData}
          onNext={goNext}
        />
      )}
      {step === 2 && (
        <Step2MigrationChoice
          data={data}
          updateData={updateData}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === 3 && (
        <Step3Migration
          data={data}
          updateData={updateData}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === 4 && (
        <Step4Business
          data={data}
          updateData={updateData}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === 5 && (
        <Step5Bank
          data={data}
          updateData={updateData}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === 6 && (
        <Step6Research
          data={data}
          updateData={updateData}
          onBack={goBack}
          onFinish={finish}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  );
}

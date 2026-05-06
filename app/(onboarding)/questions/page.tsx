'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const QUESTIONS = [
  {
    key: 'has_inventory',
    label: 'Do you sell physical products?',
  },
  {
    key: 'has_prepaid_expenses',
    label:
      "Do you pay deposits ahead of time — like first and last month's rent?",
  },
  {
    key: 'has_deferred_revenue',
    label: "Do customers ever pay you before you've done the work?",
  },
  {
    key: 'has_loans',
    label: 'Do you have any business loans or financing?',
  },
  {
    key: 'has_equipment',
    label: 'Do you own equipment, vehicles, or other big assets worth tracking?',
  },
] as const;

type AnswerKey = (typeof QUESTIONS)[number]['key'];

export default function QuestionsPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<Record<AnswerKey, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(key: AnswerKey, value: boolean) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something didn't work. Try again?");
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  const allAnswered = QUESTIONS.every((q) => q.key in answers);

  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
        Quick questions about your business.
      </h1>
      <p className="mt-2 text-brand-ink/70">
        Just yes or no. We&apos;ll add the right accounts to your chart based
        on your answers.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        {QUESTIONS.map((q) => (
          <fieldset
            key={q.key}
            className="rounded-xl border border-surface-border p-4 bg-white"
          >
            <legend className="sr-only">{q.label}</legend>
            <p className="font-medium text-brand-ink">{q.label}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAnswer(q.key, true)}
                className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                  answers[q.key] === true
                    ? 'bg-brand-teal text-white border-brand-teal'
                    : 'border-surface-border text-brand-ink hover:bg-surface-muted'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setAnswer(q.key, false)}
                className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                  answers[q.key] === false
                    ? 'bg-brand-teal text-white border-brand-teal'
                    : 'border-surface-border text-brand-ink hover:bg-surface-muted'
                }`}
              >
                No
              </button>
            </div>
          </fieldset>
        ))}

        {error && (
          <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !allAnswered}
          className="w-full px-6 py-3 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Setting things up…' : 'All done — take me in'}
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Loader2 } from 'lucide-react';
import type { RuleMatchField, RuleMatchType } from '@/lib/types';

interface Props {
  /** Display-friendly vendor / description from the just-categorized txn. */
  vendorLabel: string;
  /** What to use as the rule pattern (typically vendor_normalized). */
  matchPattern: string;
  /** Field to match against — default 'vendor'. */
  matchField?: RuleMatchField;
  /** How to match — default 'contains'. */
  matchType?: RuleMatchType;
  /** Account that was just chosen — the rule will categorize to this. */
  accountId: string;
  /** Display name of the account. */
  accountName: string;
  /** Whether the user marked the txn tax-deductible (rule inherits this). */
  isTaxDeductible: boolean;
  /** How many other uncategorized transactions look similar. */
  similarCount: number;
  /** Called after a rule is created (so the parent can refresh). */
  onCreated?: (appliedCount: number) => void;
  /** Called when the user dismisses the suggestion. */
  onDismiss: () => void;
}

/**
 * Friendly banner that pops up after the user manually categorizes a
 * transaction. If we see other unsorted transactions with a similar
 * vendor, we offer to make a rule that auto-categorizes them all.
 */
export function RuleSuggestionBanner({
  vendorLabel,
  matchPattern,
  matchField = 'vendor',
  matchType = 'contains',
  accountId,
  accountName,
  isTaxDeductible,
  similarCount,
  onCreated,
  onDismiss,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function makeRule() {
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/categorization-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: accountId,
        match_field: matchField,
        match_type: matchType,
        match_pattern: matchPattern,
        is_tax_deductible: isTaxDeductible,
        apply_now: true,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't make the rule. Try again?");
      return;
    }

    const body = await res.json();
    onCreated?.(body?.data?.applied_count ?? 0);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 flex items-start gap-3">
      <div className="shrink-0 h-9 w-9 rounded-full bg-brand-orange/20 flex items-center justify-center text-brand-orange">
        <Sparkles className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brand-ink">
          Make this a rule for next time?
        </p>
        <p className="text-sm text-brand-ink/70 mt-0.5">
          We see <span className="font-medium">{similarCount}</span>{' '}
          {similarCount === 1
            ? 'other transaction'
            : 'other transactions'}{' '}
          like <span className="font-medium">&ldquo;{vendorLabel}&rdquo;</span>{' '}
          waiting for a category. We can categorize{' '}
          {similarCount === 1 ? 'it' : 'them all'} as{' '}
          <span className="font-medium">{accountName}</span> right now.
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={makeRule}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-teal text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            Make a rule
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-brand-ink/70 hover:bg-white"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-md hover:bg-white text-brand-ink/60"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

import type { CategorizationRule, RuleMatchType, RuleMatchField } from '@/lib/types';

export interface RuleMatchResult {
  account_id: string;
  is_tax_deductible: boolean;
  applied_rule_id: string;
}

/**
 * Returns true if the given transaction-ish input matches the supplied
 * rule criteria. Used both at categorization time and for the
 * retroactive "apply now" feature when a new rule is saved.
 */
export function transactionMatchesRule(
  txn: { description: string; vendor_normalized: string | null },
  rule: {
    match_field: RuleMatchField;
    match_type: RuleMatchType;
    match_pattern: string;
  }
): boolean {
  const target =
    rule.match_field === 'description'
      ? txn.description
      : txn.vendor_normalized ?? '';
  const haystack = (target || '').toLowerCase();
  const needle = rule.match_pattern.toLowerCase();
  switch (rule.match_type) {
    case 'contains':
      return haystack.includes(needle);
    case 'equals':
      return haystack === needle;
    case 'starts_with':
      return haystack.startsWith(needle);
    case 'ends_with':
      return haystack.endsWith(needle);
  }
}

/**
 * Walks rules in priority order (lowest priority value = highest priority)
 * and returns the first match for the given transaction-ish input.
 * Inactive rules are skipped.
 */
export function findMatchingRule(
  txn: { description: string; vendor_normalized: string | null },
  rules: CategorizationRule[]
): RuleMatchResult | null {
  const sorted = [...rules]
    .filter((r) => r.is_active)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const target =
      rule.match_field === 'description'
        ? txn.description
        : txn.vendor_normalized ?? '';
    const haystack = (target || '').toLowerCase();
    const needle = rule.match_pattern.toLowerCase();

    let match = false;
    switch (rule.match_type) {
      case 'contains':
        match = haystack.includes(needle);
        break;
      case 'equals':
        match = haystack === needle;
        break;
      case 'starts_with':
        match = haystack.startsWith(needle);
        break;
      case 'ends_with':
        match = haystack.endsWith(needle);
        break;
    }

    if (match) {
      return {
        account_id: rule.account_id,
        is_tax_deductible: rule.is_tax_deductible,
        applied_rule_id: rule.id,
      };
    }
  }
  return null;
}

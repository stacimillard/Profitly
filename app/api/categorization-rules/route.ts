import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { transactionMatchesRule } from '@/lib/transactions/applyRules';
import type {
  CategorizationRule,
  RuleMatchField,
  RuleMatchType,
} from '@/lib/types';

const ALLOWED_FIELDS: RuleMatchField[] = ['description', 'vendor'];
const ALLOWED_TYPES: RuleMatchType[] = [
  'contains',
  'equals',
  'starts_with',
  'ends_with',
];

interface CreateRuleBody {
  account_id?: string;
  match_field?: string;
  match_type?: string;
  match_pattern?: string;
  is_tax_deductible?: boolean;
  priority?: number;
  apply_now?: boolean;
}

/** GET /api/categorization-rules — list rules ordered by priority. */
export async function GET() {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categorization_rules')
    .select('*, accounts:account_id(name, type)')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/**
 * POST /api/categorization-rules
 * If body.apply_now is true, retroactively categorizes any uncategorized
 * transactions that match this new rule. Returns { rule, applied_count }.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: CreateRuleBody;
  try {
    body = (await request.json()) as CreateRuleBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const accountId = body.account_id;
  const matchField = body.match_field as RuleMatchField | undefined;
  const matchType = body.match_type as RuleMatchType | undefined;
  const matchPattern = body.match_pattern?.trim();
  const isTaxDeductible = !!body.is_tax_deductible;
  const priority = Number.isFinite(body.priority)
    ? Math.max(0, Math.round(Number(body.priority)))
    : 100;
  const applyNow = !!body.apply_now;

  if (!accountId) {
    return NextResponse.json(
      { error: 'Pick a category for this rule.' },
      { status: 400 }
    );
  }
  if (!matchField || !ALLOWED_FIELDS.includes(matchField)) {
    return NextResponse.json(
      { error: 'Pick what to match against.' },
      { status: 400 }
    );
  }
  if (!matchType || !ALLOWED_TYPES.includes(matchType)) {
    return NextResponse.json(
      { error: 'Pick how to match.' },
      { status: 400 }
    );
  }
  if (!matchPattern) {
    return NextResponse.json(
      { error: 'Type the text you want to match.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: rule, error: insertError } = await supabase
    .from('categorization_rules')
    .insert({
      organization_id: ctx.organizationId,
      account_id: accountId,
      match_field: matchField,
      match_type: matchType,
      match_pattern: matchPattern,
      is_tax_deductible: isTaxDeductible,
      priority,
    })
    .select()
    .single();

  if (insertError || !rule) {
    return NextResponse.json(
      { error: insertError?.message || "Couldn't save the rule." },
      { status: 500 }
    );
  }

  let appliedCount = 0;
  if (applyNow) {
    const { data: uncategorized } = await supabase
      .from('transactions')
      .select('id, description, vendor_normalized')
      .eq('status', 'uncategorized');

    const matching = (uncategorized ?? []).filter((t) =>
      transactionMatchesRule(
        { description: t.description, vendor_normalized: t.vendor_normalized },
        rule as CategorizationRule
      )
    );

    if (matching.length > 0) {
      const ids = matching.map((t) => t.id);
      const { data: updated, error: updateError } = await supabase
        .from('transactions')
        .update({
          account_id: rule.account_id,
          is_tax_deductible: rule.is_tax_deductible,
          status: 'categorized',
          applied_rule_id: rule.id,
        })
        .in('id', ids)
        .select('id');

      if (!updateError && updated) {
        appliedCount = updated.length;
        await supabase
          .from('categorization_rules')
          .update({ times_applied: (rule.times_applied ?? 0) + appliedCount })
          .eq('id', rule.id);
      }
    }
  }

  return NextResponse.json({
    data: { rule, applied_count: appliedCount },
  });
}

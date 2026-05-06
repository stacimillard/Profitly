import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  suggestCategories,
  type AccountForAI,
  type TransactionForAI,
} from '@/lib/ai/anthropic';

interface AICategorizeBody {
  transaction_ids?: string[];
  /** Cap on how many transactions to send to Claude in one call. Default 30, max 50. */
  limit?: number;
}

/**
 * POST /api/ai-categorize
 * Body: { transaction_ids?: string[], limit?: number }
 *
 * Asks Claude for category suggestions for uncategorized transactions
 * and saves them onto the rows (ai_suggested_account_id, confidence,
 * reasoning). Does NOT auto-apply — the user has to approve each one.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "AI categorization isn't set up yet — add ANTHROPIC_API_KEY to your env and try again.",
      },
      { status: 503 }
    );
  }

  let body: AICategorizeBody = {};
  try {
    body = (await request.json()) as AICategorizeBody;
  } catch {
    // Empty body is fine — we default to all uncategorized.
  }

  const limit = Math.min(
    Math.max(parseInt(String(body.limit ?? 30), 10) || 30, 1),
    50
  );

  const supabase = await createClient();

  // Fetch uncategorized transactions to send to Claude.
  let txnQuery = supabase
    .from('transactions')
    .select('id, date, description, amount_cents, direction')
    .eq('status', 'uncategorized');

  if (Array.isArray(body.transaction_ids) && body.transaction_ids.length > 0) {
    txnQuery = txnQuery.in('id', body.transaction_ids);
  }

  txnQuery = txnQuery
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data: txns, error: txnError } = await txnQuery;
  if (txnError) {
    return NextResponse.json({ error: txnError.message }, { status: 500 });
  }
  if (!txns || txns.length === 0) {
    return NextResponse.json({
      data: { suggested: 0, total: 0 },
    });
  }

  // Fetch chart of accounts to give Claude context.
  const { data: accountsRaw, error: accountsError } = await supabase
    .from('accounts')
    .select('id, name, type, description')
    .eq('is_active', true);

  if (accountsError) {
    return NextResponse.json(
      { error: accountsError.message },
      { status: 500 }
    );
  }
  const accounts = (accountsRaw ?? []) as AccountForAI[];
  if (accounts.length === 0) {
    return NextResponse.json(
      {
        error:
          "We couldn't find any active accounts to categorize against.",
      },
      { status: 400 }
    );
  }

  // Call Claude.
  let suggestions;
  try {
    suggestions = await suggestCategories({
      accounts,
      transactions: txns as TransactionForAI[],
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Something went wrong asking the AI.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Validate: account_id must be one of ours; transaction_id must be one we sent.
  const validAccountIds = new Set(accounts.map((a) => a.id));
  const validTxnIds = new Set(txns.map((t) => t.id));
  const valid = suggestions.filter(
    (s) =>
      validAccountIds.has(s.account_id) &&
      validTxnIds.has(s.transaction_id) &&
      Number.isFinite(s.confidence) &&
      typeof s.reasoning === 'string'
  );

  // Save suggestions onto the transactions (one update per row).
  let saved = 0;
  for (const s of valid) {
    const confidence = Math.max(0, Math.min(1, s.confidence));
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        ai_suggested_account_id: s.account_id,
        ai_suggestion_confidence: confidence,
        ai_suggestion_reasoning: s.reasoning,
      })
      .eq('id', s.transaction_id);
    if (!updateError) saved++;
  }

  return NextResponse.json({
    data: {
      suggested: saved,
      total: txns.length,
    },
  });
}

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reconciliations/[id]/complete
 * Marks the reconciliation completed. All transactions that were matched
 * to a statement line are flipped to status='reconciled'. Refuses if any
 * lines are still unmatched.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id: reconciliationId } = await params;

  const supabase = await createClient();

  const { data: recon } = await supabase
    .from('reconciliations')
    .select('id, status')
    .eq('id', reconciliationId)
    .maybeSingle();
  if (!recon) {
    return NextResponse.json(
      { error: 'Reconciliation not found.' },
      { status: 404 }
    );
  }
  if (recon.status === 'completed') {
    return NextResponse.json(
      { error: 'This reconciliation is already finished.' },
      { status: 400 }
    );
  }

  const { data: lines } = await supabase
    .from('reconciliation_lines')
    .select('id, is_matched, matched_transaction_id')
    .eq('reconciliation_id', reconciliationId);

  const all = lines ?? [];
  const unmatched = all.filter((l) => !l.is_matched);
  if (unmatched.length > 0) {
    return NextResponse.json(
      {
        error: `You've still got ${unmatched.length} statement ${
          unmatched.length === 1 ? 'line' : 'lines'
        } without a match. Match those before finishing.`,
      },
      { status: 400 }
    );
  }

  const matchedTxnIds = all
    .map((l) => l.matched_transaction_id)
    .filter((v): v is string => !!v);

  // Flip matched transactions to "reconciled" status. If this fails, bail
  // out before marking the reconciliation complete so we don't end up in a
  // half-done state.
  if (matchedTxnIds.length > 0) {
    const { error: txnUpdateError } = await supabase
      .from('transactions')
      .update({ status: 'reconciled', reconciliation_id: reconciliationId })
      .in('id', matchedTxnIds);
    if (txnUpdateError) {
      return NextResponse.json(
        { error: txnUpdateError.message },
        { status: 500 }
      );
    }
  }

  const { data, error } = await supabase
    .from('reconciliations')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', reconciliationId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Couldn't complete the reconciliation." },
      { status: 500 }
    );
  }
  return NextResponse.json({
    data: { reconciliation: data, reconciled_count: matchedTxnIds.length },
  });
}

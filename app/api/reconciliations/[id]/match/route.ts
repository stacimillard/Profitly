import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface MatchBody {
  line_id?: string;
  transaction_id?: string | null;
}

/**
 * POST /api/reconciliations/[id]/match
 * Body: { line_id, transaction_id } to match, or { line_id, transaction_id: null } to unmatch.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id: reconciliationId } = await params;

  let body: MatchBody;
  try {
    body = (await request.json()) as MatchBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const lineId = body.line_id?.trim();
  if (!lineId) {
    return NextResponse.json(
      { error: 'Pick a statement line first.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Confirm the line belongs to this reconciliation.
  const { data: line } = await supabase
    .from('reconciliation_lines')
    .select('id, reconciliation_id')
    .eq('id', lineId)
    .maybeSingle();
  if (!line || line.reconciliation_id !== reconciliationId) {
    return NextResponse.json(
      { error: 'Statement line not found in this reconciliation.' },
      { status: 404 }
    );
  }

  if (body.transaction_id) {
    const { data: txn } = await supabase
      .from('transactions')
      .select('id')
      .eq('id', body.transaction_id)
      .maybeSingle();
    if (!txn) {
      return NextResponse.json(
        { error: "We couldn't find that transaction." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('reconciliation_lines')
      .update({
        matched_transaction_id: body.transaction_id,
        is_matched: true,
      })
      .eq('id', lineId)
      .select()
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  // Unmatch
  const { data, error } = await supabase
    .from('reconciliation_lines')
    .update({
      matched_transaction_id: null,
      is_matched: false,
    })
    .eq('id', lineId)
    .select()
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

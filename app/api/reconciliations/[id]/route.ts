import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/reconciliations/[id] — recon + statement lines + matched txns. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data: recon, error } = await supabase
    .from('reconciliations')
    .select('*, bank_accounts:bank_account_id(name, type, last_four)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!recon) {
    return NextResponse.json(
      { error: 'Reconciliation not found.' },
      { status: 404 }
    );
  }

  const { data: lines } = await supabase
    .from('reconciliation_lines')
    .select(
      '*, matched_transaction:matched_transaction_id(id, date, description, amount_cents, direction)'
    )
    .eq('reconciliation_id', id)
    .order('statement_date', { ascending: true });

  return NextResponse.json({ data: { reconciliation: recon, lines: lines ?? [] } });
}

/** DELETE /api/reconciliations/[id] — cancel an in-progress recon. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();

  const { data: recon } = await supabase
    .from('reconciliations')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (!recon) {
    return NextResponse.json(
      { error: 'Reconciliation not found.' },
      { status: 404 }
    );
  }
  if (recon.status === 'completed') {
    return NextResponse.json(
      {
        error:
          "Completed reconciliations can't be deleted. Reopen it from month-end if you need to redo something.",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('reconciliations')
    .delete()
    .eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}

import { redirect, notFound } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  ReconciliationDetailView,
  type ReconciliationDetail,
  type ReconciliationLineWithTxn,
  type CandidateTransaction,
} from '@/components/reconciliations/ReconciliationDetailView';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReconciliationDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();

  const { data: reconRaw } = await supabase
    .from('reconciliations')
    .select('*, bank_accounts:bank_account_id(name, type, last_four)')
    .eq('id', id)
    .maybeSingle();

  if (!reconRaw) notFound();
  const reconciliation = reconRaw as ReconciliationDetail;

  const { data: linesRaw } = await supabase
    .from('reconciliation_lines')
    .select(
      '*, matched_transaction:matched_transaction_id(id, date, description, amount_cents, direction)'
    )
    .eq('reconciliation_id', id)
    .order('statement_date', { ascending: true });

  const lines = (linesRaw as ReconciliationLineWithTxn[]) ?? [];

  // Pull a generous pool of candidate transactions for matching.
  const windowStart = new Date(reconciliation.statement_start_date);
  windowStart.setDate(windowStart.getDate() - 5);
  const windowEnd = new Date(reconciliation.statement_end_date);
  windowEnd.setDate(windowEnd.getDate() + 5);

  const { data: txns } = await supabase
    .from('transactions')
    .select('id, date, description, amount_cents, direction, status')
    .eq('bank_account_id', reconciliation.bank_account_id)
    .gte('date', windowStart.toISOString().slice(0, 10))
    .lte('date', windowEnd.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(500);

  return (
    <ReconciliationDetailView
      reconciliation={reconciliation}
      initialLines={lines}
      candidateTransactions={(txns as CandidateTransaction[]) ?? []}
    />
  );
}

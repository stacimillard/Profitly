import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  ReconciliationsView,
  type ReconciliationListRow,
} from '@/components/reconciliations/ReconciliationsView';
import type { BankAccount } from '@/lib/types';

export default async function ReconciliationsPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();

  const { data: recons } = await supabase
    .from('reconciliations')
    .select('*, bank_accounts:bank_account_id(name, type, last_four)')
    .order('statement_end_date', { ascending: false })
    .order('created_at', { ascending: false });

  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return (
    <ReconciliationsView
      initialReconciliations={(recons as ReconciliationListRow[]) ?? []}
      bankAccounts={(bankAccounts as BankAccount[]) ?? []}
    />
  );
}

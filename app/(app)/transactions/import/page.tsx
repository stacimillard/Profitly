import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { TransactionImportView } from '@/components/transactions/TransactionImportView';
import type { BankAccount } from '@/lib/types';

export default async function TransactionsImportPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return (
    <TransactionImportView
      bankAccounts={(bankAccounts as BankAccount[]) ?? []}
    />
  );
}

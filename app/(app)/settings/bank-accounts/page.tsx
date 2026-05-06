import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { BankAccountsView } from '@/components/bankAccounts/BankAccountsView';
import type { BankAccount } from '@/lib/types';

export default async function BankAccountsPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('*')
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  return (
    <BankAccountsView initialAccounts={(accounts as BankAccount[]) ?? []} />
  );
}

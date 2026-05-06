import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { AccountsView } from '@/components/accounts/AccountsView';
import type { Account } from '@/lib/types';

export default async function AccountsPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  return <AccountsView initialAccounts={(accounts as Account[]) ?? []} />;
}

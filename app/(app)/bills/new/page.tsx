import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { BillFormView } from '@/components/bills/BillFormView';
import type { Account } from '@/lib/types';

export default async function NewBillPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .in('type', ['expense', 'cost_of_goods', 'asset', 'liability'])
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  return <BillFormView expenseAccounts={(accounts as Account[]) ?? []} />;
}

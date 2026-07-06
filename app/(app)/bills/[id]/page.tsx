import { redirect, notFound } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { BillDetailView } from '@/components/bills/BillDetailView';
import type { Account, BankAccount, Bill } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BillDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();

  const { data: bill } = await supabase
    .from('bills')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!bill) notFound();

  const [{ data: expenseAccounts }, { data: bankAccounts }] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .in('type', ['expense', 'cost_of_goods', 'asset', 'liability'])
      .order('type', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('bank_accounts')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  return (
    <BillDetailView
      bill={bill as Bill}
      expenseAccounts={(expenseAccounts as Account[]) ?? []}
      bankAccounts={(bankAccounts as BankAccount[]) ?? []}
    />
  );
}

import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  TransactionsView,
  type TransactionWithRelations,
} from '@/components/transactions/TransactionsView';
import type {
  Account,
  BankAccount,
  TransactionStatus,
} from '@/lib/types';

interface Props {
  searchParams: Promise<{ status?: string; bank_account?: string }>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const params = await searchParams;
  const status = params.status as TransactionStatus | undefined;
  const bankAccountId = params.bank_account;

  const supabase = await createClient();

  let query = supabase
    .from('transactions')
    .select(
      '*, accounts:account_id(name, type), bank_accounts:bank_account_id(name, last_four), ai_account:ai_suggested_account_id(name, type)'
    );
  if (status) query = query.eq('status', status);
  if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);
  query = query
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: transactions } = await query;

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return (
    <TransactionsView
      initialTransactions={
        (transactions as TransactionWithRelations[]) ?? []
      }
      accounts={(accounts as Account[]) ?? []}
      bankAccounts={(bankAccounts as BankAccount[]) ?? []}
    />
  );
}

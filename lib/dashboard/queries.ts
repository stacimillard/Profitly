import { createClient } from '@/lib/supabase/server';
import type { Transaction, WinJournalEntry } from '@/lib/types';

export interface DashboardRecentTransaction extends Transaction {
  account_name: string | null;
}

export interface DashboardData {
  month_label: string;
  money_in_this_month_cents: number;
  money_out_this_month_cents: number;
  money_in_ytd_cents: number;
  money_out_ytd_cents: number;
  uncategorized_count: number;
  account_count: number;
  recent_transactions: DashboardRecentTransaction[];
  recent_wins: WinJournalEntry[];
}

export interface GettingStartedState {
  has_bank_account: boolean;
  has_transactions: boolean;
  has_categorized_transactions: boolean;
  uncategorized_count: number;
  transaction_count: number;
  closed_months_count: number;
}

/**
 * Lightweight check used by the dashboard to decide whether to show the
 * getting-started flow (no numbers) or the normal KPI dashboard.
 * Users only graduate to the KPI view after closing their first month.
 */
export async function getGettingStartedState(): Promise<GettingStartedState> {
  const supabase = await createClient();

  const [
    { count: bankAccountCount },
    { count: transactionCount },
    { count: categorizedCount },
    { count: uncategorizedCount },
    { count: closedMonthsCount },
  ] = await Promise.all([
    supabase
      .from('bank_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['categorized', 'reconciled']),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'uncategorized'),
    supabase
      .from('closed_months')
      .select('id', { count: 'exact', head: true }),
  ]);

  return {
    has_bank_account: (bankAccountCount ?? 0) > 0,
    has_transactions: (transactionCount ?? 0) > 0,
    has_categorized_transactions: (categorizedCount ?? 0) > 0,
    uncategorized_count: uncategorizedCount ?? 0,
    transaction_count: transactionCount ?? 0,
    closed_months_count: closedMonthsCount ?? 0,
  };
}

/**
 * Computes everything the dashboard needs in a few RLS-scoped queries.
 * Caller must already be authenticated (RLS handles tenant isolation).
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const yearStartStr = yearStart.toISOString().slice(0, 10);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  // YTD transaction rows — small enough to sum in JS.
  const { data: ytdTxns } = await supabase
    .from('transactions')
    .select('id, date, amount_cents, direction')
    .gte('date', yearStartStr);

  let ytdIn = 0;
  let ytdOut = 0;
  let monthIn = 0;
  let monthOut = 0;

  for (const t of ytdTxns ?? []) {
    const inThisMonth = t.date >= monthStartStr;
    if (t.direction === 'money_in') {
      ytdIn += t.amount_cents;
      if (inThisMonth) monthIn += t.amount_cents;
    } else {
      ytdOut += t.amount_cents;
      if (inThisMonth) monthOut += t.amount_cents;
    }
  }

  const { count: uncategorizedCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'uncategorized');

  const { count: accountCount } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const { data: recentRows } = await supabase
    .from('transactions')
    .select('*, accounts(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  const recent: DashboardRecentTransaction[] = (recentRows ?? []).map(
    (row: Transaction & { accounts: { name: string } | null }) => ({
      ...row,
      account_name: row.accounts?.name ?? null,
    })
  );

  const { data: wins } = await supabase
    .from('win_journal_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(3);

  return {
    month_label: now.toLocaleDateString('en-CA', { month: 'long' }),
    money_in_this_month_cents: monthIn,
    money_out_this_month_cents: monthOut,
    money_in_ytd_cents: ytdIn,
    money_out_ytd_cents: ytdOut,
    uncategorized_count: uncategorizedCount ?? 0,
    account_count: accountCount ?? 0,
    recent_transactions: recent,
    recent_wins: (wins as WinJournalEntry[]) ?? [],
  };
}

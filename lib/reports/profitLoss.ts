import { createClient } from '@/lib/supabase/server';
import type { AccountType } from '@/lib/types';

export interface ProfitLossLine {
  account_id: string;
  account_name: string;
  account_type: AccountType;
  amount_cents: number;
}

export interface ProfitLossSection {
  label: string;
  lines: ProfitLossLine[];
  total_cents: number;
}

export interface ProfitLossReport {
  start_date: string;
  end_date: string;
  revenue: ProfitLossSection;
  cost_of_goods: ProfitLossSection;
  expense: ProfitLossSection;
  gross_profit_cents: number;
  net_profit_cents: number;
}

/**
 * Computes a P&L for the date range [start, end] in YYYY-MM-DD form.
 * Revenue accounts: net = money_in - money_out (refunds reduce revenue).
 * COGS / expense accounts: net = money_out - money_in.
 */
export async function getProfitLoss(
  startDate: string,
  endDate: string
): Promise<ProfitLossReport> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('transactions')
    .select('account_id, amount_cents, direction, accounts:account_id(name, type)')
    .gte('date', startDate)
    .lte('date', endDate)
    .not('account_id', 'is', null);

  type Row = {
    account_id: string;
    amount_cents: number;
    direction: 'money_in' | 'money_out';
    accounts: { name: string; type: AccountType } | null;
  };

  const byAccount = new Map<
    string,
    { name: string; type: AccountType; in_cents: number; out_cents: number }
  >();

  for (const r of (rows as Row[] | null) ?? []) {
    if (!r.account_id || !r.accounts) continue;
    if (!['revenue', 'cost_of_goods', 'expense'].includes(r.accounts.type)) {
      continue;
    }
    let entry = byAccount.get(r.account_id);
    if (!entry) {
      entry = {
        name: r.accounts.name,
        type: r.accounts.type,
        in_cents: 0,
        out_cents: 0,
      };
      byAccount.set(r.account_id, entry);
    }
    if (r.direction === 'money_in') entry.in_cents += r.amount_cents;
    else entry.out_cents += r.amount_cents;
  }

  function sectionFor(
    type: AccountType,
    label: string,
    sign: 'in_minus_out' | 'out_minus_in'
  ): ProfitLossSection {
    const lines: ProfitLossLine[] = [];
    let total = 0;
    for (const [accountId, entry] of byAccount.entries()) {
      if (entry.type !== type) continue;
      const amount =
        sign === 'in_minus_out'
          ? entry.in_cents - entry.out_cents
          : entry.out_cents - entry.in_cents;
      if (amount === 0) continue;
      lines.push({
        account_id: accountId,
        account_name: entry.name,
        account_type: entry.type,
        amount_cents: amount,
      });
      total += amount;
    }
    lines.sort((a, b) => a.account_name.localeCompare(b.account_name));
    return { label, lines, total_cents: total };
  }

  const revenue = sectionFor('revenue', 'Revenue', 'in_minus_out');
  const cogs = sectionFor('cost_of_goods', 'Cost of goods sold', 'out_minus_in');
  const expense = sectionFor('expense', 'Expenses', 'out_minus_in');

  const grossProfit = revenue.total_cents - cogs.total_cents;
  const netProfit = grossProfit - expense.total_cents;

  return {
    start_date: startDate,
    end_date: endDate,
    revenue,
    cost_of_goods: cogs,
    expense,
    gross_profit_cents: grossProfit,
    net_profit_cents: netProfit,
  };
}

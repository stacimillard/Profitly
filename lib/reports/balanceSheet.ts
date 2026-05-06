import { createClient } from '@/lib/supabase/server';

export interface BalanceSheetRow {
  label: string;
  amount_cents: number;
  detail?: string | null;
}

export interface BalanceSheetReport {
  as_of: string;
  cash_accounts: BalanceSheetRow[];
  cash_total_cents: number;
  credit_card_accounts: BalanceSheetRow[];
  credit_card_total_cents: number;
  receivable_total_cents: number;
  receivable_count: number;
  cash_position_cents: number;
  net_worth_cents: number;
}

/**
 * Builds a small-business-friendly balance-sheet-ish snapshot:
 *   Cash position = chequing + savings − credit card balances owed
 *   Net worth     = cash position + accounts receivable (unpaid invoices)
 *
 * Not full double-entry accounting — Profitly intentionally keeps this
 * approachable. Once we add full accounting we can swap this for a real
 * balance sheet.
 */
export async function getBalanceSheet(
  asOf: string
): Promise<BalanceSheetReport> {
  const supabase = await createClient();

  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('id, name, type, last_four, current_balance_cents')
    .eq('is_active', true);

  const cashRows: BalanceSheetRow[] = [];
  const cardRows: BalanceSheetRow[] = [];
  let cashTotal = 0;
  let cardTotal = 0;

  for (const b of bankAccounts ?? []) {
    const detail = b.last_four ? `···· ${b.last_four}` : null;
    if (b.type === 'credit_card') {
      cardTotal += b.current_balance_cents;
      cardRows.push({
        label: b.name,
        amount_cents: b.current_balance_cents,
        detail,
      });
    } else {
      cashTotal += b.current_balance_cents;
      cashRows.push({
        label: b.name,
        amount_cents: b.current_balance_cents,
        detail,
      });
    }
  }

  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('id, total_cents, status, due_date')
    .in('status', ['sent', 'overdue'])
    .lte('issue_date', asOf);

  const receivableTotal =
    (openInvoices ?? []).reduce((acc, inv) => acc + inv.total_cents, 0) || 0;
  const receivableCount = (openInvoices ?? []).length;

  const cashPosition = cashTotal - cardTotal;
  const netWorth = cashPosition + receivableTotal;

  return {
    as_of: asOf,
    cash_accounts: cashRows,
    cash_total_cents: cashTotal,
    credit_card_accounts: cardRows,
    credit_card_total_cents: cardTotal,
    receivable_total_cents: receivableTotal,
    receivable_count: receivableCount,
    cash_position_cents: cashPosition,
    net_worth_cents: netWorth,
  };
}

import { createClient } from '@/lib/supabase/server';

export interface ReconciliationStatusItem {
  bank_account_id: string;
  bank_account_name: string;
  has_completed_recon: boolean;
}

export interface MonthEndChecklist {
  year: number;
  month: number;
  month_label: string;
  is_closed: boolean;
  closed_at: string | null;
  uncategorized_count: number;
  unmatched_receipts_count: number;
  unpaid_bills_count: number;
  reconciliation_status: ReconciliationStatusItem[];
  can_close: boolean;
}

/**
 * Builds the close-the-month checklist for a given (year, month) inside
 * the current user's organization. RLS scopes the queries; the caller
 * must already be authenticated.
 */
export async function getMonthEndChecklist(
  year: number,
  month: number
): Promise<MonthEndChecklist> {
  const supabase = await createClient();

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const startStr = monthStart.toISOString().slice(0, 10);
  const endStr = monthEnd.toISOString().slice(0, 10);
  const monthLabel = monthStart.toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const { data: existingClose } = await supabase
    .from('closed_months')
    .select('id, closed_at')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  const { count: uncategorizedCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .gte('date', startStr)
    .lte('date', endStr)
    .eq('status', 'uncategorized');

  const { count: unmatchedReceipts } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .gte('receipt_date', startStr)
    .lte('receipt_date', endStr)
    .eq('status', 'unmatched');

  const { count: unpaidBillsInMonth } = await supabase
    .from('bills')
    .select('id', { count: 'exact', head: true })
    .gte('bill_date', startStr)
    .lte('bill_date', endStr)
    .eq('status', 'unpaid');

  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const reconciliationStatus: ReconciliationStatusItem[] = [];
  for (const bank of bankAccounts ?? []) {
    const { data: recon } = await supabase
      .from('reconciliations')
      .select('id')
      .eq('bank_account_id', bank.id)
      .eq('status', 'completed')
      .gte('statement_end_date', endStr)
      .limit(1)
      .maybeSingle();
    reconciliationStatus.push({
      bank_account_id: bank.id,
      bank_account_name: bank.name,
      has_completed_recon: !!recon,
    });
  }

  const isClosed = !!existingClose;
  const canClose =
    !isClosed &&
    (uncategorizedCount ?? 0) === 0 &&
    (unmatchedReceipts ?? 0) === 0 &&
    reconciliationStatus.every((r) => r.has_completed_recon);

  return {
    year,
    month,
    month_label: monthLabel,
    is_closed: isClosed,
    closed_at: existingClose?.closed_at ?? null,
    uncategorized_count: uncategorizedCount ?? 0,
    unmatched_receipts_count: unmatchedReceipts ?? 0,
    unpaid_bills_count: unpaidBillsInMonth ?? 0,
    reconciliation_status: reconciliationStatus,
    can_close: canClose,
  };
}

/**
 * Recompute and persist the user's closed-months streak.
 * A streak is the number of consecutive closed months ending at the
 * most recently closed month. Called after close + reopen.
 */
export async function recomputeStreakForCurrentUser(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: closedMonths } = await supabase
    .from('closed_months')
    .select('year, month')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  const sorted = (closedMonths ?? []) as { year: number; month: number }[];

  let streak = 0;
  if (sorted.length > 0) {
    streak = 1;
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      let expectedYear = prev.year;
      let expectedMonth = prev.month - 1;
      if (expectedMonth === 0) {
        expectedMonth = 12;
        expectedYear--;
      }
      if (curr.year === expectedYear && curr.month === expectedMonth) {
        streak++;
        prev = curr;
      } else {
        break;
      }
    }
  }

  await supabase
    .from('profiles')
    .update({ closed_months_streak: streak })
    .eq('id', user.id);

  return streak;
}

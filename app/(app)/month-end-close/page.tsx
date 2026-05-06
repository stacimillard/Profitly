import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { getMonthEndChecklist } from '@/lib/monthEnd/checklist';
import { MonthEndCloseView } from '@/components/monthEnd/MonthEndCloseView';
import type { ClosedMonth } from '@/lib/types';
import { formatMonthYear } from '@/lib/utils/format';

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function MonthEndClosePage({ searchParams }: Props) {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const params = await searchParams;

  // Default to the previous month (most common close target).
  const now = new Date();
  let defaultYear = now.getFullYear();
  let defaultMonth = now.getMonth(); // already 0-based; -1 from current month works:
  if (defaultMonth === 0) {
    defaultMonth = 12;
    defaultYear -= 1;
  }

  const year = Number.parseInt(params.year ?? '', 10) || defaultYear;
  const monthRaw = Number.parseInt(params.month ?? '', 10) || defaultMonth;
  const month = Math.max(1, Math.min(12, monthRaw));

  const checklist = await getMonthEndChecklist(year, month);

  // Build month picker options for the last 12 months.
  const monthOptions: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    monthOptions.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: formatMonthYear(d.getMonth() + 1, d.getFullYear()),
    });
  }

  const supabase = await createClient();
  const { data: closed } = await supabase
    .from('closed_months')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(12);

  return (
    <MonthEndCloseView
      checklist={checklist}
      recentlyClosed={(closed as ClosedMonth[]) ?? []}
      currentStreak={ctx.profile.closed_months_streak}
      monthOptions={monthOptions}
    />
  );
}

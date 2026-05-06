import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { WinJournalView } from '@/components/winJournal/WinJournalView';
import type { WinJournalEntry } from '@/lib/types';

export default async function WinJournalPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data } = await supabase
    .from('win_journal_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  return (
    <WinJournalView initialEntries={(data as WinJournalEntry[]) ?? []} />
  );
}

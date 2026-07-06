import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { BillsView } from '@/components/bills/BillsView';
import type { Bill } from '@/lib/types';

export default async function BillsPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data } = await supabase
    .from('bills')
    .select('*')
    .order('status', { ascending: true })
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: false });

  return <BillsView initialBills={(data as Bill[]) ?? []} />;
}

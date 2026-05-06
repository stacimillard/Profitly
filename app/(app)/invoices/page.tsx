import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { InvoicesView } from '@/components/invoices/InvoicesView';
import type { Invoice } from '@/lib/types';

export default async function InvoicesPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select('*')
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false });

  return <InvoicesView initialInvoices={(data as Invoice[]) ?? []} />;
}

import { redirect, notFound } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { InvoiceDetailView } from '@/components/invoices/InvoiceDetailView';
import type {
  Account,
  BankAccount,
  Invoice,
  InvoiceLineItem,
} from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!invoice) notFound();

  const [{ data: items }, { data: revenueAccounts }, { data: bankAccounts }] =
    await Promise.all([
      supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .eq('type', 'revenue')
        .order('name', { ascending: true }),
      supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);

  return (
    <InvoiceDetailView
      invoice={invoice as Invoice}
      items={(items as InvoiceLineItem[]) ?? []}
      revenueAccounts={(revenueAccounts as Account[]) ?? []}
      bankAccounts={(bankAccounts as BankAccount[]) ?? []}
    />
  );
}

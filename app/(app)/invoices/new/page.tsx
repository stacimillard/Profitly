import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { nextInvoiceNumber } from '@/lib/invoices/numbering';
import { InvoiceFormView } from '@/components/invoices/InvoiceFormView';

export default async function NewInvoicePage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();

  const defaultNumber = await nextInvoiceNumber(supabase);

  const { data: org } = await supabase
    .from('organizations')
    .select('default_gst_hst_rate')
    .eq('id', ctx.organizationId)
    .maybeSingle();

  return (
    <InvoiceFormView
      defaultInvoiceNumber={defaultNumber}
      defaultGstHstRate={Number(org?.default_gst_hst_rate ?? 0.05)}
    />
  );
}

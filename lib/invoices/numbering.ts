import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the next auto-generated invoice number for the current
 * organization in the format INV-YYYY-NNNN (e.g. INV-2026-0017).
 * Race conditions are possible — the unique constraint on
 * (organization_id, invoice_number) makes them safe; callers should
 * retry on a 23505 error.
 */
export async function nextInvoiceNumber(
  supabase: SupabaseClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .ilike('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let next = 1;
  if (data?.invoice_number) {
    const match = (data.invoice_number as string).match(/^INV-\d{4}-(\d+)$/);
    if (match) next = parseInt(match[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  ReceiptsView,
  type ReceiptWithTransaction,
  type UnmatchedTransaction,
} from '@/components/receipts/ReceiptsView';

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export default async function ReceiptsPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();

  const { data: receiptsRaw } = await supabase
    .from('receipts')
    .select(
      '*, transactions:transaction_id(id, date, description, amount_cents, direction)'
    )
    .order('receipt_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const receipts = (receiptsRaw ?? []) as ReceiptWithTransaction[];

  // Generate signed URLs for each file. We do them sequentially-ish via
  // Promise.all for speed; receipts are typically a manageable count.
  const withSigned = await Promise.all(
    receipts.map(async (r) => {
      if (!r.file_url) return { ...r, signed_url: null };
      const { data } = await supabase.storage
        .from('receipts')
        .createSignedUrl(r.file_url, SIGNED_URL_TTL);
      return { ...r, signed_url: data?.signedUrl ?? null };
    })
  );

  // Pre-load a pool of recent transactions that don't have a receipt yet.
  // Used by the "match to transaction" modal.
  const matchedIds = withSigned
    .map((r) => r.transactions?.id)
    .filter((id): id is string => !!id);

  let txnQuery = supabase
    .from('transactions')
    .select('id, date, description, amount_cents, direction')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (matchedIds.length > 0) {
    txnQuery = txnQuery.not(
      'id',
      'in',
      `(${matchedIds.map((id) => `"${id}"`).join(',')})`
    );
  }
  const { data: txns } = await txnQuery;

  return (
    <ReceiptsView
      initialReceipts={withSigned}
      unmatchedTransactions={(txns as UnmatchedTransaction[]) ?? []}
    />
  );
}

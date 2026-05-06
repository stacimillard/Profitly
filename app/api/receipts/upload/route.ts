import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, matches bucket config

/**
 * POST /api/receipts/upload
 * FormData: file (the receipt), and optional vendor / receipt_date /
 * amount_cents / gst_hst_amount_cents / notes / transaction_id.
 *
 * Uploads to the private "receipts" Supabase Storage bucket at
 * {organization_id}/{timestamp}-{uuid}-{filename} and creates a
 * receipts row pointing at it. Optionally matches to a transaction
 * in the same call.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Hmm, that didn't upload right. Try again?" },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Pick a file to upload.' },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'Receipts must be an image (JPG/PNG/WebP/HEIC) or PDF.' },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'That file is bigger than 10 MB. Try a smaller version.' },
      { status: 400 }
    );
  }

  const vendor = (formData.get('vendor') ?? '').toString().trim() || null;
  const receiptDate =
    (formData.get('receipt_date') ?? '').toString().trim() || null;
  const amountRaw = (formData.get('amount_cents') ?? '').toString();
  const amountCents = amountRaw && Number.isFinite(Number(amountRaw))
    ? Math.round(Number(amountRaw))
    : null;
  const gstRaw = (formData.get('gst_hst_amount_cents') ?? '').toString();
  const gstCents = gstRaw && Number.isFinite(Number(gstRaw))
    ? Math.round(Number(gstRaw))
    : 0;
  const notes = (formData.get('notes') ?? '').toString().trim() || null;
  const transactionIdRaw = (formData.get('transaction_id') ?? '').toString().trim();
  const transactionId = transactionIdRaw || null;

  // Build storage path: <org>/<timestamp>-<random>-<safe filename>
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const random = Math.random().toString(36).slice(2, 10);
  const path = `${ctx.organizationId}/${Date.now()}-${random}-${safeName}`;

  const supabase = await createClient();

  // Upload to storage (RLS policies enforce org-scoped folder).
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    );
  }

  // Insert the receipt record.
  const { data: receipt, error: insertError } = await supabase
    .from('receipts')
    .insert({
      organization_id: ctx.organizationId,
      transaction_id: transactionId,
      file_url: path,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      vendor,
      receipt_date: receiptDate,
      amount_cents: amountCents,
      gst_hst_amount_cents: gstCents,
      notes,
      status: transactionId ? 'matched' : 'unmatched',
    })
    .select()
    .single();

  if (insertError || !receipt) {
    // Roll back the storage upload so we don't leak orphan files.
    await supabase.storage.from('receipts').remove([path]);
    return NextResponse.json(
      { error: insertError?.message || "Couldn't save the receipt." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: receipt });
}

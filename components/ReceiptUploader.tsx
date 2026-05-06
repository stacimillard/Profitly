'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface ReceiptUploaderProps {
  /** Optional transaction id to attach the receipt to immediately. */
  transactionId?: string;
  /** Called on every successful upload (caller can refresh data). */
  onUploaded?: () => void;
  /** Compact variant (single-row) for embedding in modals. */
  compact?: boolean;
}

/**
 * Drag-and-drop (or click) uploader for one or more receipt files.
 * Sends each file to /api/receipts/upload one at a time. Reports a
 * status line per file as it uploads.
 */
export function ReceiptUploader({
  transactionId,
  onUploaded,
  compact = false,
}: ReceiptUploaderProps) {
  const router = useRouter();
  const [status, setStatus] = useState<{
    uploading: number;
    uploaded: number;
    failed: number;
    error: string | null;
  }>({ uploading: 0, uploaded: 0, failed: 0, error: null });

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      setStatus({
        uploading: accepted.length,
        uploaded: 0,
        failed: 0,
        error: null,
      });

      let uploaded = 0;
      let failed = 0;
      let firstError: string | null = null;

      for (const file of accepted) {
        const fd = new FormData();
        fd.append('file', file);
        if (transactionId) fd.append('transaction_id', transactionId);

        const res = await fetch('/api/receipts/upload', {
          method: 'POST',
          body: fd,
        });
        if (res.ok) {
          uploaded++;
        } else {
          failed++;
          if (!firstError) {
            const body = await res.json().catch(() => ({}));
            firstError = body.error ?? "Couldn't upload that one.";
          }
        }
      }

      setStatus({
        uploading: 0,
        uploaded,
        failed,
        error: firstError,
      });
      onUploaded?.();
      router.refresh();
    },
    [router, transactionId, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
      'image/heic': [],
      'image/heif': [],
      'application/pdf': [],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  });

  const isUploading = status.uploading > 0;

  return (
    <div>
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center text-center cursor-pointer rounded-xl border-2 border-dashed transition-colors ${
          isDragActive
            ? 'border-brand-teal bg-brand-teal/5'
            : 'border-surface-border bg-surface-muted/40 hover:bg-surface-muted'
        } ${compact ? 'px-4 py-6' : 'px-6 py-10'}`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 text-brand-teal mb-2 animate-spin" />
            <span className="font-medium text-brand-ink">
              Uploading {status.uploading}{' '}
              {status.uploading === 1 ? 'receipt' : 'receipts'}…
            </span>
          </>
        ) : (
          <>
            {compact ? (
              <FileText className="h-5 w-5 text-brand-ink/40 mb-1" />
            ) : (
              <Upload className="h-7 w-7 text-brand-ink/40 mb-2" />
            )}
            <span className="font-medium text-brand-ink">
              {isDragActive
                ? 'Drop receipts here…'
                : 'Drag receipts here or click to upload'}
            </span>
            {!compact && (
              <span className="text-xs text-brand-ink/60 mt-1">
                JPG, PNG, WebP, HEIC, or PDF · up to 10 MB each
              </span>
            )}
          </>
        )}
      </div>

      {(status.uploaded > 0 || status.failed > 0 || status.error) && (
        <div className="mt-3 text-sm">
          {status.uploaded > 0 && (
            <p className="text-brand-ink/80">
              Uploaded {status.uploaded}{' '}
              {status.uploaded === 1 ? 'receipt' : 'receipts'}.
            </p>
          )}
          {status.error && <p className="text-red-600 mt-1">{status.error}</p>}
        </div>
      )}
    </div>
  );
}

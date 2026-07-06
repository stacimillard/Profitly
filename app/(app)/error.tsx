'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="font-heading font-bold text-2xl text-brand-ink mb-3">
        Something went wrong on our end.
      </h1>
      <p className="text-brand-ink/70 leading-relaxed mb-6">
        Sorry about that — we&rsquo;ve been notified and are looking into it.
        You can try again below. If it keeps happening, email us at{' '}
        <a
          href="mailto:hello@stacimillard.com?subject=Profitly%20Help%20Request"
          className="text-brand-teal underline"
        >
          hello@stacimillard.com
        </a>
        .
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = '/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

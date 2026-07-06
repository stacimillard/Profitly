'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#ffffff',
          color: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Something went wrong on our end.
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: '#475569',
              marginBottom: 24,
            }}
          >
            Sorry about that — we&rsquo;ve been notified and are looking into
            it. You can try again, or head back to your dashboard. If it keeps
            happening, email us at{' '}
            <a
              href="mailto:hello@stacimillard.com?subject=Profitly%20Help%20Request"
              style={{ color: '#0d9488', textDecoration: 'underline' }}
            >
              hello@stacimillard.com
            </a>
            .
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                background: '#0d9488',
                color: 'white',
                border: 0,
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                background: 'white',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

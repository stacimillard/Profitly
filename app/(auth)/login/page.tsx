'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginForm nextParam={null} />}>
      <LoginFormWithSearchParams />
    </Suspense>
  );
}

function LoginFormWithSearchParams() {
  const searchParams = useSearchParams();
  return <LoginForm nextParam={searchParams.get('next')} />;
}

function LoginForm({ nextParam }: { nextParam: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(
        "Hmm, that didn't work. Double-check your email and password and try again."
      );
      return;
    }

    // Middleware bounces unauth users to /login?next=<original path> — send
    // them back there if it's an in-app path.
    const next =
      nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? nextParam
        : '/dashboard';
    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-brand-ink">
        Welcome back.
      </h1>
      <p className="mt-2 text-brand-ink/70">Let&apos;s check on your books.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-brand-ink"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-lg border border-surface-border bg-white text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-teal"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-brand-ink"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-lg border border-surface-border bg-white text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-teal"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-brand-pink/15 border border-brand-pink/30 px-4 py-3 text-sm text-brand-ink">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Signing you in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-brand-ink/70 text-center">
        New to Profitly?{' '}
        <Link
          href="/signup"
          className="text-brand-teal font-medium hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

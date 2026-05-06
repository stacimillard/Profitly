'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        business_name: businessName,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something didn't work. Try again?");
      setLoading(false);
      return;
    }

    // Establish a browser session so middleware sees us as logged in.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(
        'Account created, but we had trouble signing you in. Try logging in.'
      );
      return;
    }

    router.push('/welcome');
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-brand-ink">
        Let&apos;s get you set up.
      </h1>
      <p className="mt-2 text-brand-ink/70">
        Takes about a minute. We&apos;ll get your books ready to roll.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <label
            htmlFor="full_name"
            className="block text-sm font-medium text-brand-ink"
          >
            Your name
          </label>
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-lg border border-surface-border bg-white text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-teal"
            placeholder="Jamie Bennett"
          />
        </div>

        <div>
          <label
            htmlFor="business_name"
            className="block text-sm font-medium text-brand-ink"
          >
            Business name
          </label>
          <input
            id="business_name"
            type="text"
            autoComplete="organization"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-lg border border-surface-border bg-white text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-teal"
            placeholder="Bennett Studio"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-lg border border-surface-border bg-white text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-teal"
            placeholder="At least 8 characters"
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
          {loading ? 'Setting up your books…' : 'Create my account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-brand-ink/70 text-center">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-brand-teal font-medium hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 * Use inside Client Components ('use client') for queries that
 * should run in the user's browser using their session cookie.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

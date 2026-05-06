import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

export interface CurrentOrgContext {
  user: User;
  profile: Profile;
  organizationId: string;
}

/**
 * Returns the current authenticated user, their profile, and their
 * organization id — or null if the request isn't authenticated yet
 * or the profile hasn't been created.
 *
 * Use this in Server Components and pages that should redirect on
 * missing auth (you can branch on null and call `redirect('/login')`).
 */
export async function getCurrentOrganization(): Promise<CurrentOrgContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    user,
    profile: profile as Profile,
    organizationId: profile.organization_id,
  };
}

/**
 * Same as getCurrentOrganization, but throws a 401-style Response when
 * the request isn't authenticated. Use this inside API route handlers
 * so every route can `const ctx = await requireCurrentOrganization();`
 * and rely on `ctx.organizationId` being non-null below.
 */
export async function requireCurrentOrganization(): Promise<CurrentOrgContext> {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    throw new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return ctx;
}

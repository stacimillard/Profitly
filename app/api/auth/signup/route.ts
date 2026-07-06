import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { STANDARD_ACCOUNTS } from '@/lib/data/defaultAccounts';

interface SignupBody {
  email?: string;
  password?: string;
  full_name?: string;
  business_name?: string;
}

/**
 * POST /api/auth/signup
 * Body: { email, password, full_name, business_name }
 *
 * 1. Creates the auth user (auto-confirmed — no email verification step)
 * 2. Creates an organization
 * 3. Creates the user's profile linking them to that organization
 * 4. Seeds the standard chart of accounts
 *
 * On any failure after step 1, the auth user is deleted so the email
 * can be retried.
 */
export async function POST(request: NextRequest) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that. Try again?" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const fullName = body.full_name?.trim();
  const businessName = body.business_name?.trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email.' },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Password needs to be at least 8 characters.' },
      { status: 400 }
    );
  }
  if (!fullName) {
    return NextResponse.json(
      { error: 'Please tell us your name.' },
      { status: 400 }
    );
  }
  if (!businessName) {
    return NextResponse.json(
      { error: 'Please give us your business name.' },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();

  // 1. Create the auth user.
  let userData, userError;
  try {
    ({ data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }));
  } catch (err) {
    // Network/DNS failures throw instead of returning an error field.
    console.error('[signup] createUser threw:', err);
    return NextResponse.json(
      {
        error:
          "We couldn't reach the auth service. Check that NEXT_PUBLIC_SUPABASE_URL points at a live project and try again.",
      },
      { status: 502 }
    );
  }

  if (userError || !userData?.user) {
    console.error('[signup] createUser error:', userError);
    const raw = userError?.message ?? '';
    // Supabase SDK wraps DNS/connection failures as AuthRetryableFetchError
    // with message "fetch failed" and status 0. Surface a targeted message
    // so operators know the auth backend can't be reached.
    if (raw.includes('fetch failed') || userError?.status === 0) {
      return NextResponse.json(
        {
          error:
            "We couldn't reach the auth service. Check that NEXT_PUBLIC_SUPABASE_URL points at a live project and try again.",
        },
        { status: 502 }
      );
    }
    const msg = raw.includes('already')
      ? 'Looks like an account with that email already exists. Try logging in instead.'
      : "We couldn't create your account. Try again?";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = userData.user.id;

  // 2. Create the organization.
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: businessName })
    .select()
    .single();

  if (orgError || !org) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "We couldn't set up your books. Try again?" },
      { status: 500 }
    );
  }

  // 3. Create the profile.
  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    organization_id: org.id,
    full_name: fullName,
    email,
  });

  if (profileError) {
    await admin.from('organizations').delete().eq('id', org.id);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "We couldn't finish setting up your account. Try again?" },
      { status: 500 }
    );
  }

  // 4. Seed default chart of accounts.
  const accountRows = STANDARD_ACCOUNTS.map((a) => ({
    organization_id: org.id,
    name: a.name,
    type: a.type,
    description: a.description,
    is_default: true,
  }));

  const { error: accountsError } = await admin.from('accounts').insert(accountRows);
  if (accountsError) {
    // Don't roll back signup over this — log so we can investigate.
    console.error('Failed to seed default accounts:', accountsError);
  }

  return NextResponse.json({
    data: { userId, organizationId: org.id },
  });
}

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  CONDITIONAL_ACCOUNTS,
  type AccountSeed,
} from '@/lib/data/defaultAccounts';

interface OnboardingBody {
  has_inventory?: boolean;
  has_prepaid_expenses?: boolean;
  has_deferred_revenue?: boolean;
  has_loans?: boolean;
  has_equipment?: boolean;
}

interface AccountInsert {
  organization_id: string;
  name: string;
  type: AccountSeed['type'];
  description: string | null;
  is_default: boolean;
}

/**
 * POST /api/onboarding
 *
 * Saves the five yes/no onboarding answers on the organization,
 * inserts any conditional accounts those answers unlock, and marks
 * onboarding as complete so the user is sent to the dashboard.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  let body: OnboardingBody;
  try {
    body = (await request.json()) as OnboardingBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const flags = {
    has_inventory: !!body.has_inventory,
    has_prepaid_expenses: !!body.has_prepaid_expenses,
    has_deferred_revenue: !!body.has_deferred_revenue,
    has_loans: !!body.has_loans,
    has_equipment: !!body.has_equipment,
  };

  const admin = createServiceRoleClient();

  // 1. Update the organization with the answers + mark onboarding complete.
  const { error: updateError } = await admin
    .from('organizations')
    .update({ ...flags, onboarding_completed: true })
    .eq('id', ctx.organizationId);

  if (updateError) {
    return NextResponse.json(
      { error: "We couldn't save your answers. Try again?" },
      { status: 500 }
    );
  }

  // 2. Insert conditional accounts for any "yes" answers.
  const conditionalRows: AccountInsert[] = [];
  for (const [key, included] of Object.entries(flags)) {
    if (!included) continue;
    const seeds = CONDITIONAL_ACCOUNTS[key];
    if (!seeds) continue;
    for (const seed of seeds) {
      conditionalRows.push({
        organization_id: ctx.organizationId,
        name: seed.name,
        type: seed.type,
        description: seed.description,
        is_default: true,
      });
    }
  }

  if (conditionalRows.length > 0) {
    const { error: insertError } = await admin
      .from('accounts')
      .insert(conditionalRows);
    if (insertError) {
      // Log but don't fail — onboarding flags already saved.
      console.error('Failed to insert conditional accounts:', insertError);
    }
  }

  return NextResponse.json({ data: { ok: true } });
}

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import type { RuleMatchField, RuleMatchType } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateRuleBody {
  account_id?: string;
  match_field?: string;
  match_type?: string;
  match_pattern?: string;
  is_tax_deductible?: boolean;
  priority?: number;
  is_active?: boolean;
}

const ALLOWED_FIELDS: RuleMatchField[] = ['description', 'vendor'];
const ALLOWED_TYPES: RuleMatchType[] = [
  'contains',
  'equals',
  'starts_with',
  'ends_with',
];

/** GET /api/categorization-rules/[id] */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categorization_rules')
    .select('*, accounts:account_id(name, type)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Rule not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** PATCH /api/categorization-rules/[id] */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  let body: UpdateRuleBody;
  try {
    body = (await request.json()) as UpdateRuleBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.account_id === 'string' && body.account_id) {
    updates.account_id = body.account_id;
  }
  if (typeof body.match_field === 'string') {
    if (!ALLOWED_FIELDS.includes(body.match_field as RuleMatchField)) {
      return NextResponse.json(
        { error: 'Pick what to match against.' },
        { status: 400 }
      );
    }
    updates.match_field = body.match_field;
  }
  if (typeof body.match_type === 'string') {
    if (!ALLOWED_TYPES.includes(body.match_type as RuleMatchType)) {
      return NextResponse.json(
        { error: 'Pick how to match.' },
        { status: 400 }
      );
    }
    updates.match_type = body.match_type;
  }
  if (typeof body.match_pattern === 'string') {
    const pattern = body.match_pattern.trim();
    if (!pattern) {
      return NextResponse.json(
        { error: 'Pattern cannot be empty.' },
        { status: 400 }
      );
    }
    updates.match_pattern = pattern;
  }
  if (typeof body.is_tax_deductible === 'boolean') {
    updates.is_tax_deductible = body.is_tax_deductible;
  }
  if (Number.isFinite(body.priority)) {
    updates.priority = Math.max(0, Math.round(Number(body.priority)));
  }
  if (typeof body.is_active === 'boolean') {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No changes provided.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categorization_rules')
    .update(updates)
    .eq('id', id)
    .select('*, accounts:account_id(name, type)')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Rule not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/** DELETE /api/categorization-rules/[id] — hard delete (rules can be recreated). */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase
    .from('categorization_rules')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}

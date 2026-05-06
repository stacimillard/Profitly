import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

interface UpdateBody {
  name?: string;
  legal_name?: string | null;
  business_number?: string | null;
  fiscal_year_start_month?: number;
  default_gst_hst_rate?: number;
}

/** GET /api/organization — current org details. */
export async function GET() {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', ctx.organizationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Organization not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ data });
}

/** PATCH /api/organization — update org settings. */
export async function PATCH(request: NextRequest) {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return NextResponse.json(
      { error: "Hmm, we couldn't read that." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') {
    const v = body.name.trim();
    if (!v) {
      return NextResponse.json(
        { error: "Business name can't be empty." },
        { status: 400 }
      );
    }
    updates.name = v;
  }
  if ('legal_name' in body) {
    const v = typeof body.legal_name === 'string' ? body.legal_name.trim() : null;
    updates.legal_name = v || null;
  }
  if ('business_number' in body) {
    const v =
      typeof body.business_number === 'string'
        ? body.business_number.trim()
        : null;
    updates.business_number = v || null;
  }
  if (Number.isFinite(body.fiscal_year_start_month)) {
    const m = Math.round(Number(body.fiscal_year_start_month));
    if (m < 1 || m > 12) {
      return NextResponse.json(
        { error: 'Fiscal year start month must be 1–12.' },
        { status: 400 }
      );
    }
    updates.fiscal_year_start_month = m;
  }
  if (Number.isFinite(body.default_gst_hst_rate)) {
    const r = Number(body.default_gst_hst_rate);
    if (r < 0 || r > 1) {
      return NextResponse.json(
        { error: 'GST/HST rate should be between 0 and 1 (e.g. 0.13 for 13%).' },
        { status: 400 }
      );
    }
    updates.default_gst_hst_rate = r;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No changes provided.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', ctx.organizationId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Organization not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ data });
}

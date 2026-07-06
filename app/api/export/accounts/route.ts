import { NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { toCsv } from '@/lib/csv/format';

/** GET /api/export/accounts — returns the chart of accounts as CSV. */
export async function GET() {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('name, type, description, is_active, is_default')
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    name: string;
    type: string;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
  };

  const header = ['Name', 'Type', 'Description', 'Active', 'Default'];
  const rows: (string | number | null | undefined)[][] = [header];
  for (const r of (data as Row[] | null) ?? []) {
    rows.push([
      r.name,
      r.type,
      r.description ?? '',
      r.is_active ? 'Yes' : 'No',
      r.is_default ? 'Yes' : 'No',
    ]);
  }

  const csv = toCsv(rows);
  const filename = `profitly-accounts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

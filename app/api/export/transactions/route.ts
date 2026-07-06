import { NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { toCsv, centsToAmountString } from '@/lib/csv/format';

/** GET /api/export/transactions — returns all transactions as CSV. */
export async function GET() {
  const ctx = await getCurrentOrganization();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'date, description, vendor_normalized, amount_cents, direction, status, is_tax_deductible, gst_hst_amount_cents, notes, source, accounts:account_id(name, type), bank_accounts:bank_account_id(name, last_four)'
    )
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    date: string;
    description: string;
    vendor_normalized: string | null;
    amount_cents: number;
    direction: 'money_in' | 'money_out';
    status: string;
    is_tax_deductible: boolean;
    gst_hst_amount_cents: number;
    notes: string | null;
    source: string;
    accounts: { name: string; type: string } | null;
    bank_accounts: { name: string; last_four: string | null } | null;
  };

  const header = [
    'Date',
    'Description',
    'Vendor',
    'Money in',
    'Money out',
    'Account (category)',
    'Account type',
    'Bank account',
    'Status',
    'Tax deductible',
    'GST/HST amount',
    'Notes',
    'Source',
  ];

  const rows: (string | number | null | undefined)[][] = [header];
  for (const r of ((data as unknown) as Row[] | null) ?? []) {
    const moneyIn = r.direction === 'money_in' ? centsToAmountString(r.amount_cents) : '';
    const moneyOut = r.direction === 'money_out' ? centsToAmountString(r.amount_cents) : '';
    rows.push([
      r.date,
      r.description,
      r.vendor_normalized ?? '',
      moneyIn,
      moneyOut,
      r.accounts?.name ?? '',
      r.accounts?.type ?? '',
      r.bank_accounts
        ? r.bank_accounts.last_four
          ? `${r.bank_accounts.name} (…${r.bank_accounts.last_four})`
          : r.bank_accounts.name
        : '',
      r.status,
      r.is_tax_deductible ? 'Yes' : 'No',
      centsToAmountString(r.gst_hst_amount_cents),
      r.notes ?? '',
      r.source,
    ]);
  }

  const csv = toCsv(rows);
  const filename = `profitly-transactions-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

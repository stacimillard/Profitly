import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  CONDITIONAL_ACCOUNTS,
  type AccountSeed,
} from '@/lib/data/defaultAccounts';
import { gstHstRateForProvince } from '@/lib/data/canadianProvinces';
import type {
  BankImportPreference,
  BusinessStructure,
  MigrationSource,
} from '@/lib/types';

interface TrialBalanceRow {
  account_name?: string;
  balance_cents?: number;
}

interface ReconciliationStartingPoint {
  bank_account_name?: string;
  bank_account_type?: 'chequing' | 'savings' | 'credit_card';
  last_reconciled_balance_cents?: number;
  last_reconciled_date?: string;
}

interface ArLedgerRow {
  customer_name?: string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  amount_cents?: number;
}

interface ApLedgerRow {
  vendor_name?: string;
  bill_date?: string;
  due_date?: string;
  amount_cents?: number;
  notes?: string | null;
}

interface OnboardingBody {
  business_name?: string;
  business_structure?: BusinessStructure;
  province?: string;
  fiscal_year_end_month?: number;
  fiscal_year_end_day?: number;
  has_employees?: boolean;
  migration_source?: MigrationSource | null;
  trial_balance_rows?: TrialBalanceRow[];
  reconciliation_starting_points?: ReconciliationStartingPoint[];
  ar_ledger_rows?: ArLedgerRow[];
  ap_ledger_rows?: ApLedgerRow[];
  has_inventory?: boolean;
  has_prepaid_expenses?: boolean;
  has_deferred_revenue?: boolean;
  has_loans?: boolean;
  has_equipment?: boolean;
  bank_import_preference?: BankImportPreference | null;
  motivations?: string[];
  help_goal?: string;
}

interface AccountInsert {
  organization_id: string;
  name: string;
  type: AccountSeed['type'];
  description: string | null;
  is_default: boolean;
}

/**
 * POST /api/onboarding — save the full onboarding flow.
 * Saves business basics, migration data, feature flags, and preferences.
 * Marks onboarding complete when done.
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

  const orgId = ctx.organizationId;
  const admin = createServiceRoleClient();

  const flags = {
    has_inventory: !!body.has_inventory,
    has_prepaid_expenses: !!body.has_prepaid_expenses,
    has_deferred_revenue: !!body.has_deferred_revenue,
    has_loans: !!body.has_loans,
    has_equipment: !!body.has_equipment,
  };

  const province = body.province ?? null;
  const orgUpdates: Record<string, unknown> = {
    ...flags,
    onboarding_completed: true,
    business_structure: body.business_structure ?? null,
    province,
    fiscal_year_end_month:
      typeof body.fiscal_year_end_month === 'number'
        ? body.fiscal_year_end_month
        : null,
    fiscal_year_end_day:
      typeof body.fiscal_year_end_day === 'number'
        ? body.fiscal_year_end_day
        : null,
    has_employees: !!body.has_employees,
    migration_source: body.migration_source ?? null,
    bank_import_preference: body.bank_import_preference ?? null,
    motivations: Array.isArray(body.motivations) ? body.motivations : [],
    help_goal: body.help_goal?.trim() ? body.help_goal.trim() : null,
    default_gst_hst_rate: gstHstRateForProvince(province),
  };

  if (body.business_name?.trim()) {
    orgUpdates.name = body.business_name.trim();
  }
  if (
    typeof body.fiscal_year_end_month === 'number' &&
    body.fiscal_year_end_month >= 1 &&
    body.fiscal_year_end_month <= 12
  ) {
    // Fiscal year start is the month after the end.
    orgUpdates.fiscal_year_start_month =
      body.fiscal_year_end_month === 12 ? 1 : body.fiscal_year_end_month + 1;
  }

  const { error: updateError } = await admin
    .from('organizations')
    .update(orgUpdates)
    .eq('id', orgId);

  if (updateError) {
    console.error('[onboarding] org update failed:', updateError);
    return NextResponse.json(
      { error: "We couldn't save your answers. Try again?" },
      { status: 500 }
    );
  }

  // Conditional chart-of-accounts additions.
  const conditionalRows: AccountInsert[] = [];
  for (const [key, included] of Object.entries(flags)) {
    if (!included) continue;
    const seeds = CONDITIONAL_ACCOUNTS[key];
    if (!seeds) continue;
    for (const seed of seeds) {
      conditionalRows.push({
        organization_id: orgId,
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
      .upsert(conditionalRows, { onConflict: 'organization_id,name' });
    if (insertError) {
      console.error('[onboarding] conditional accounts failed:', insertError);
    }
  }

  // Trial balance — apply opening balances by matching account name.
  const trialBalance = Array.isArray(body.trial_balance_rows)
    ? body.trial_balance_rows
    : [];
  if (trialBalance.length > 0) {
    const { data: accounts } = await admin
      .from('accounts')
      .select('id, name')
      .eq('organization_id', orgId);
    const accountByName = new Map<string, string>();
    for (const a of accounts ?? []) {
      accountByName.set((a.name as string).toLowerCase(), a.id as string);
    }
    for (const row of trialBalance) {
      const name = row.account_name?.trim();
      const cents = Number.isFinite(row.balance_cents)
        ? Math.round(Number(row.balance_cents))
        : 0;
      if (!name) continue;
      const matchedId = accountByName.get(name.toLowerCase());
      if (matchedId) {
        // Store the opening balance in the description so the user can review.
        // (Full opening-balance journal entries land in a later feature.)
        await admin
          .from('accounts')
          .update({
            description: `Opening balance imported at migration: $${(cents / 100).toFixed(2)}`,
          })
          .eq('id', matchedId);
      }
    }
  }

  // Reconciliation starting points — create the bank accounts and stamp
  // the current_balance_cents so we know where to pick up.
  const recons = Array.isArray(body.reconciliation_starting_points)
    ? body.reconciliation_starting_points
    : [];
  if (recons.length > 0) {
    const { data: chartAccounts } = await admin
      .from('accounts')
      .select('id, name')
      .eq('organization_id', orgId);
    const chartByName = new Map<string, string>();
    for (const a of chartAccounts ?? []) {
      chartByName.set((a.name as string).toLowerCase(), a.id as string);
    }
    const typeToChartName: Record<
      'chequing' | 'savings' | 'credit_card',
      string
    > = {
      chequing: 'chequing account',
      savings: 'savings account',
      credit_card: 'credit card payable',
    };
    const bankRows: Record<string, unknown>[] = [];
    for (const r of recons) {
      const name = r.bank_account_name?.trim();
      const type = r.bank_account_type;
      if (!name || !type) continue;
      const linkedAccountId = chartByName.get(typeToChartName[type]) ?? null;
      bankRows.push({
        organization_id: orgId,
        name,
        type,
        account_id: linkedAccountId,
        current_balance_cents: Number.isFinite(r.last_reconciled_balance_cents)
          ? Math.round(Number(r.last_reconciled_balance_cents))
          : 0,
      });
    }
    if (bankRows.length > 0) {
      const { error: bankError } = await admin
        .from('bank_accounts')
        .insert(bankRows);
      if (bankError) {
        console.error('[onboarding] bank accounts failed:', bankError);
      }
    }
  }

  // AR ledger — import as sent invoices.
  const arRows = Array.isArray(body.ar_ledger_rows) ? body.ar_ledger_rows : [];
  if (arRows.length > 0) {
    // Look up starting invoice number.
    let counter = 1;
    const invoiceRows = arRows
      .map((r) => {
        const customer = r.customer_name?.trim();
        const amount = Number.isFinite(r.amount_cents)
          ? Math.round(Number(r.amount_cents))
          : 0;
        if (!customer || amount === 0) return null;
        const invoiceNumber = r.invoice_number?.trim() || `INV-M${String(counter++).padStart(4, '0')}`;
        const today = new Date().toISOString().slice(0, 10);
        return {
          organization_id: orgId,
          invoice_number: invoiceNumber,
          customer_name: customer,
          issue_date: r.issue_date && /^\d{4}-\d{2}-\d{2}$/.test(r.issue_date) ? r.issue_date : today,
          due_date: r.due_date && /^\d{4}-\d{2}-\d{2}$/.test(r.due_date) ? r.due_date : today,
          status: 'sent' as const,
          subtotal_cents: amount,
          gst_hst_rate: 0,
          gst_hst_amount_cents: 0,
          total_cents: amount,
          sent_at: new Date().toISOString(),
        };
      })
      .filter((r) => r !== null);
    if (invoiceRows.length > 0) {
      const { data: insertedInvoices, error: arError } = await admin
        .from('invoices')
        .insert(invoiceRows)
        .select('id, subtotal_cents');
      if (arError) {
        console.error('[onboarding] AR insert failed:', arError);
      } else if (insertedInvoices) {
        // Add a single-line item per invoice so it renders.
        const lineRows = insertedInvoices.map((inv: { id: string; subtotal_cents: number }) => ({
          organization_id: orgId,
          invoice_id: inv.id,
          description: 'Migrated open balance',
          quantity: 1,
          unit_price_cents: inv.subtotal_cents,
          amount_cents: inv.subtotal_cents,
          sort_order: 0,
        }));
        await admin.from('invoice_line_items').insert(lineRows);
      }
    }
  }

  // AP ledger — import as unpaid bills.
  const apRows = Array.isArray(body.ap_ledger_rows) ? body.ap_ledger_rows : [];
  if (apRows.length > 0) {
    const billRows = apRows
      .map((r) => {
        const vendor = r.vendor_name?.trim();
        const amount = Number.isFinite(r.amount_cents)
          ? Math.round(Number(r.amount_cents))
          : 0;
        if (!vendor || amount === 0) return null;
        const today = new Date().toISOString().slice(0, 10);
        return {
          organization_id: orgId,
          vendor_name: vendor,
          bill_date: r.bill_date && /^\d{4}-\d{2}-\d{2}$/.test(r.bill_date) ? r.bill_date : today,
          due_date: r.due_date && /^\d{4}-\d{2}-\d{2}$/.test(r.due_date) ? r.due_date : today,
          amount_cents: amount,
          notes: r.notes ?? null,
          status: 'unpaid' as const,
        };
      })
      .filter((r) => r !== null);
    if (billRows.length > 0) {
      const { error: apError } = await admin.from('bills').insert(billRows);
      if (apError) {
        console.error('[onboarding] AP insert failed:', apError);
      }
    }
  }

  return NextResponse.json({ data: { ok: true } });
}

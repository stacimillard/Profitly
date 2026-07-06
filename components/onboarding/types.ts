import type {
  BankImportPreference,
  BusinessStructure,
  MigrationSource,
} from '@/lib/types';

export interface TrialBalanceRow {
  account_name: string;
  balance_cents: number;
}

export interface ReconciliationStartingPoint {
  bank_account_name: string;
  bank_account_type: 'chequing' | 'savings' | 'credit_card';
  last_reconciled_balance_cents: number;
  last_reconciled_date: string;
}

export interface ArLedgerRow {
  customer_name: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount_cents: number;
}

export interface ApLedgerRow {
  vendor_name: string;
  bill_date: string;
  due_date: string;
  amount_cents: number;
  notes: string | null;
}

export interface OnboardingData {
  business_name: string;
  business_structure: BusinessStructure;
  province: string;
  fiscal_year_end_month: number;
  fiscal_year_end_day: number;
  has_employees: boolean;
  migration_source: MigrationSource | null;
  trial_balance_rows: TrialBalanceRow[];
  reconciliation_starting_points: ReconciliationStartingPoint[];
  ar_ledger_rows: ArLedgerRow[];
  ap_ledger_rows: ApLedgerRow[];
  has_inventory: boolean;
  has_prepaid_expenses: boolean;
  has_deferred_revenue: boolean;
  has_loans: boolean;
  has_equipment: boolean;
  bank_import_preference: BankImportPreference | null;
  motivations: string[];
  help_goal: string;
}

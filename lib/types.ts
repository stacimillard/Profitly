/**
 * Shared TypeScript types mirroring the Profitly database schema.
 * These match the columns defined in supabase/migrations/0001_initial_schema.sql.
 */

// ───────────────── ENUMS ─────────────────

export type AccountType =
  | 'revenue'
  | 'cost_of_goods'
  | 'expense'
  | 'asset'
  | 'liability'
  | 'equity';

export type BankAccountType = 'chequing' | 'savings' | 'credit_card';

export type TransactionStatus =
  | 'uncategorized'
  | 'categorized'
  | 'reconciled';

export type TransactionDirection = 'money_in' | 'money_out';

export type TransactionSource =
  | 'manual'
  | 'csv_import'
  | 'invoice'
  | 'reconciliation';

export type ReceiptStatus = 'unmatched' | 'matched';

export type RuleMatchField = 'description' | 'vendor';

export type RuleMatchType =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'ends_with';

export type ReconciliationStatus = 'in_progress' | 'completed';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'void';

export type BillStatus = 'unpaid' | 'paid' | 'overdue' | 'void';

export type BusinessStructure =
  | 'sole_proprietor'
  | 'partnership'
  | 'corporation'
  | 'other';

export type MigrationSource =
  | 'brand_new'
  | 'quickbooks'
  | 'wave'
  | 'spreadsheets'
  | 'other';

export type BankImportPreference = 'import' | 'manual';

// ───────────────── TABLE ROW TYPES ─────────────────

export interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  business_number: string | null;
  fiscal_year_start_month: number;
  default_gst_hst_rate: number;
  has_inventory: boolean;
  has_prepaid_expenses: boolean;
  has_deferred_revenue: boolean;
  has_loans: boolean;
  has_equipment: boolean;
  onboarding_completed: boolean;
  business_structure: BusinessStructure | null;
  province: string | null;
  fiscal_year_end_month: number | null;
  fiscal_year_end_day: number | null;
  has_employees: boolean;
  migration_source: MigrationSource | null;
  bank_import_preference: BankImportPreference | null;
  motivations: string[];
  help_goal: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string | null;
  email: string;
  ceo_tier: number;
  closed_months_streak: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  organization_id: string;
  name: string;
  type: AccountType;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  organization_id: string;
  account_id: string | null;
  name: string;
  type: BankAccountType;
  institution: string | null;
  last_four: string | null;
  current_balance_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  organization_id: string;
  transaction_id: string | null;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  vendor: string | null;
  receipt_date: string | null;
  amount_cents: number | null;
  gst_hst_amount_cents: number;
  notes: string | null;
  status: ReceiptStatus;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  organization_id: string;
  bank_account_id: string | null;
  account_id: string | null;
  date: string;
  description: string;
  vendor_normalized: string | null;
  amount_cents: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  is_tax_deductible: boolean;
  gst_hst_amount_cents: number;
  notes: string | null;
  source: TransactionSource;
  applied_rule_id: string | null;
  ai_suggested_account_id: string | null;
  ai_suggestion_confidence: number | null;
  ai_suggestion_reasoning: string | null;
  reconciliation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategorizationRule {
  id: string;
  organization_id: string;
  account_id: string;
  match_field: RuleMatchField;
  match_type: RuleMatchType;
  match_pattern: string;
  is_tax_deductible: boolean;
  priority: number;
  times_applied: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reconciliation {
  id: string;
  organization_id: string;
  bank_account_id: string;
  statement_start_date: string;
  statement_end_date: string;
  statement_starting_balance_cents: number;
  statement_ending_balance_cents: number;
  status: ReconciliationStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationLine {
  id: string;
  organization_id: string;
  reconciliation_id: string;
  statement_date: string;
  statement_description: string;
  statement_amount_cents: number;
  matched_transaction_id: string | null;
  is_matched: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClosedMonth {
  id: string;
  organization_id: string;
  closed_by_profile_id: string | null;
  month: number;
  year: number;
  closed_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  gst_hst_rate: number;
  gst_hst_amount_cents: number;
  total_cents: number;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  paid_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  organization_id: string;
  invoice_id: string;
  account_id: string | null;
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  organization_id: string;
  vendor_name: string;
  bill_date: string;
  due_date: string;
  amount_cents: number;
  account_id: string | null;
  notes: string | null;
  status: BillStatus;
  paid_at: string | null;
  paid_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WinJournalEntry {
  id: string;
  organization_id: string;
  profile_id: string | null;
  title: string;
  description: string | null;
  amount_cents: number | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

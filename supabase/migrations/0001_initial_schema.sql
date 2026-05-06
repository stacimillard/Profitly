-- =====================================================================
-- Profitly — Initial Schema (0001)
-- Multi-tenant Canadian small business bookkeeping
-- All money stored as bigint cents (e.g. $12.50 = 1250)
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- Trigger function: keeps updated_at fresh on every UPDATE
-- =====================================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- ENUMS
-- =====================================================================
create type public.account_type as enum (
  'revenue',
  'cost_of_goods',
  'expense',
  'asset',
  'liability',
  'equity'
);

create type public.bank_account_type as enum (
  'chequing',
  'savings',
  'credit_card'
);

create type public.transaction_status as enum (
  'uncategorized',
  'categorized',
  'reconciled'
);

create type public.transaction_direction as enum (
  'money_in',
  'money_out'
);

create type public.transaction_source as enum (
  'manual',
  'csv_import',
  'invoice',
  'reconciliation'
);

create type public.receipt_status as enum (
  'unmatched',
  'matched'
);

create type public.rule_match_field as enum (
  'description',
  'vendor'
);

create type public.rule_match_type as enum (
  'contains',
  'equals',
  'starts_with',
  'ends_with'
);

create type public.reconciliation_status as enum (
  'in_progress',
  'completed'
);

create type public.invoice_status as enum (
  'draft',
  'sent',
  'paid',
  'overdue',
  'void'
);

-- =====================================================================
-- ORGANIZATIONS (one per business, the tenant boundary)
-- =====================================================================
create table public.organizations (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  legal_name               text,
  business_number          text,
  fiscal_year_start_month  int  not null default 1 check (fiscal_year_start_month between 1 and 12),
  default_gst_hst_rate     numeric(5,4) not null default 0.05,
  has_inventory            boolean not null default false,
  has_prepaid_expenses     boolean not null default false,
  has_deferred_revenue     boolean not null default false,
  has_loans                boolean not null default false,
  has_equipment            boolean not null default false,
  onboarding_completed     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- PROFILES (one per auth user, links them to an organization)
-- =====================================================================
create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  full_name              text,
  email                  text not null,
  ceo_tier               int  not null default 1,
  closed_months_streak   int  not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_profiles_organization_id on public.profiles(organization_id);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- HELPER: returns the current user's organization id (for RLS policies)
-- =====================================================================
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- =====================================================================
-- ACCOUNTS (the chart of accounts for each organization)
-- =====================================================================
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  type             public.account_type not null,
  description      text,
  is_active        boolean not null default true,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, name)
);

create index idx_accounts_organization_id on public.accounts(organization_id);
create index idx_accounts_type            on public.accounts(type);

create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- BANK ACCOUNTS (the actual chequing/credit cards the user banks with)
-- =====================================================================
create table public.bank_accounts (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  account_id             uuid references public.accounts(id) on delete set null,
  name                   text not null,
  type                   public.bank_account_type not null,
  institution            text,
  last_four              text,
  current_balance_cents  bigint not null default 0,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_bank_accounts_organization_id on public.bank_accounts(organization_id);

create trigger trg_bank_accounts_updated_at
  before update on public.bank_accounts
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- RECEIPTS (uploaded files; can exist before a transaction is matched)
-- =====================================================================
create table public.receipts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  transaction_id        uuid,  -- FK added after transactions table exists
  file_url              text not null,
  file_name             text not null,
  file_size_bytes       bigint,
  mime_type             text,
  vendor                text,
  receipt_date          date,
  amount_cents          bigint,
  gst_hst_amount_cents  bigint default 0,
  notes                 text,
  status                public.receipt_status not null default 'unmatched',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_receipts_organization_id on public.receipts(organization_id);
create index idx_receipts_transaction_id  on public.receipts(transaction_id);
create index idx_receipts_status          on public.receipts(status);

create trigger trg_receipts_updated_at
  before update on public.receipts
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- TRANSACTIONS (the heart of bookkeeping)
-- =====================================================================
create table public.transactions (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references public.organizations(id) on delete cascade,
  bank_account_id             uuid references public.bank_accounts(id) on delete set null,
  account_id                  uuid references public.accounts(id) on delete set null,
  date                        date not null,
  description                 text not null,
  vendor_normalized           text,
  amount_cents                bigint not null,
  direction                   public.transaction_direction not null,
  status                      public.transaction_status not null default 'uncategorized',
  is_tax_deductible           boolean not null default false,
  gst_hst_amount_cents        bigint not null default 0,
  notes                       text,
  source                      public.transaction_source not null default 'manual',
  applied_rule_id             uuid,  -- FK added after rules table exists
  ai_suggested_account_id     uuid references public.accounts(id) on delete set null,
  ai_suggestion_confidence    numeric(3,2),
  ai_suggestion_reasoning     text,
  reconciliation_id           uuid,  -- FK added after reconciliations table exists
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_transactions_organization_id   on public.transactions(organization_id);
create index idx_transactions_date              on public.transactions(date);
create index idx_transactions_status            on public.transactions(status);
create index idx_transactions_account_id        on public.transactions(account_id);
create index idx_transactions_bank_account_id   on public.transactions(bank_account_id);
create index idx_transactions_vendor_normalized on public.transactions(vendor_normalized);

create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

-- Now wire up the receipts → transactions FK
alter table public.receipts
  add constraint fk_receipts_transaction
  foreign key (transaction_id) references public.transactions(id) on delete set null;

-- =====================================================================
-- CATEGORIZATION RULES (auto-apply categories on import)
-- =====================================================================
create table public.categorization_rules (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  account_id          uuid not null references public.accounts(id) on delete cascade,
  match_field         public.rule_match_field not null default 'description',
  match_type          public.rule_match_type  not null default 'contains',
  match_pattern       text not null,
  is_tax_deductible   boolean not null default false,
  priority            int     not null default 100,
  times_applied       int     not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_categorization_rules_organization_id on public.categorization_rules(organization_id);
create index idx_categorization_rules_active          on public.categorization_rules(is_active);

create trigger trg_categorization_rules_updated_at
  before update on public.categorization_rules
  for each row execute function public.handle_updated_at();

-- Wire up transactions.applied_rule_id
alter table public.transactions
  add constraint fk_transactions_applied_rule
  foreign key (applied_rule_id) references public.categorization_rules(id) on delete set null;

-- =====================================================================
-- RECONCILIATIONS (one per bank statement period being reconciled)
-- =====================================================================
create table public.reconciliations (
  id                                uuid primary key default gen_random_uuid(),
  organization_id                   uuid not null references public.organizations(id) on delete cascade,
  bank_account_id                   uuid not null references public.bank_accounts(id) on delete cascade,
  statement_start_date              date not null,
  statement_end_date                date not null,
  statement_starting_balance_cents  bigint not null default 0,
  statement_ending_balance_cents    bigint not null,
  status                            public.reconciliation_status not null default 'in_progress',
  completed_at                      timestamptz,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now()
);

create index idx_reconciliations_organization_id on public.reconciliations(organization_id);
create index idx_reconciliations_bank_account_id on public.reconciliations(bank_account_id);

create trigger trg_reconciliations_updated_at
  before update on public.reconciliations
  for each row execute function public.handle_updated_at();

-- Wire up transactions.reconciliation_id
alter table public.transactions
  add constraint fk_transactions_reconciliation
  foreign key (reconciliation_id) references public.reconciliations(id) on delete set null;

-- =====================================================================
-- RECONCILIATION LINES (rows from the imported bank statement CSV)
-- =====================================================================
create table public.reconciliation_lines (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  reconciliation_id        uuid not null references public.reconciliations(id) on delete cascade,
  statement_date           date not null,
  statement_description    text not null,
  statement_amount_cents   bigint not null,
  matched_transaction_id   uuid references public.transactions(id) on delete set null,
  is_matched               boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_recon_lines_organization_id   on public.reconciliation_lines(organization_id);
create index idx_recon_lines_reconciliation_id on public.reconciliation_lines(reconciliation_id);
create index idx_recon_lines_matched_txn       on public.reconciliation_lines(matched_transaction_id);

create trigger trg_recon_lines_updated_at
  before update on public.reconciliation_lines
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- CLOSED MONTHS (locks a month after month-end close)
-- =====================================================================
create table public.closed_months (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  closed_by_profile_id   uuid references public.profiles(id) on delete set null,
  month                  int  not null check (month between 1 and 12),
  year                   int  not null,
  closed_at              timestamptz not null default now(),
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, month, year)
);

create index idx_closed_months_organization_id on public.closed_months(organization_id);

create trigger trg_closed_months_updated_at
  before update on public.closed_months
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- INVOICES
-- =====================================================================
create table public.invoices (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  invoice_number         text not null,
  customer_name          text not null,
  customer_email         text,
  customer_address       text,
  issue_date             date not null,
  due_date               date not null,
  status                 public.invoice_status not null default 'draft',
  subtotal_cents         bigint not null default 0,
  gst_hst_rate           numeric(5,4) not null default 0,
  gst_hst_amount_cents   bigint not null default 0,
  total_cents            bigint not null default 0,
  notes                  text,
  sent_at                timestamptz,
  paid_at                timestamptz,
  paid_transaction_id    uuid references public.transactions(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create index idx_invoices_organization_id on public.invoices(organization_id);
create index idx_invoices_status          on public.invoices(status);
create index idx_invoices_due_date        on public.invoices(due_date);

create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- INVOICE LINE ITEMS
-- =====================================================================
create table public.invoice_line_items (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  invoice_id          uuid not null references public.invoices(id) on delete cascade,
  account_id          uuid references public.accounts(id) on delete set null,
  description         text not null,
  quantity            numeric(12,2) not null default 1,
  unit_price_cents    bigint not null default 0,
  amount_cents        bigint not null default 0,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_invoice_line_items_organization_id on public.invoice_line_items(organization_id);
create index idx_invoice_line_items_invoice_id      on public.invoice_line_items(invoice_id);

create trigger trg_invoice_line_items_updated_at
  before update on public.invoice_line_items
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- WIN JOURNAL (CEO milestones, celebrations, saved wins)
-- =====================================================================
create table public.win_journal_entries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  profile_id       uuid references public.profiles(id) on delete set null,
  title            text not null,
  description      text,
  amount_cents     bigint,
  entry_date       date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_win_journal_organization_id on public.win_journal_entries(organization_id);
create index idx_win_journal_entry_date      on public.win_journal_entries(entry_date);

create trigger trg_win_journal_updated_at
  before update on public.win_journal_entries
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY — enable on every table
-- =====================================================================
alter table public.organizations          enable row level security;
alter table public.profiles               enable row level security;
alter table public.accounts               enable row level security;
alter table public.bank_accounts          enable row level security;
alter table public.transactions           enable row level security;
alter table public.receipts               enable row level security;
alter table public.categorization_rules   enable row level security;
alter table public.reconciliations        enable row level security;
alter table public.reconciliation_lines   enable row level security;
alter table public.closed_months          enable row level security;
alter table public.invoices               enable row level security;
alter table public.invoice_line_items     enable row level security;
alter table public.win_journal_entries    enable row level security;

-- ---------------- ORGANIZATIONS ----------------
create policy "org_select_own" on public.organizations
  for select using (id = public.current_organization_id());
create policy "org_update_own" on public.organizations
  for update using (id = public.current_organization_id());

-- ---------------- PROFILES ----------------
create policy "profile_select_org" on public.profiles
  for select using (organization_id = public.current_organization_id());
create policy "profile_insert_self" on public.profiles
  for insert with check (id = auth.uid());
create policy "profile_update_self" on public.profiles
  for update using (id = auth.uid());

-- ---------------- ACCOUNTS ----------------
create policy "accounts_select" on public.accounts
  for select using (organization_id = public.current_organization_id());
create policy "accounts_insert" on public.accounts
  for insert with check (organization_id = public.current_organization_id());
create policy "accounts_update" on public.accounts
  for update using (organization_id = public.current_organization_id());
create policy "accounts_delete" on public.accounts
  for delete using (organization_id = public.current_organization_id());

-- ---------------- BANK ACCOUNTS ----------------
create policy "bank_accounts_select" on public.bank_accounts
  for select using (organization_id = public.current_organization_id());
create policy "bank_accounts_insert" on public.bank_accounts
  for insert with check (organization_id = public.current_organization_id());
create policy "bank_accounts_update" on public.bank_accounts
  for update using (organization_id = public.current_organization_id());
create policy "bank_accounts_delete" on public.bank_accounts
  for delete using (organization_id = public.current_organization_id());

-- ---------------- TRANSACTIONS ----------------
create policy "transactions_select" on public.transactions
  for select using (organization_id = public.current_organization_id());
create policy "transactions_insert" on public.transactions
  for insert with check (organization_id = public.current_organization_id());
create policy "transactions_update" on public.transactions
  for update using (organization_id = public.current_organization_id());
create policy "transactions_delete" on public.transactions
  for delete using (organization_id = public.current_organization_id());

-- ---------------- RECEIPTS ----------------
create policy "receipts_select" on public.receipts
  for select using (organization_id = public.current_organization_id());
create policy "receipts_insert" on public.receipts
  for insert with check (organization_id = public.current_organization_id());
create policy "receipts_update" on public.receipts
  for update using (organization_id = public.current_organization_id());
create policy "receipts_delete" on public.receipts
  for delete using (organization_id = public.current_organization_id());

-- ---------------- CATEGORIZATION RULES ----------------
create policy "rules_select" on public.categorization_rules
  for select using (organization_id = public.current_organization_id());
create policy "rules_insert" on public.categorization_rules
  for insert with check (organization_id = public.current_organization_id());
create policy "rules_update" on public.categorization_rules
  for update using (organization_id = public.current_organization_id());
create policy "rules_delete" on public.categorization_rules
  for delete using (organization_id = public.current_organization_id());

-- ---------------- RECONCILIATIONS ----------------
create policy "recon_select" on public.reconciliations
  for select using (organization_id = public.current_organization_id());
create policy "recon_insert" on public.reconciliations
  for insert with check (organization_id = public.current_organization_id());
create policy "recon_update" on public.reconciliations
  for update using (organization_id = public.current_organization_id());
create policy "recon_delete" on public.reconciliations
  for delete using (organization_id = public.current_organization_id());

-- ---------------- RECONCILIATION LINES ----------------
create policy "recon_lines_select" on public.reconciliation_lines
  for select using (organization_id = public.current_organization_id());
create policy "recon_lines_insert" on public.reconciliation_lines
  for insert with check (organization_id = public.current_organization_id());
create policy "recon_lines_update" on public.reconciliation_lines
  for update using (organization_id = public.current_organization_id());
create policy "recon_lines_delete" on public.reconciliation_lines
  for delete using (organization_id = public.current_organization_id());

-- ---------------- CLOSED MONTHS ----------------
create policy "closed_months_select" on public.closed_months
  for select using (organization_id = public.current_organization_id());
create policy "closed_months_insert" on public.closed_months
  for insert with check (organization_id = public.current_organization_id());
create policy "closed_months_update" on public.closed_months
  for update using (organization_id = public.current_organization_id());
create policy "closed_months_delete" on public.closed_months
  for delete using (organization_id = public.current_organization_id());

-- ---------------- INVOICES ----------------
create policy "invoices_select" on public.invoices
  for select using (organization_id = public.current_organization_id());
create policy "invoices_insert" on public.invoices
  for insert with check (organization_id = public.current_organization_id());
create policy "invoices_update" on public.invoices
  for update using (organization_id = public.current_organization_id());
create policy "invoices_delete" on public.invoices
  for delete using (organization_id = public.current_organization_id());

-- ---------------- INVOICE LINE ITEMS ----------------
create policy "invoice_lines_select" on public.invoice_line_items
  for select using (organization_id = public.current_organization_id());
create policy "invoice_lines_insert" on public.invoice_line_items
  for insert with check (organization_id = public.current_organization_id());
create policy "invoice_lines_update" on public.invoice_line_items
  for update using (organization_id = public.current_organization_id());
create policy "invoice_lines_delete" on public.invoice_line_items
  for delete using (organization_id = public.current_organization_id());

-- ---------------- WIN JOURNAL ----------------
create policy "wins_select" on public.win_journal_entries
  for select using (organization_id = public.current_organization_id());
create policy "wins_insert" on public.win_journal_entries
  for insert with check (organization_id = public.current_organization_id());
create policy "wins_update" on public.win_journal_entries
  for update using (organization_id = public.current_organization_id());
create policy "wins_delete" on public.win_journal_entries
  for delete using (organization_id = public.current_organization_id());

-- =====================================================================
-- END 0001_initial_schema.sql
-- =====================================================================

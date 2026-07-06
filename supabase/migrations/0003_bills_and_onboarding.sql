-- =====================================================================
-- Profitly — Bills (Accounts Payable) + expanded onboarding fields (0003)
-- =====================================================================

-- =====================================================================
-- Extra onboarding fields on organizations
-- =====================================================================
alter table public.organizations
  add column if not exists business_structure       text,
  add column if not exists province                 text,
  add column if not exists fiscal_year_end_month    int  check (fiscal_year_end_month between 1 and 12),
  add column if not exists fiscal_year_end_day      int  check (fiscal_year_end_day between 1 and 31),
  add column if not exists has_employees            boolean not null default false,
  add column if not exists migration_source         text,
  add column if not exists bank_import_preference   text,
  add column if not exists motivations              text[] not null default '{}',
  add column if not exists help_goal                text;

-- =====================================================================
-- Bill status enum
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'bill_status') then
    create type public.bill_status as enum ('unpaid', 'paid', 'overdue', 'void');
  end if;
end$$;

-- =====================================================================
-- BILLS (accounts payable)
-- =====================================================================
create table if not exists public.bills (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  vendor_name            text not null,
  bill_date              date not null,
  due_date               date not null,
  amount_cents           bigint not null default 0,
  account_id             uuid references public.accounts(id) on delete set null,
  notes                  text,
  status                 public.bill_status not null default 'unpaid',
  paid_at                timestamptz,
  paid_transaction_id    uuid references public.transactions(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_bills_organization_id on public.bills(organization_id);
create index if not exists idx_bills_status          on public.bills(status);
create index if not exists idx_bills_due_date        on public.bills(due_date);

drop trigger if exists trg_bills_updated_at on public.bills;
create trigger trg_bills_updated_at
  before update on public.bills
  for each row execute function public.handle_updated_at();

alter table public.bills enable row level security;

drop policy if exists "bills_select" on public.bills;
drop policy if exists "bills_insert" on public.bills;
drop policy if exists "bills_update" on public.bills;
drop policy if exists "bills_delete" on public.bills;

create policy "bills_select" on public.bills
  for select using (organization_id = public.current_organization_id());
create policy "bills_insert" on public.bills
  for insert with check (organization_id = public.current_organization_id());
create policy "bills_update" on public.bills
  for update using (organization_id = public.current_organization_id());
create policy "bills_delete" on public.bills
  for delete using (organization_id = public.current_organization_id());

-- =====================================================================
-- END 0003_bills_and_onboarding.sql
-- =====================================================================

-- =====================================================================
-- Profitly — Dev Reset
-- Drops every Profitly object in the public schema so you can re-run
-- 0001_initial_schema.sql cleanly. ONLY for development — running this
-- against a database with real data will destroy everything.
-- =====================================================================

-- Tables (CASCADE handles indexes, triggers, FKs, RLS policies)
drop table if exists public.win_journal_entries     cascade;
drop table if exists public.bills                   cascade;
drop table if exists public.invoice_line_items      cascade;
drop table if exists public.invoices                cascade;
drop table if exists public.closed_months           cascade;
drop table if exists public.reconciliation_lines    cascade;
drop table if exists public.reconciliations         cascade;
drop table if exists public.categorization_rules    cascade;
drop table if exists public.transactions            cascade;
drop table if exists public.receipts                cascade;
drop table if exists public.bank_accounts           cascade;
drop table if exists public.accounts                cascade;
drop table if exists public.profiles                cascade;
drop table if exists public.organizations           cascade;

-- Enums
drop type if exists public.account_type             cascade;
drop type if exists public.bank_account_type        cascade;
drop type if exists public.transaction_status       cascade;
drop type if exists public.transaction_direction    cascade;
drop type if exists public.transaction_source       cascade;
drop type if exists public.receipt_status           cascade;
drop type if exists public.rule_match_field         cascade;
drop type if exists public.rule_match_type          cascade;
drop type if exists public.reconciliation_status    cascade;
drop type if exists public.invoice_status           cascade;
drop type if exists public.bill_status              cascade;

-- Helper functions
drop function if exists public.current_organization_id() cascade;
drop function if exists public.handle_updated_at()       cascade;

-- Storage policies on the receipts bucket (in case 0002 partially ran)
drop policy if exists "receipts_select_own_org" on storage.objects;
drop policy if exists "receipts_insert_own_org" on storage.objects;
drop policy if exists "receipts_update_own_org" on storage.objects;
drop policy if exists "receipts_delete_own_org" on storage.objects;

-- Drop the bucket itself (safe — bucket was empty if you just created it)
delete from storage.buckets where id = 'receipts';

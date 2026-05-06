-- =====================================================================
-- Profitly — Storage Buckets (0002)
-- Creates the private "receipts" bucket and locks it down with RLS so
-- each organization only sees its own files.
--
-- Convention: receipt files are stored at:
--   receipts/{organization_id}/{uuid}-{filename}
-- The first folder segment IS the organization id, which is what the
-- policies below check against.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Create the bucket (private; signed URLs only)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,                           -- private
  10 * 1024 * 1024,                -- 10 MB cap per file
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- RLS policies on storage.objects for the receipts bucket
-- ---------------------------------------------------------------------

-- SELECT: only objects whose first folder = the user's organization id
create policy "receipts_select_own_org"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

-- INSERT: must upload into a path starting with the user's org id
create policy "receipts_insert_own_org"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

-- UPDATE: only objects in the user's org folder
create policy "receipts_update_own_org"
on storage.objects for update to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

-- DELETE: only objects in the user's org folder
create policy "receipts_delete_own_org"
on storage.objects for delete to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

-- =====================================================================
-- END 0002_storage_buckets.sql
-- =====================================================================

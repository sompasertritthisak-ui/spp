-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0013 · Storage: booking artwork for billboard staff
-- Companion to 0012. Staff with can('billboards') (incl. marketing) may create
-- a signed URL for an artwork file ONLY when a billboard enquiry references it.
-- design_assets.path is stored either as "<owner>/<file>" or with the bucket
-- prefix "private-artwork/<owner>/<file>"; accept both.
-- (Needs Supabase Storage, so scripts/db-test.ts skips this file locally.)
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists "artwork booking staff read" on storage.objects;
create policy "artwork booking staff read" on storage.objects for select using (
  bucket_id = 'private-artwork'
  and public.can('billboards')
  and exists (
    select 1
    from public.design_assets a
    join public.billboard_bookings b on b.design_asset_id = a.id
    where a.path = storage.objects.name or a.path = 'private-artwork/' || storage.objects.name
  )
);

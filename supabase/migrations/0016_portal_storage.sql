-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0014b · Storage: files SPP shares with a customer
-- Companion to 0014. A customer may create a signed URL for an object outside
-- their own folder ONLY when a non-internal attachment on one of their own
-- quotes / orders / projects / bookings points at it.
-- attachments.path is stored either as "<owner>/<file>" or with the bucket
-- prefix "private-artwork/<owner>/<file>"; accept both.
-- (Needs Supabase Storage, so scripts/db-test.ts skips this file locally.)
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists "artwork shared with customer read" on storage.objects;
create policy "artwork shared with customer read" on storage.objects for select using (
  bucket_id = 'private-artwork'
  and exists (
    select 1 from public.attachments a
    where (a.path = storage.objects.name or a.path = 'private-artwork/' || storage.objects.name)
      and not a.internal
      and public.customer_owns_entity(a.entity, a.entity_id)
  )
);

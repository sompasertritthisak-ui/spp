-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0005 · Storage buckets & policies
--   public-media     CMS imagery. World-readable, staff-writable.
--   private-artwork  Customer uploads at production resolution. Path MUST be
--                    <owner uuid>/<random uuid>.<ext> — unguessable, and only
--                    the owner or authorised staff can obtain a signed URL.
--   design-previews  Watermarked low-res previews. Same isolation.
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-media',    'public-media',    true,  10485760, array['image/png','image/jpeg','image/webp','image/avif','image/svg+xml','video/mp4','application/pdf']),
  ('private-artwork', 'private-artwork', false, 26214400, array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']),
  ('design-previews', 'design-previews', false, 3145728,  array['image/webp','image/png','image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "public media read" on storage.objects for select using (bucket_id = 'public-media');
create policy "public media staff write" on storage.objects for insert with check (bucket_id = 'public-media' and (public.can('content') or public.can('catalogue') or public.can('billboards')));
create policy "public media staff update" on storage.objects for update using (bucket_id = 'public-media' and (public.can('content') or public.can('catalogue') or public.can('billboards')));
create policy "public media staff delete" on storage.objects for delete using (bucket_id = 'public-media' and public.can('content'));

create policy "artwork owner read" on storage.objects for select using (bucket_id in ('private-artwork','design-previews') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "artwork owner write" on storage.objects for insert with check (bucket_id in ('private-artwork','design-previews') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "artwork owner update" on storage.objects for update using (bucket_id = 'design-previews' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "artwork owner delete" on storage.objects for delete using (bucket_id in ('private-artwork','design-previews') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "artwork staff read" on storage.objects for select using (bucket_id in ('private-artwork','design-previews') and (public.can('designs') or public.can('production')));

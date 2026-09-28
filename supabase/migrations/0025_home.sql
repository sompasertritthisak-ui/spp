-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0025 · Home page editor (Command Center → CMS → Home page)
--
-- The landing page is configured by ONE settings row, key 'home' (shape:
-- HomeConfig in src/content/types.ts). Until now every settings row could be
-- written by can('settings') only — administrators. SPP's content managers
-- must be able to run the landing page themselves, so staff with
-- can('content') may insert and update THAT ROW AND NO OTHER:
--   · 'site', 'last_publish', 'publish_history', … stay administrator-only;
--   · the row must stay public (the static build reads it with the anon key);
--   · nobody but an administrator can delete it.
-- The free-form "Custom blocks" of the landing page are the sections of the CMS
-- page whose slug is 'home'. `pages.slug` is only `unique` — no pattern or
-- reserved-word constraint — and pages/page_sections are already writable by
-- can('content') (0002), so nothing has to change there.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists settings_home_insert on settings;
create policy settings_home_insert on settings for insert
  with check (key = 'home' and is_public and can('content'));

drop policy if exists settings_home_update on settings;
create policy settings_home_update on settings for update
  using (key = 'home' and can('content'))
  with check (key = 'home' and is_public and can('content'));

-- A row created by hand as private would be invisible to the site build.
update settings set is_public = true where key = 'home' and not is_public;

-- Migration 0024 guards every staff-written table with RESTRICTIVE policies
-- built from the permissive ones; they have to learn about the two above.
do $$
begin
  if to_regprocedure('public.refresh_write_guards()') is not null then
    perform refresh_write_guards();
  end if;
end $$;

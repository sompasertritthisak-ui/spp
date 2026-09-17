-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0012 · CMS publishing support
--   1. record_publish()  — every role that edits public content can log a site
--      publish, without being given write access to `settings`.
--   2. updated_at on the simple content tables, so "unpublished changes" can
--      be detected for every editor (not only admins, who can read audit_log).
--   3. Marketing staff handle billboard enquiries (can('billboards')) but could
--      not see the artwork attached to one. Give them read access to exactly
--      those assets. The matching Storage policy is in 0013_cms_storage.sql.
-- Idempotent: safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Publish log ────────────────────────────────────────────────────────
-- settings.last_publish    { at, by, by_name }            last SUCCESSFUL trigger
-- settings.publish_history [ { at, by, by_name, ok, message } … ]  newest first, 25 kept
-- Both are is_public = false.
create or replace function record_publish(p_ok boolean, p_message text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  entry jsonb;
  who text;
begin
  if not (can('content') or can('catalogue') or can('billboards') or can('campaigns') or can('settings')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(nullif(full_name, ''), email::text) into who from profiles where id = auth.uid();
  entry := jsonb_build_object('at', now(), 'by', auth.uid(), 'by_name', coalesce(who, ''), 'ok', coalesce(p_ok, false), 'message', left(coalesce(p_message, ''), 500));

  insert into settings(key, value, is_public, updated_by)
  values ('publish_history', jsonb_build_array(entry), false, auth.uid())
  on conflict (key) do update
    set value = (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
                 from jsonb_array_elements(jsonb_build_array(entry) || case when jsonb_typeof(settings.value) = 'array' then settings.value else '[]'::jsonb end) with ordinality as t(e, ord)
                 where ord <= 25),
        is_public = false, updated_by = auth.uid();

  if coalesce(p_ok, false) then
    insert into settings(key, value, is_public, updated_by)
    values ('last_publish', entry - 'ok' - 'message', false, auth.uid())
    on conflict (key) do update set value = excluded.value, is_public = false, updated_by = auth.uid();
  end if;
  return entry;
end $$;
revoke all on function record_publish(boolean, text) from public, anon;
grant execute on function record_publish(boolean, text) to authenticated;

-- ── 2 · Change tracking on simple content tables ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['categories','services','solutions','faqs','testimonials','team_members','page_sections','product_variants','bundle_items']
  loop
    execute format('alter table %I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('drop trigger if exists %I on %I', t || '_touch', t);
    execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ── 3 · Booking artwork for billboard staff ────────────────────────────────
drop policy if exists design_assets_booking_staff on design_assets;
create policy design_assets_booking_staff on design_assets for select
  using (can('billboards') and exists (select 1 from billboard_bookings b where b.design_asset_id = design_assets.id));

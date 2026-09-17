-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0014 · Customer portal (MY SPP)
-- Closes the gaps the portal hit under RLS:
--   · guest (anonymous) Studio sessions have no email, so handle_new_user()
--     violated profiles.email NOT NULL and the guest session could not start;
--     and when a guest upgrades to a real account nothing copied the new
--     email / name onto the profile (customers may not change email themselves)
--   · a customer could post a message or attachment against ANY entity id as
--     long as customer_id / owner_id was their own — that raised a staff
--     notification deep-linking to somebody else's quote. Inserts now require
--     the customer to own the quote / order / project / booking.
--   · customers could read only the attachments THEY uploaded, so files SPP
--     shares on a project never reached the portal
--   · staff DRAFT quotes (prices still being worked on) were readable by the
--     customer through the API
-- Re-runnable: functions are `create or replace`, policies/triggers dropped first.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Does the signed-in customer own the thing a message/file hangs off? ─────
create or replace function customer_owns_entity(p_entity text, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and case p_entity
    when 'quote'   then exists (select 1 from quotes q where q.id = p_id and q.customer_id = auth.uid() and q.status <> 'draft')
    when 'order'   then exists (select 1 from orders o where o.id = p_id and o.customer_id = auth.uid())
    when 'project' then exists (select 1 from projects p where p.id = p_id and p.customer_id = auth.uid())
    when 'booking' then exists (select 1 from billboard_bookings b where b.id = p_id and b.customer_id = auth.uid())
    else false end
$$;
revoke all on function customer_owns_entity(text, uuid) from public, anon;
grant execute on function customer_owns_entity(text, uuid) to authenticated;

-- ── Messages: only on your own quote / order / project / booking ───────────
drop policy if exists messages_owner_insert on messages;
create policy messages_owner_insert on messages for insert with check (
  customer_id = auth.uid() and sender = auth.uid() and not from_staff and customer_owns_entity(entity, entity_id));

-- ── Attachments: upload to your own records; read what SPP shares on them ──
drop policy if exists attachments_owner_insert on attachments;
create policy attachments_owner_insert on attachments for insert with check (
  owner_id = auth.uid() and not internal and customer_owns_entity(entity, entity_id)
  and path like auth.uid()::text || '/%');              -- a row may only point into the uploader's own folder
drop policy if exists attachments_owner_read on attachments;
create policy attachments_owner_read on attachments for select using (
  not internal and (owner_id = auth.uid() or customer_owns_entity(entity, entity_id)));

-- ── Quotes: a staff draft is not the customer's business until it is sent ──
drop policy if exists quotes_owner_read on quotes;
create policy quotes_owner_read on quotes for select using (customer_id = auth.uid() and status <> 'draft');
drop policy if exists quote_items_owner_read on quote_items;
create policy quote_items_owner_read on quote_items for select using (
  exists (select 1 from quotes q where q.id = quote_id and q.customer_id = auth.uid() and q.status <> 'draft'));

-- ── Identity: guests have no email; upgrades must reach the profile ────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, full_name, phone)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- Auth is the source of truth for the sign-in address. When it changes (guest
-- → account, or a confirmed email change) mirror it, and fill a still-blank
-- name / phone from the sign-up metadata. Never touches role or company.
create or replace function handle_user_identity_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('spp.privileged', 'on', true);
  update profiles p set
    email = coalesce(new.email, ''),
    full_name = case when p.full_name = '' then left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120) else p.full_name end,
    phone = case when p.phone = '' then left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 40) else p.phone end
  where p.id = new.id;
  perform set_config('spp.privileged', '', true);
  return new;
end $$;
revoke all on function handle_user_identity_change() from public, anon, authenticated;
drop trigger if exists on_auth_user_identity_changed on auth.users;
create trigger on_auth_user_identity_changed after update of email, raw_user_meta_data on auth.users
for each row when (new.email is distinct from old.email or new.raw_user_meta_data is distinct from old.raw_user_meta_data)
execute function handle_user_identity_change();

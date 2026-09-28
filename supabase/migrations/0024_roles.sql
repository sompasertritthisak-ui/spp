-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0024 · Custom roles and hierarchy
--
-- The super admin creates roles, decides what each one may VIEW or EDIT, and
-- ranks them. Nothing here loosens an existing rule:
--   · can(domain)       — may SEE the domain   (view or edit)   ← every old policy
--   · can_write(domain) — may CHANGE the domain (edit only)     ← write guards + RPCs
--   · 'security' is never grantable: super admin only.
--   · rank 100 is the super admin; a higher rank is more senior. People can only
--     be moved by someone strictly above both their current and their new role.
-- The six original roles become editable SYSTEM roles seeded with exactly the
-- permissions they had in 0001.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tables ─────────────────────────────────────────────────────────────────
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  rank int not null,
  is_system boolean not null default false,
  legacy app_role unique,
  colour text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  constraint roles_key_slug check (key ~ '^[a-z][a-z0-9_-]{1,39}$'),
  constraint roles_key_reserved check (key not in ('customer', 'staff')),
  constraint roles_name_len check (char_length(btrim(name)) between 2 and 60),
  constraint roles_description_len check (char_length(description) <= 500),
  constraint roles_rank_range check (rank between 1 and 100),
  constraint roles_rank_100_is_super check ((rank = 100) = (key = 'super_admin')),
  constraint roles_colour_hex check (colour is null or colour ~ '^#[0-9a-f]{6}$'),
  constraint roles_legacy_is_system check (legacy is null or is_system)
);
create index if not exists roles_rank_idx on roles(rank desc);

create table if not exists role_capabilities (
  role_id uuid not null references roles(id) on delete cascade,
  domain text not null,
  level text not null,
  primary key (role_id, domain),
  constraint role_capabilities_domain check (domain in ('content','catalogue','pricing','sales','designs','production','billboards','campaigns','analytics','finance','settings','team')),
  constraint role_capabilities_level check (level in ('view','edit'))
);

-- ── System roles: today's map, reproduced exactly (all 'edit') ─────────────
insert into roles(key, name, description, rank, is_system, legacy) values
  ('super_admin', 'Super admin',     'Everything, including security, roles and the hierarchy.', 100, true, 'super_admin'),
  ('admin',       'Admin',           'Runs the whole Command Center; assigns roles to people below admin.', 90, true, 'admin'),
  ('marketing',   'Content manager', 'Website content, catalogue, billboards, campaigns and analytics.', 60, true, 'marketing'),
  ('sales',       'Sales',           'Leads, quotes, orders, designs, billboards and bookings; reads pricing.', 60, true, 'sales'),
  ('designer',    'Designer',        'Designs and artwork approval, production jobs.', 50, true, 'designer'),
  ('production',  'Production',      'Production jobs, quality control and deliveries.', 50, true, 'production')
on conflict (key) do nothing;

insert into role_capabilities(role_id, domain, level)
select r.id, d.domain, 'edit'
from roles r
join (values
  ('super_admin', array['content','catalogue','pricing','sales','designs','production','billboards','campaigns','analytics','finance','settings','team']),
  ('admin',       array['content','catalogue','pricing','sales','designs','production','billboards','campaigns','analytics','finance','settings','team']),
  ('marketing',   array['content','catalogue','billboards','campaigns','analytics']),
  ('sales',       array['catalogue','sales','designs','billboards','analytics','finance']),
  ('designer',    array['designs','production']),
  ('production',  array['production'])
) seed(key, domains) on seed.key = r.key
cross join lateral unnest(seed.domains) d(domain)
on conflict (role_id, domain) do nothing;

-- ── profiles.role_id ───────────────────────────────────────────────────────
alter table profiles add column if not exists role_id uuid references roles(id) on delete restrict;
create index if not exists profiles_role_id_idx on profiles(role_id);

select set_config('spp.privileged', 'on', true);
update profiles p set role_id = r.id
from roles r
where r.legacy = p.role and p.role <> 'customer' and p.role_id is distinct from r.id;
select set_config('spp.privileged', '', true);

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function my_role_id() returns uuid
language sql stable security definer set search_path = public as $$
  select role_id from profiles where id = auth.uid()
$$;

create or replace function role_rank(p_role uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select rank from roles where id = p_role), 0)
$$;

-- Customers and visitors rank 0: below every role.
create or replace function my_rank() returns int
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then 0 when auth_role() = 'super_admin' then 100 else role_rank(my_role_id()) end
$$;

create or replace function cap_level(domain text) returns text
language sql stable security definer set search_path = public as $$
  select c.level from role_capabilities c where c.role_id = my_role_id() and c.domain = $1
$$;

-- May SEE the domain. Same name and meaning every existing policy relies on.
create or replace function can(domain text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and (auth_role() = 'super_admin' or ($1 is distinct from 'security' and cap_level($1) is not null))
$$;

-- May CHANGE the domain.
create or replace function can_write(domain text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and (auth_role() = 'super_admin' or ($1 is distinct from 'security' and coalesce(cap_level($1) = 'edit', false)))
$$;

-- Staff who may change at least one thing. A role that only views cannot post
-- notes, message customers or attach files either.
create or replace function staff_can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff()
     and (auth_role() = 'super_admin' or exists (select 1 from role_capabilities c where c.role_id = my_role_id() and c.level = 'edit'))
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (auth_role() in ('super_admin', 'admin') or can_write('team'))
$$;

-- ── Keeping profiles.role and profiles.role_id in step ─────────────────────
-- role_id is the authority for what a person may do; the enum stays for the
-- policies and functions written against it (is_staff, has_role, super_admin).
-- Whichever of the two is written, the other follows — so a seed script or a
-- manual fix can never leave them disagreeing.
create or replace function sync_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare r roles%rowtype;
begin
  if tg_op = 'UPDATE' and new.role is not distinct from old.role and new.role_id is not distinct from old.role_id then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.role_id is not null) or (tg_op = 'UPDATE' and new.role_id is distinct from old.role_id) then
    if new.role_id is null then
      new.role := 'customer';
    else
      select * into r from roles where id = new.role_id;
      if not found then raise exception 'not found: role' using errcode = 'P0002'; end if;
      new.role := coalesce(r.legacy, 'staff'::app_role);
    end if;
  elsif new.role = 'customer' then
    new.role_id := null;
  elsif new.role = 'staff' then
    if new.role_id is null or exists (select 1 from roles where id = new.role_id and legacy is not null) then
      raise exception 'a custom role is assigned with assign_role()' using errcode = '22023';
    end if;
  else
    select id into new.role_id from roles where legacy = new.role;
    if new.role_id is null then raise exception 'not found: role' using errcode = 'P0002'; end if;
  end if;

  if tg_op = 'UPDATE' and old.role = 'super_admin' and new.role <> 'super_admin' then
    -- one demotion at a time, so two super admins cannot demote each other in the same instant
    perform pg_advisory_xact_lock(hashtext('spp.super_admin'));
    if not exists (select 1 from profiles where role = 'super_admin' and id <> old.id) then
      raise exception 'forbidden: the last super admin cannot be demoted' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_role_sync on profiles;
create trigger profiles_role_sync before insert or update on profiles for each row execute function sync_profile_role();

create or replace function guard_last_super_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'super_admin' then
    perform pg_advisory_xact_lock(hashtext('spp.super_admin'));
    if not exists (select 1 from profiles where role = 'super_admin' and id <> old.id) then
      raise exception 'forbidden: the last super admin cannot be removed' using errcode = '42501';
    end if;
  end if;
  return old;
end $$;
drop trigger if exists profiles_keep_super_admin on profiles;
create trigger profiles_keep_super_admin before delete on profiles for each row execute function guard_last_super_admin();

-- Users may edit their own profile but NEVER their role, role_id, company or email.
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.role_id is distinct from old.role_id
      or new.company_id is distinct from old.company_id or new.email is distinct from old.email)
     and coalesce(current_setting('spp.privileged', true), '') <> 'on' then
    raise exception 'forbidden: protected profile fields' using errcode = '42501';
  end if;
  return new;
end $$;

-- ── RLS: staff read, nobody writes directly ────────────────────────────────
alter table roles enable row level security;
alter table role_capabilities enable row level security;
drop policy if exists roles_staff_read on roles;
create policy roles_staff_read on roles for select using (is_staff());
drop policy if exists role_capabilities_staff_read on role_capabilities;
create policy role_capabilities_staff_read on role_capabilities for select using (is_staff());

drop trigger if exists roles_touch on roles;
create trigger roles_touch before update on roles for each row execute function touch_updated_at();
drop trigger if exists roles_audit on roles;
create trigger roles_audit after insert or update or delete on roles for each row execute function audit_row();
drop trigger if exists role_capabilities_audit on role_capabilities;
create trigger role_capabilities_audit after insert or update or delete on role_capabilities for each row execute function audit_row();

-- ── RPCs ───────────────────────────────────────────────────────────────────
create or replace function list_roles() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'key', r.key, 'name', r.name, 'description', r.description, 'rank', r.rank,
      'isSystem', r.is_system, 'legacy', r.legacy, 'colour', r.colour,
      'caps', coalesce((select jsonb_object_agg(c.domain, c.level) from role_capabilities c where c.role_id = r.id), '{}'::jsonb),
      'members', (select count(*) from profiles p where p.role_id = r.id),
      'updatedAt', r.updated_at
    ) order by r.rank desc, r.name)
    from roles r), '[]'::jsonb);
end $$;

create or replace function save_role(p_key text, p_name text, p_description text, p_rank int, p_caps jsonb, p_colour text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text := lower(btrim(coalesce(p_key, '')));
  nm text := btrim(coalesce(p_name, ''));
  descr text := btrim(coalesce(p_description, ''));
  col text := nullif(lower(btrim(coalesce(p_colour, ''))), '');
  caps jsonb := coalesce(p_caps, '{}'::jsonb);
  existing roles%rowtype;
  rid uuid;
  d text; lvl text;
  domains constant text[] := array['content','catalogue','pricing','sales','designs','production','billboards','campaigns','analytics','finance','settings','team'];
begin
  if auth.uid() is null or auth_role() <> 'super_admin' then
    raise exception 'forbidden: super admin required' using errcode = '42501';
  end if;
  if k !~ '^[a-z][a-z0-9_-]{1,39}$' or k in ('customer', 'staff') then
    raise exception 'invalid: role key' using errcode = '22023', hint = 'Use 2–40 lowercase letters, digits, hyphens or underscores, starting with a letter.';
  end if;
  if char_length(nm) not between 2 and 60 then raise exception 'invalid: role name' using errcode = '22023', hint = 'Give the role a name of 2–60 characters.'; end if;
  if char_length(descr) > 500 then raise exception 'invalid: description too long' using errcode = '22023'; end if;
  if col is not null and col !~ '^#[0-9a-f]{6}$' then raise exception 'invalid: colour' using errcode = '22023'; end if;
  if jsonb_typeof(caps) <> 'object' then raise exception 'invalid: capabilities' using errcode = '22023'; end if;

  for d, lvl in select key, value #>> '{}' from jsonb_each(caps) loop
    if d = 'security' then raise exception 'forbidden: security cannot be granted to a role' using errcode = '42501'; end if;
    if not d = any(domains) then raise exception 'invalid: unknown capability %', left(d, 40) using errcode = '22023'; end if;
    if lvl is not null and lvl not in ('view', 'edit', 'none', '') then raise exception 'invalid: capability level for %', d using errcode = '22023'; end if;
  end loop;

  select * into existing from roles where key = k for update;
  if found and existing.key = 'super_admin' then
    -- The super admin is always rank 100 with everything: only its label may change.
    update roles set name = nm, description = descr, colour = col where id = existing.id;
    rid := existing.id;
  else
    if p_rank is null or p_rank not between 1 and 99 then
      raise exception 'invalid: rank' using errcode = '22023', hint = 'Rank is 1–99. 100 is reserved for the super admin.';
    end if;
    if found then
      update roles set name = nm, description = descr, colour = col, rank = p_rank where id = existing.id;
      rid := existing.id;
    else
      insert into roles(key, name, description, rank, colour, created_by) values (k, nm, descr, p_rank, col, auth.uid()) returning id into rid;
    end if;
    delete from role_capabilities c where c.role_id = rid and not (caps ? c.domain and caps ->> c.domain in ('view', 'edit'));
    insert into role_capabilities(role_id, domain, level)
      select rid, e.key, e.value #>> '{}' from jsonb_each(caps) e where e.value #>> '{}' in ('view', 'edit')
    on conflict (role_id, domain) do update set level = excluded.level where role_capabilities.level <> excluded.level;
  end if;

  return (select x from jsonb_array_elements(list_roles()) x where x ->> 'key' = k);
end $$;

create or replace function delete_role(p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare r roles%rowtype; n int;
begin
  if auth.uid() is null or auth_role() <> 'super_admin' then
    raise exception 'forbidden: super admin required' using errcode = '42501';
  end if;
  select * into r from roles where key = lower(btrim(coalesce(p_key, ''))) for update;
  if not found then raise exception 'not found: role' using errcode = 'P0002'; end if;
  if r.is_system then raise exception 'forbidden: system roles cannot be deleted' using errcode = '42501'; end if;
  select count(*) into n from profiles where role_id = r.id;
  if n > 0 then
    raise exception 'conflict: role still has members' using errcode = '23503', hint = format('Move the %s people on this role to another role first.', n);
  end if;
  delete from roles where id = r.id;
end $$;

-- The single door for changing what a person may do.
create or replace function assign_role(target uuid, p_role_key text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  super boolean := auth_role() = 'super_admin';
  k text := lower(btrim(coalesce(p_role_key, '')));
  cur profiles%rowtype;
  nr roles%rowtype;
  mine int;
begin
  if me is null or not (super or can_write('team')) then raise exception 'forbidden' using errcode = '42501'; end if;
  if target = me then raise exception 'forbidden: cannot change own role' using errcode = '42501'; end if;
  select * into cur from profiles where id = target for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if k <> 'customer' then
    select * into nr from roles where key = k;
    if not found then raise exception 'not found: role' using errcode = 'P0002'; end if;
    if cur.email = '' then raise exception 'forbidden: a guest session cannot be given a role' using errcode = '42501'; end if;
  end if;

  if not super then
    if cur.role in ('admin', 'super_admin') or nr.key in ('admin', 'super_admin') then
      raise exception 'forbidden: super admin required' using errcode = '42501';
    end if;
    mine := my_rank();
    if role_rank(cur.role_id) >= mine then
      raise exception 'forbidden: rank' using errcode = '42501', hint = 'You can only change people whose role is below your own.';
    end if;
    if nr.id is not null and nr.rank >= mine then
      raise exception 'forbidden: rank' using errcode = '42501', hint = 'You can only give roles that are below your own.';
    end if;
  end if;

  perform set_config('spp.privileged', 'on', true);
  update profiles set role_id = nr.id, role = case when nr.id is null then 'customer'::app_role else coalesce(nr.legacy, 'staff'::app_role) end where id = target;
  perform set_config('spp.privileged', '', true);
end $$;

-- Kept for callers written against the fixed roles; same rules, same door.
create or replace function set_user_role(target uuid, new_role app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_role = 'staff' then raise exception 'invalid: use assign_role() for a custom role' using errcode = '22023'; end if;
  perform assign_role(target, new_role::text);
end $$;

-- What the signed-in person may do, for the UI. The UI only decides what to
-- render; every permission is enforced again by the policies and RPCs.
create or replace function my_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', (select jsonb_build_object('key', r.key, 'name', r.name, 'rank', r.rank, 'colour', r.colour) from roles r where r.id = my_role_id()),
    'caps', case
      when auth.uid() is null then '{}'::jsonb
      when auth_role() = 'super_admin' then
        (select jsonb_object_agg(d, 'edit') from unnest(array['content','catalogue','pricing','sales','designs','production','billboards','campaigns','analytics','finance','settings','team','security']) d)
      else coalesce((select jsonb_object_agg(c.domain, c.level) from role_capabilities c where c.role_id = my_role_id()), '{}'::jsonb) end,
    'superAdmin', auth.uid() is not null and auth_role() = 'super_admin')
$$;

revoke all on function list_roles() from public, anon;
revoke all on function save_role(text, text, text, int, jsonb, text) from public, anon;
revoke all on function delete_role(text) from public, anon;
revoke all on function assign_role(uuid, text) from public, anon;
revoke all on function my_access() from public, anon;
grant execute on function list_roles() to authenticated;
grant execute on function save_role(text, text, text, int, jsonb, text) to authenticated;
grant execute on function delete_role(text) to authenticated;
grant execute on function assign_role(uuid, text) to authenticated;
grant execute on function my_access() to authenticated;
revoke all on function sync_profile_role() from public, anon, authenticated;
revoke all on function guard_last_super_admin() from public, anon, authenticated;

-- ── View-only enforcement ──────────────────────────────────────────────────
-- Every existing policy says can('x'), which now means "may see x". Rather than
-- rewrite ~70 policies, each table that staff write to gets RESTRICTIVE guard
-- policies (<table>_wguard_ins / _upd / _del). A guard is the OR of that
-- table's own permissive write policies with can( → can_write( and
-- is_staff() → staff_can_write(). Because can_write implies can, the result is
-- exactly "the old policies, but edit is required" — owner rows, customers and
-- guests are untouched, and no policy is loosened.
--
-- Guards are a snapshot of the policies they were built from. After adding or
-- changing a policy or a staff RPC, run:  select refresh_write_guards();
-- write_guards_pending() lists anything stale (db-test fails if it is not empty).
create or replace function _write_guard_plan()
returns table (schemaname text, tablename text, cmd text, policyname text, using_expr text, check_expr text, fingerprint text)
language sql stable set search_path = public as $$
  with src as (
    select p.schemaname::text, p.tablename::text, p.policyname::text, p.cmd, p.qual, p.with_check
    from pg_policies p
    where (p.schemaname = 'public' or (p.schemaname = 'storage' and p.tablename = 'objects'))
      and p.permissive = 'PERMISSIVE' and p.cmd <> 'SELECT'
      and p.policyname !~ '_wguard_(ins|upd|del)$'
  ), per as (
    select s.schemaname, s.tablename, c.cmd, c.suffix,
      string_agg('(' || regexp_replace(regexp_replace(coalesce(s.qual, 'true'), '\mcan\(', 'can_write(', 'g'), '\mis_staff\(\)', 'staff_can_write()', 'g') || ')', ' or ' order by s.policyname) as using_expr,
      string_agg('(' || regexp_replace(regexp_replace(coalesce(s.with_check, s.qual, 'true'), '\mcan\(', 'can_write(', 'g'), '\mis_staff\(\)', 'staff_can_write()', 'g') || ')', ' or ' order by s.policyname) as check_expr,
      md5(string_agg(s.policyname || '·' || s.cmd || '·' || coalesce(s.qual, '') || '·' || coalesce(s.with_check, ''), '|' order by s.policyname)) as fingerprint,
      -- can('literal') or is_staff(): a rule about staff. can(column) — notifications — is left alone.
      bool_or(coalesce(s.qual, '') || ' ' || coalesce(s.with_check, '') ~ '(\mcan\(''|\mis_staff\(\))') as guarded
    from src s
    join (values ('INSERT', 'ins'), ('UPDATE', 'upd'), ('DELETE', 'del')) c(cmd, suffix) on s.cmd in ('ALL', c.cmd)
    group by s.schemaname, s.tablename, c.cmd, c.suffix
  )
  select schemaname, tablename, cmd, tablename || '_wguard_' || suffix, using_expr, check_expr, fingerprint
  from per where guarded
$$;

create or replace function write_guards_pending()
returns table (kind text, name text, detail text)
language sql stable set search_path = public as $$
  select 'policy', g.schemaname || '.' || g.tablename, g.policyname || ' is missing or out of date'
  from _write_guard_plan() g
  where not exists (
    select 1 from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = g.schemaname and c.relname = g.tablename and pol.polname = g.policyname
      and not pol.polpermissive
      and obj_description(pol.oid, 'pg_policy') = 'wguard:' || g.fingerprint)
  union all
  select 'policy', n.nspname || '.' || c.relname, pol.polname || ' guards nothing any more'
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where pol.polname ~ '_wguard_(ins|upd|del)$' and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
    and not exists (select 1 from _write_guard_plan() g where g.schemaname = n.nspname and g.tablename = c.relname and g.policyname = pol.polname)
  union all
  select 'function', p.proname::text, 'writes on behalf of staff but still checks can(); it must check can_write()'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.provolatile = 'v' and p.prosrc ~ '\mcan\('
$$;

create or replace function refresh_write_guards() returns int
language plpgsql set search_path = public as $$
declare g record; f record; stale record; n int := 0; def text;
begin
  -- 1 · policies
  for stale in
    select n2.nspname, c.relname, pol.polname
    from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n2 on n2.oid = c.relnamespace
    where pol.polname ~ '_wguard_(ins|upd|del)$' and (n2.nspname = 'public' or (n2.nspname = 'storage' and c.relname = 'objects'))
  loop
    begin
      execute format('drop policy if exists %I on %I.%I', stale.polname, stale.nspname, stale.relname);
    exception when insufficient_privilege then
      raise warning 'write guards: cannot manage policies on %.% — %', stale.nspname, stale.relname, sqlerrm;
    end;
  end loop;

  for g in select * from _write_guard_plan() loop
    begin
      execute format('drop policy if exists %I on %I.%I', g.policyname, g.schemaname, g.tablename);
      execute format('create policy %I on %I.%I as restrictive for %s %s',
        g.policyname, g.schemaname, g.tablename, lower(g.cmd),
        case g.cmd
          when 'INSERT' then format('with check (%s)', g.check_expr)
          when 'UPDATE' then format('using (%s) with check (%s)', g.using_expr, g.check_expr)
          else format('using (%s)', g.using_expr) end);
      execute format('comment on policy %I on %I.%I is %L', g.policyname, g.schemaname, g.tablename, 'wguard:' || g.fingerprint);
      n := n + 1;
    exception when insufficient_privilege then
      -- storage.objects belongs to Supabase; if this role may not manage it, say so rather than fail the migration.
      raise warning 'write guards: cannot manage policies on %.% — %', g.schemaname, g.tablename, sqlerrm;
    end;
  end loop;

  -- 2 · functions that write on behalf of staff (RPCs and triggers). They run as
  -- the table owner, so RLS — and the guards above — do not apply inside them:
  -- their own check is the gate, and it must ask for edit. Read-only reports are
  -- declared STABLE and keep can().
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prokind = 'f' and p.provolatile = 'v' and p.prosrc ~ '\mcan\('
  loop
    def := pg_get_functiondef(f.oid);
    execute regexp_replace(def, '\mcan\(', 'can_write(', 'g');
    n := n + 1;
  end loop;

  -- notify_customer() is gated on is_staff(): a view-only role must not message customers.
  for f in
    select p.oid from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'notify_customer' and p.prosrc ~ '\mis_staff\(\)'
  loop
    execute regexp_replace(pg_get_functiondef(f.oid), '\mis_staff\(\)', 'staff_can_write()', 'g');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function _write_guard_plan() from public, anon, authenticated;
revoke all on function write_guards_pending() from public, anon, authenticated;
revoke all on function refresh_write_guards() from public, anon, authenticated;

select refresh_write_guards();

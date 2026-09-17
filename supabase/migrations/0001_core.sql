-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0001 · Core: extensions, enums, identity, RBAC helpers, audit
-- All authorization in this system is enforced HERE, in Postgres. The static
-- front-end holds only the public anon key; it can never be trusted.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ── Enums ──────────────────────────────────────────────────────────────────
create type app_role as enum ('super_admin','admin','sales','designer','production','marketing','customer');
create type publish_status as enum ('draft','scheduled','published','archived');
create type pricing_mode as enum ('fixed','estimated','quote');
create type lead_status as enum ('new','contacted','qualified','quote','negotiation','won','lost');
create type lead_source as enum ('quote','consultation','mockup','billboard','project_builder','contact','preorder','campaign','whatsapp','social','qr','manual');
create type priority_level as enum ('low','normal','high','urgent');
create type quote_status as enum ('draft','submitted','in_review','sent','accepted','declined','expired');
create type order_status as enum ('quote','approved','artwork_review','production','quality_control','ready','delivery','completed','cancelled');
create type payment_status as enum ('unpaid','deposit','paid','refunded');
create type production_status as enum ('queued','in_progress','blocked','qc','done');
create type qc_result as enum ('pass','fail','needs_review');
create type billboard_status as enum ('available','reserved','unavailable','maintenance');
create type booking_status as enum ('requested','in_review','confirmed','declined','cancelled','completed');
create type consultation_status as enum ('requested','approved','declined','alternative_suggested','completed','converted');
create type project_stage as enum ('discovery','design','artwork','approval','production','quality_control','delivery','completion');
create type preflight_verdict as enum ('ready','attention','blocked');
create type design_status as enum ('draft','saved','submitted','approved','archived');
create type delivery_status as enum ('pending','scheduled','in_transit','delivered','installed','failed');

-- ── Identity ───────────────────────────────────────────────────────────────
-- One row per auth user. `role` is the ONLY source of authority and can be
-- changed solely through set_user_role() below.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null,
  full_name text not null default '',
  phone text not null default '',
  role app_role not null default 'customer',
  company_id uuid,
  avatar_path text,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);
create index profiles_company_idx on profiles(company_id);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text not null default '',
  address text not null default '',
  tax_id text not null default '',
  notes_internal text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles add constraint profiles_company_fk foreign key (company_id) references companies(id) on delete set null;

-- ── RBAC helpers (SECURITY DEFINER so they can read profiles under RLS) ────
create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()), 'customer'::app_role)
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth_role() <> 'customer'
$$;

create or replace function has_role(variadic roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (auth_role() = any(roles) or auth_role() = 'super_admin')
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role('admin')
$$;

-- Capability map: one place that says which role may touch which domain.
create or replace function can(domain text) returns boolean
language sql stable security definer set search_path = public as $$
  select case domain
    when 'content'    then has_role('admin','marketing')
    when 'catalogue'  then has_role('admin','marketing','sales')
    when 'pricing'    then has_role('admin')
    when 'sales'      then has_role('admin','sales')
    when 'designs'    then has_role('admin','sales','designer')
    when 'production' then has_role('admin','production','designer')
    when 'billboards' then has_role('admin','sales','marketing')
    when 'campaigns'  then has_role('admin','marketing')
    when 'analytics'  then has_role('admin','marketing','sales')
    when 'finance'    then has_role('admin','sales')
    when 'settings'   then has_role('admin')
    when 'security'   then auth_role() = 'super_admin'
    else false end
$$;

-- ── Audit log ──────────────────────────────────────────────────────────────
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_role app_role,
  action text not null,               -- insert | update | delete | <custom>
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet
);
create index audit_log_entity_idx on audit_log(entity, entity_id);
create index audit_log_at_idx on audit_log(at desc);
create index audit_log_actor_idx on audit_log(actor);

create or replace function request_ip() returns inet
language plpgsql stable as $$
declare h text;
begin
  h := current_setting('request.headers', true);
  if h is null or h = '' then return null; end if;
  return nullif(split_part((h::json ->> 'x-forwarded-for'), ',', 1), '')::inet;
exception when others then return null;
end $$;

create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rid text;
begin
  rid := coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', null);
  insert into audit_log(actor, actor_role, action, entity, entity_id, before, after, ip)
  values (
    auth.uid(),
    (select role from profiles where id = auth.uid()),
    lower(tg_op),
    tg_table_name,
    rid,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    request_ip()
  );
  return coalesce(new, old);
end $$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ── Profile lifecycle ──────────────────────────────────────────────────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, full_name, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- Users may edit their own profile but NEVER their own role or company link.
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.company_id is distinct from old.company_id or new.email is distinct from old.email)
     and coalesce(current_setting('spp.privileged', true), '') <> 'on' then
    raise exception 'forbidden: protected profile fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function guard_profile_update();
create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();
create trigger profiles_audit after insert or update or delete on profiles for each row execute function audit_row();

-- The single door for changing roles. Admins manage staff; only a super admin
-- may grant or revoke admin / super_admin. Nobody may change their own role.
create or replace function set_user_role(target uuid, new_role app_role) returns void
language plpgsql security definer set search_path = public as $$
declare cur app_role;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'forbidden: cannot change own role' using errcode = '42501'; end if;
  select role into cur from profiles where id = target;
  if cur is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if (new_role in ('admin','super_admin') or cur in ('admin','super_admin')) and auth_role() <> 'super_admin' then
    raise exception 'forbidden: super admin required' using errcode = '42501';
  end if;
  perform set_config('spp.privileged', 'on', true);
  update profiles set role = new_role where id = target;
  perform set_config('spp.privileged', '', true);
end $$;

create or replace function set_user_company(target uuid, company uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can('sales') then raise exception 'forbidden' using errcode = '42501'; end if;
  perform set_config('spp.privileged', 'on', true);
  update profiles set company_id = company where id = target;
  perform set_config('spp.privileged', '', true);
end $$;

alter table profiles enable row level security;
alter table companies enable row level security;
alter table audit_log enable row level security;

create policy profiles_self_read on profiles for select using (id = auth.uid() or is_staff());
create policy profiles_self_update on profiles for update using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

create policy companies_read on companies for select using (is_staff() or id = (select company_id from profiles where id = auth.uid()));
create policy companies_write on companies for all using (can('sales')) with check (can('sales'));
create trigger companies_touch before update on companies for each row execute function touch_updated_at();
create trigger companies_audit after insert or update or delete on companies for each row execute function audit_row();

-- Audit log: readable by admins only; nobody writes to it directly.
create policy audit_admin_read on audit_log for select using (is_admin());

-- ── Reference numbers: SPP-DESIGN-2026-00001 etc. ──────────────────────────
create table ref_counters (
  kind text not null,
  year int not null,
  n int not null default 0,
  primary key (kind, year)
);
alter table ref_counters enable row level security; -- no policies: reachable only via next_ref()

create or replace function next_ref(p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare y int := extract(year from now())::int; v int;
begin
  insert into ref_counters as rc (kind, year, n) values (p_kind, y, 1)
  on conflict (kind, year) do update set n = rc.n + 1
  returning rc.n into v;
  return format('SPP-%s-%s-%s', upper(p_kind), y, lpad(v::text, 5, '0'));
end $$;
revoke all on function next_ref(text) from public, anon, authenticated;

-- ── Rate limiting for anonymous RPCs ───────────────────────────────────────
create table rate_hits (
  bucket text not null,
  ip inet not null,
  at timestamptz not null default now()
);
create index rate_hits_idx on rate_hits(bucket, ip, at desc);
alter table rate_hits enable row level security; -- no policies

create or replace function rate_limit(p_bucket text, max_hits int, per interval) returns void
language plpgsql security definer set search_path = public as $$
declare addr inet := coalesce(request_ip(), '0.0.0.0'::inet); c int;
begin
  delete from rate_hits where at < now() - interval '1 day';
  select count(*) into c from rate_hits r where r.bucket = p_bucket and r.ip = addr and r.at > now() - per;
  if c >= max_hits then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Too many requests. Please try again shortly.';
  end if;
  insert into rate_hits(bucket, ip) values (p_bucket, addr);
end $$;
revoke all on function rate_limit(text,int,interval) from public, anon, authenticated;

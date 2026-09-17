-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0002 · CMS content, catalogue, pricing, billboards, campaigns
-- Public visitors (anon) may read ONLY rows that are published. Pricing rules
-- are never readable by the public: estimates come from estimate_price().
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Settings & feature flags ───────────────────────────────────────────────
create table settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
create table feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now()
);

-- ── Media library ──────────────────────────────────────────────────────────
create table media (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'public-media',
  path text not null unique,
  file_name text not null,
  mime text not null,
  bytes bigint not null check (bytes >= 0),
  width int, height int,
  alt text not null default '',
  category text not null default 'general',
  tags text[] not null default '{}',
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index media_category_idx on media(category);
create index media_tags_idx on media using gin(tags);

-- ── Catalogue ──────────────────────────────────────────────────────────────
create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  blurb text not null default '',
  plate text not null default '00',
  sort int not null default 0,
  status publish_status not null default 'published'
);

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  category_id uuid not null references categories(id) on delete restrict,
  summary text not null default '',
  description text not null default '',
  -- presentational detail: materials[], sizes[], colours[], printMethods[], customisation[], useCases[], studio{}, seo{}
  data jsonb not null default '{}'::jsonb,
  moq int not null default 1 check (moq >= 1),
  lead_min_days int, lead_max_days int,
  pricing_mode pricing_mode not null default 'quote',
  price_from_lak numeric(14,2),
  price_unit text not null default 'per piece',
  featured boolean not null default false,
  sort int not null default 0,
  status publish_status not null default 'draft',
  publish_at timestamptz,
  cover_media_id uuid references media(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on products(category_id);
create index products_status_idx on products(status, sort);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text unique,
  name text not null,
  attrs jsonb not null default '{}'::jsonb,
  active boolean not null default true
);
create index product_variants_product_idx on product_variants(product_id);

create table product_relations (
  product_id uuid not null references products(id) on delete cascade,
  related_id uuid not null references products(id) on delete cascade,
  sort int not null default 0,
  primary key (product_id, related_id),
  check (product_id <> related_id)
);

create table product_media (
  product_id uuid not null references products(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  sort int not null default 0,
  primary key (product_id, media_id)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  verb text not null default 'Produce',
  summary text not null default '',
  body text not null default '',
  deliverables text[] not null default '{}',
  product_slugs text[] not null default '{}',
  sort int not null default 0,
  status publish_status not null default 'published'
);

create table solutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  goal text not null,
  prompt text not null default '',
  summary text not null default '',
  recommend jsonb not null default '[]'::jsonb,
  bundle_slug text,
  sort int not null default 0,
  status publish_status not null default 'published'
);

create table bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text not null default '',
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  featured boolean not null default false,
  status publish_status not null default 'published',
  updated_at timestamptz not null default now()
);
create table bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references bundles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty int not null default 1 check (qty > 0),
  note text not null default '',
  sort int not null default 0
);
create index bundle_items_bundle_idx on bundle_items(bundle_id);

-- ── Pricing engine (confidential) ──────────────────────────────────────────
-- kind:
--   base          amount = unit price at MOQ
--   qty_tier      min_qty..max_qty → percent discount (negative percent) on unit
--   method        match {"method":"embroidery"} → per_unit or percent
--   location      per extra print location beyond the first
--   material|size|finishing   match on the corresponding option
--   rush          percent uplift when deadline is inside the normal lead time
--   delivery|installation     flat
--   seasonal      percent, bounded by starts_at/ends_at
create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,   -- null = global rule
  kind text not null check (kind in ('base','qty_tier','method','location','material','size','finishing','rush','delivery','installation','seasonal')),
  label text not null,
  match jsonb not null default '{}'::jsonb,
  amount numeric(14,2) not null,
  amount_type text not null check (amount_type in ('flat','per_unit','percent')),
  min_qty int, max_qty int,
  starts_at timestamptz, ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pricing_rules_product_idx on pricing_rules(product_id, kind) where active;

-- ── Billboards ─────────────────────────────────────────────────────────────
create table billboards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  province text not null,
  district text not null default '',
  address text not null default '',
  lat double precision not null check (lat between 13 and 23),
  lng double precision not null check (lng between 99 and 108.5),
  width_m numeric(6,2) not null, height_m numeric(6,2) not null,
  orientation text not null default 'landscape' check (orientation in ('landscape','portrait')),
  faces int not null default 1 check (faces in (1,2)),
  facing text not null default '',
  lit boolean not null default false,
  visibility text not null default '',
  traffic text,
  status billboard_status not null default 'available',
  available_from date,
  pricing_mode pricing_mode not null default 'estimated',
  price_from_usd_month numeric(12,2),
  min_months int not null default 1,
  installation text not null default '',
  description text not null default '',
  verified boolean not null default false,
  publish publish_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billboards_status_idx on billboards(status);
create index billboards_province_idx on billboards(province);

create table billboard_media (
  billboard_id uuid not null references billboards(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  sort int not null default 0,
  primary key (billboard_id, media_id)
);

-- Blocks of time a face is committed (confirmed bookings, maintenance, holds).
create table billboard_availability (
  id uuid primary key default gen_random_uuid(),
  billboard_id uuid not null references billboards(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  kind text not null check (kind in ('booked','hold','maintenance')),
  booking_id uuid,
  note text not null default '',
  check (ends_on >= starts_on)
);
create index billboard_availability_idx on billboard_availability(billboard_id, starts_on, ends_on);

-- ── Editorial ──────────────────────────────────────────────────────────────
create table portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  client text not null default '',
  sector text not null default '',
  year int not null default extract(year from now())::int,
  services text[] not null default '{}',
  summary text not null default '',
  is_sample boolean not null default false,
  featured boolean not null default false,
  palette text[] not null default '{}',
  study jsonb not null default '[]'::jsonb,
  impact jsonb not null default '[]'::jsonb,
  cover_media_id uuid references media(id) on delete set null,
  sort int not null default 0,
  status publish_status not null default 'draft',
  updated_at timestamptz not null default now()
);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  tag text not null default 'News',
  read_mins int not null default 3,
  author_id uuid references profiles(id) on delete set null,
  cover_media_id uuid references media(id) on delete set null,
  seo jsonb not null default '{}'::jsonb,
  status publish_status not null default 'draft',
  published_at timestamptz,
  publish_at timestamptz,
  updated_at timestamptz not null default now()
);

create table faqs (
  id uuid primary key default gen_random_uuid(),
  topic text not null default 'ordering',
  q text not null, a text not null,
  sort int not null default 0,
  status publish_status not null default 'published'
);

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null, name text not null, role text not null default '', company text not null default '',
  -- a testimonial may only be published once someone records that consent was obtained
  consent_recorded boolean not null default false,
  sort int not null default 0,
  status publish_status not null default 'draft',
  check (status <> 'published' or consent_recorded)
);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null, title text not null default '', bio text not null default '',
  photo_media_id uuid references media(id) on delete set null,
  sort int not null default 0,
  status publish_status not null default 'draft'
);

create table design_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  garments text[] not null default '{}',
  suggested_colour text not null default '#f5f5f2',
  sides jsonb not null default '{}'::jsonb,
  featured boolean not null default false,
  sort int not null default 0,
  status publish_status not null default 'draft',
  updated_at timestamptz not null default now()
);

-- ── Page builder ───────────────────────────────────────────────────────────
create table pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  seo jsonb not null default '{}'::jsonb,
  status publish_status not null default 'draft',
  publish_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  kind text not null check (kind in ('hero','text','image','video','gallery','product_showcase','cta','testimonials','faq','pricing','portfolio','billboard_map','campaign','embed')),
  props jsonb not null default '{}'::jsonb,
  sort int not null default 0
);
create index page_sections_page_idx on page_sections(page_id, sort);

-- ── Campaigns & QR tracking ────────────────────────────────────────────────
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text not null default '',
  body text not null default '',
  cta_label text not null default 'Request a quote',
  cta_href text not null default '/request-quote/',
  product_slugs text[] not null default '{}',
  offer text not null default '',
  starts_on date, ends_on date,
  hero_media_id uuid references media(id) on delete set null,
  status publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_qr_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9]{6,16}$'),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  billboard_id uuid references billboards(id) on delete set null,
  medium text not null default 'billboard',
  label text not null default '',
  destination text not null default '',   -- path on this site; '' = the campaign page (/campaigns/?c=<slug>)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index campaign_qr_campaign_idx on campaign_qr_codes(campaign_id);

create table qr_scans (
  id bigint generated always as identity primary key,
  qr_id uuid not null references campaign_qr_codes(id) on delete cascade,
  at timestamptz not null default now(),
  session_id text,
  ua_family text,
  referrer text
);
create index qr_scans_qr_idx on qr_scans(qr_id, at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['settings','feature_flags','media','categories','products','product_variants','product_relations','product_media','services','solutions','bundles','bundle_items','pricing_rules','billboards','billboard_media','billboard_availability','portfolio_projects','blog_posts','faqs','testimonials','team_members','design_templates','pages','page_sections','campaigns','campaign_qr_codes','qr_scans']
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;

create policy settings_public_read on settings for select using (is_public or can('settings') or is_staff());
create policy settings_write on settings for all using (can('settings')) with check (can('settings'));

create policy flags_read on feature_flags for select using (true);
create policy flags_write on feature_flags for all using (can('settings')) with check (can('settings'));

create policy media_read on media for select using (bucket = 'public-media' or is_staff());
create policy media_write on media for all using (can('content') or can('catalogue') or can('billboards')) with check (can('content') or can('catalogue') or can('billboards'));

-- published-or-staff read, domain-gated write
create policy categories_read on categories for select using (status = 'published' or is_staff());
create policy categories_write on categories for all using (can('catalogue')) with check (can('catalogue'));

create policy products_read on products for select using ((status = 'published' and (publish_at is null or publish_at <= now())) or is_staff());
create policy products_write on products for all using (can('catalogue')) with check (can('catalogue'));

create policy variants_read on product_variants for select using (active or is_staff());
create policy variants_write on product_variants for all using (can('catalogue')) with check (can('catalogue'));
create policy relations_read on product_relations for select using (true);
create policy relations_write on product_relations for all using (can('catalogue')) with check (can('catalogue'));
create policy product_media_read on product_media for select using (true);
create policy product_media_write on product_media for all using (can('catalogue')) with check (can('catalogue'));

create policy services_read on services for select using (status = 'published' or is_staff());
create policy services_write on services for all using (can('content')) with check (can('content'));
create policy solutions_read on solutions for select using (status = 'published' or is_staff());
create policy solutions_write on solutions for all using (can('content')) with check (can('content'));
create policy bundles_read on bundles for select using (status = 'published' or is_staff());
create policy bundles_write on bundles for all using (can('catalogue')) with check (can('catalogue'));
create policy bundle_items_read on bundle_items for select using (true);
create policy bundle_items_write on bundle_items for all using (can('catalogue')) with check (can('catalogue'));

-- Pricing: admins only. Sales may READ to explain a quote; nobody else, ever.
create policy pricing_read on pricing_rules for select using (can('pricing') or can('sales'));
create policy pricing_write on pricing_rules for all using (can('pricing')) with check (can('pricing'));

create policy billboards_read on billboards for select using (publish = 'published' or is_staff());
create policy billboards_write on billboards for all using (can('billboards')) with check (can('billboards'));
create policy billboard_media_read on billboard_media for select using (true);
create policy billboard_media_write on billboard_media for all using (can('billboards')) with check (can('billboards'));
-- availability blocks are public (dates only; who booked lives on bookings, which is private)
create policy availability_read on billboard_availability for select using (true);
create policy availability_write on billboard_availability for all using (can('billboards')) with check (can('billboards'));

create policy portfolio_read on portfolio_projects for select using (status = 'published' or is_staff());
create policy portfolio_write on portfolio_projects for all using (can('content')) with check (can('content'));
create policy blog_read on blog_posts for select using ((status = 'published' and (publish_at is null or publish_at <= now())) or is_staff());
create policy blog_write on blog_posts for all using (can('content')) with check (can('content'));
create policy faqs_read on faqs for select using (status = 'published' or is_staff());
create policy faqs_write on faqs for all using (can('content')) with check (can('content'));
create policy testimonials_read on testimonials for select using (status = 'published' or is_staff());
create policy testimonials_write on testimonials for all using (can('content')) with check (can('content'));
create policy team_read on team_members for select using (status = 'published' or is_staff());
create policy team_write on team_members for all using (can('content')) with check (can('content'));
create policy templates_read on design_templates for select using (status = 'published' or is_staff());
create policy templates_write on design_templates for all using (can('content') or can('designs')) with check (can('content') or can('designs'));
create policy pages_read on pages for select using ((status = 'published' and (publish_at is null or publish_at <= now())) or is_staff());
create policy pages_write on pages for all using (can('content')) with check (can('content'));
create policy sections_read on page_sections for select using (exists (select 1 from pages p where p.id = page_id and (p.status = 'published' or is_staff())));
create policy sections_write on page_sections for all using (can('content')) with check (can('content'));

create policy campaigns_read on campaigns for select using (status = 'published' or is_staff());
create policy campaigns_write on campaigns for all using (can('campaigns')) with check (can('campaigns'));
create policy qr_read on campaign_qr_codes for select using (can('campaigns') or can('analytics'));
create policy qr_write on campaign_qr_codes for all using (can('campaigns')) with check (can('campaigns'));
create policy qr_scans_read on qr_scans for select using (can('campaigns') or can('analytics'));
-- qr_scans are inserted only by track_qr_scan()

-- ── Audit + touch triggers on everything an admin can edit ─────────────────
do $$
declare t text;
begin
  foreach t in array array['settings','feature_flags','categories','products','services','solutions','bundles','pricing_rules','billboards','billboard_availability','portfolio_projects','blog_posts','faqs','testimonials','team_members','design_templates','pages','page_sections','campaigns','campaign_qr_codes','media']
  loop execute format('create trigger %I after insert or update or delete on %I for each row execute function audit_row()', t || '_audit', t); end loop;
  foreach t in array array['settings','feature_flags','products','bundles','pricing_rules','billboards','portfolio_projects','blog_posts','design_templates','pages','campaigns']
  loop execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t); end loop;
end $$;

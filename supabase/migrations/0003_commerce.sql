-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0003 · The commercial chain
--   design → lead → quote → order → production → QC → delivery → reorder
-- Every table keeps a foreign key to the step before it, so no commercial
-- action is ever disconnected from the request that started it.
-- Customers see only rows they own. Internal commentary lives in
-- internal_notes, which customers can never read.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Brand library ──────────────────────────────────────────────────────────
create table brand_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references profiles(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  brand_name text not null default '',
  colours jsonb not null default '[]'::jsonb,      -- [{name,hex}]
  fonts text[] not null default '{}',
  guidelines text not null default '',
  updated_at timestamptz not null default now()
);

create table brand_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('logo','alt_logo','guideline','image','artwork','font')),
  path text not null unique,           -- private-artwork/<owner_id>/<uuid>.<ext>
  file_name text not null,
  mime text not null,
  bytes bigint not null,
  width int, height int,
  created_at timestamptz not null default now()
);
create index brand_assets_owner_idx on brand_assets(owner_id);

-- ── Designs ────────────────────────────────────────────────────────────────
create table designs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                       -- SPP-DESIGN-2026-00001
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null default 'Untitled design',
  product_slug text not null,
  garment text not null,
  colour text not null default '#f5f5f2',
  size text,
  sides jsonb not null default '{}'::jsonb,       -- { front:[layers], back:[layers], … }
  preview_path text,                              -- design-previews/<owner>/<id>.webp (watermarked, low-res)
  status design_status not null default 'draft',
  version int not null default 1,
  share_token text unique,                        -- null = not shared
  template_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index designs_owner_idx on designs(owner_id, updated_at desc);
create index designs_status_idx on designs(status);

create table design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs(id) on delete cascade,
  version int not null,
  colour text not null,
  sides jsonb not null,
  note text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (design_id, version)
);

create table design_assets (
  id uuid primary key default gen_random_uuid(),
  design_id uuid references designs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  path text not null unique,                      -- private-artwork/<owner_id>/<uuid>.<ext>
  file_name text not null,
  mime text not null check (mime in ('image/png','image/jpeg','image/webp','image/svg+xml','application/pdf')),
  bytes bigint not null check (bytes between 1 and 26214400),
  width int, height int,
  created_at timestamptz not null default now()
);
create index design_assets_design_idx on design_assets(design_id);

create table artwork_preflights (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs(id) on delete cascade,
  design_version int not null,
  verdict preflight_verdict not null,
  checks jsonb not null,                          -- [{id,level,title,detail,layerId?,side?}]
  -- staff sign-off is separate from, and always overrides, the automated result
  reviewed_by uuid references profiles(id) on delete set null,
  review_verdict preflight_verdict,
  review_note text not null default '',
  created_at timestamptz not null default now()
);
create index artwork_preflights_design_idx on artwork_preflights(design_id, created_at desc);

-- ── Leads (staff only) ─────────────────────────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  customer_id uuid references profiles(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  name text not null,
  company_name text not null default '',
  email citext,
  phone text not null default '',
  social_contact text not null default '',
  department text not null default '',
  source lead_source not null,
  source_detail text not null default '',          -- campaign slug, QR code, page path
  product_interest text[] not null default '{}',
  message text not null default '',
  estimated_value_lak numeric(16,2),
  priority priority_level not null default 'normal',
  status lead_status not null default 'new',
  lost_reason text,
  assigned_to uuid references profiles(id) on delete set null,
  follow_up_on date,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone <> '' or social_contact <> '')
);
create index leads_status_idx on leads(status, created_at desc);
create index leads_assigned_idx on leads(assigned_to);
create index leads_followup_idx on leads(follow_up_on) where status not in ('won','lost');
create index leads_customer_idx on leads(customer_id);

create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  kind text not null check (kind in ('created','note','call','email','whatsapp','meeting','status','assignment','quote','system')),
  body text not null default '',
  meta jsonb not null default '{}'::jsonb,
  actor uuid references profiles(id) on delete set null,
  at timestamptz not null default now()
);
create index lead_activities_lead_idx on lead_activities(lead_id, at desc);

-- ── Consultations ──────────────────────────────────────────────────────────
create table consultations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  lead_id uuid references leads(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  name text not null, company_name text not null default '',
  email citext not null, phone text not null default '',
  topic text not null,
  goal text not null default '',
  duration_mins int not null check (duration_mins in (15,30,45,60)),
  preferred_at timestamptz not null,
  alternative_at timestamptz,
  confirmed_at timestamptz,
  channel text not null default 'in_person' check (channel in ('in_person','phone','whatsapp','video')),
  info text not null default '',
  status consultation_status not null default 'requested',
  project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consultations_status_idx on consultations(status, preferred_at);

-- ── Projects ───────────────────────────────────────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  lead_id uuid references leads(id) on delete set null,
  consultation_id uuid references consultations(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  name text not null,
  objective text not null default '',
  scope text not null default '',
  requirements jsonb not null default '{}'::jsonb,   -- the project-builder answers
  stage project_stage not null default 'discovery',
  due_on date,
  owner_staff uuid references profiles(id) on delete set null,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table consultations add constraint consultations_project_fk foreign key (project_id) references projects(id) on delete set null;
create index projects_customer_idx on projects(customer_id);
create index projects_stage_idx on projects(stage);

create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null, due_on date, done_at timestamptz, sort int not null default 0
);
create table project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  milestone_id uuid references project_milestones(id) on delete set null,
  title text not null, assignee uuid references profiles(id) on delete set null,
  due_on date, done_at timestamptz, sort int not null default 0
);
create index project_tasks_project_idx on project_tasks(project_id);

-- ── Quotes ─────────────────────────────────────────────────────────────────
create table quotes (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  lead_id uuid references leads(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  contact jsonb not null default '{}'::jsonb,        -- snapshot {name,company,email,phone}
  kind text not null default 'product' check (kind in ('product','project','bundle','campaign','reorder')),
  needed_by date,
  needs_design_help boolean not null default false,
  customer_notes text not null default '',
  estimate_low_lak numeric(16,2), estimate_high_lak numeric(16,2),   -- engine output at submit time
  total_lak numeric(16,2),                                           -- staff's actual quoted total
  valid_until date,
  terms text not null default '',
  status quote_status not null default 'submitted',
  reorder_of uuid,                                                    -- orders.id
  sent_at timestamptz, decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_customer_idx on quotes(customer_id, created_at desc);
create index quotes_status_idx on quotes(status, created_at desc);
create index quotes_lead_idx on quotes(lead_id);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_slug text not null,
  product_name text not null,
  design_id uuid references designs(id) on delete set null,
  design_version int,
  qty int not null check (qty > 0),
  config jsonb not null default '{}'::jsonb,          -- {colour,sizes:{M:10…},method,locations[],material,finishing}
  estimate_unit_lak numeric(14,2),
  unit_price_lak numeric(14,2),                       -- staff-set
  line_total_lak numeric(16,2),
  note text not null default '',
  sort int not null default 0
);
create index quote_items_quote_idx on quote_items(quote_id);
create index quote_items_design_idx on quote_items(design_id);

-- ── Orders ─────────────────────────────────────────────────────────────────
create table orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  quote_id uuid references quotes(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  contact jsonb not null default '{}'::jsonb,
  status order_status not null default 'approved',
  payment_status payment_status not null default 'unpaid',
  total_lak numeric(16,2),
  due_on date,
  delivery_method text not null default 'pickup' check (delivery_method in ('pickup','delivery','installation')),
  delivery_address text not null default '',
  customer_confirmed_at timestamptz,
  completed_at timestamptz,
  reorder_of uuid references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table quotes add constraint quotes_reorder_fk foreign key (reorder_of) references orders(id) on delete set null;
create index orders_customer_idx on orders(customer_id, created_at desc);
create index orders_status_idx on orders(status, due_on);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  quote_item_id uuid references quote_items(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  product_slug text not null,
  product_name text not null,
  design_id uuid references designs(id) on delete set null,
  design_version int,
  qty int not null check (qty > 0),
  config jsonb not null default '{}'::jsonb,
  unit_price_lak numeric(14,2),
  line_total_lak numeric(16,2),
  sort int not null default 0
);
create index order_items_order_idx on order_items(order_id);

-- ── Production, QC, delivery (staff only) ──────────────────────────────────
create table production_jobs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid references order_items(id) on delete set null,
  product_name text not null,
  qty int not null,
  materials text not null default '',
  print_method text not null default '',
  design_id uuid references designs(id) on delete set null,
  final_artwork_version int,
  final_artwork_path text,
  deadline date,
  notes text not null default '',
  assigned_to uuid references profiles(id) on delete set null,
  status production_status not null default 'queued',
  blocked_reason text,
  started_at timestamptz, finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index production_jobs_status_idx on production_jobs(status, deadline);
create index production_jobs_order_idx on production_jobs(order_id);

create table quality_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references production_jobs(id) on delete cascade,
  checklist jsonb not null,            -- [{key,label,ok:boolean|null,note}]
  result qc_result not null,
  note text not null default '',
  checked_by uuid references profiles(id) on delete set null,
  checked_at timestamptz not null default now()
);
create index quality_checks_job_idx on quality_checks(job_id, checked_at desc);

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method text not null default 'delivery' check (method in ('pickup','delivery','installation')),
  status delivery_status not null default 'pending',
  scheduled_for date,
  address text not null default '',
  carrier text not null default '',
  tracking text not null default '',
  proof_path text,
  note text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deliveries_order_idx on deliveries(order_id);

-- ── Billboard bookings ─────────────────────────────────────────────────────
create table billboard_bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  billboard_id uuid not null references billboards(id) on delete restrict,
  lead_id uuid references leads(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  contact jsonb not null default '{}'::jsonb,
  starts_on date not null,
  ends_on date not null,
  design_asset_id uuid references design_assets(id) on delete set null,
  needs_design boolean not null default false,
  needs_print_install boolean not null default true,
  notes text not null default '',
  status booking_status not null default 'requested',
  quoted_usd numeric(12,2),
  campaign_id uuid references campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create index bookings_billboard_idx on billboard_bookings(billboard_id, starts_on);
create index bookings_customer_idx on billboard_bookings(customer_id);
create index bookings_status_idx on billboard_bookings(status);
alter table billboard_availability add constraint availability_booking_fk foreign key (booking_id) references billboard_bookings(id) on delete cascade;

-- ── Preorders ──────────────────────────────────────────────────────────────
create table preorders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  product_id uuid references products(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  contact jsonb not null default '{}'::jsonb,
  variant text not null default '',
  qty int not null check (qty > 0),
  window_closes_on date,
  status text not null default 'requested' check (status in ('requested','confirmed','converted','cancelled')),
  created_at timestamptz not null default now()
);

-- ── Shared: internal notes, messages, attachments, notifications, email ────
create table internal_notes (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('lead','quote','order','project','design','booking','consultation','job','customer')),
  entity_id uuid not null,
  body text not null,
  author uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index internal_notes_entity_idx on internal_notes(entity, entity_id, created_at desc);

-- Customer-visible conversation on a quote / order / project.
create table messages (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('quote','order','project','booking')),
  entity_id uuid not null,
  customer_id uuid references profiles(id) on delete cascade,  -- the customer who owns the thread
  sender uuid references profiles(id) on delete set null,
  from_staff boolean not null default false,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_entity_idx on messages(entity, entity_id, created_at);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid not null,
  owner_id uuid references profiles(id) on delete set null,
  path text not null unique,
  file_name text not null,
  mime text not null,
  bytes bigint not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index attachments_entity_idx on attachments(entity, entity_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,   -- null + audience = broadcast to a staff capability
  audience text,                                            -- e.g. 'sales','production'
  kind text not null,
  title text not null,
  body text not null default '',
  href text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, read_at, created_at desc);
create index notifications_audience_idx on notifications(audience, created_at desc);

-- Transactional email queue. The `send-email` Edge Function drains it; with no
-- provider key configured rows simply remain 'queued' and visible to admins.
create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email citext not null,
  template text not null,
  subject text not null,
  vars jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_status_idx on email_outbox(status, created_at);

-- ── Analytics events (first-party, cookieless session id) ──────────────────
create table analytics_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  session_id text not null,
  user_id uuid,
  name text not null check (name in (
    'page_view','product_view','customizer_started','design_created','design_saved','mockup_downloaded',
    'artwork_uploaded','quote_started','quote_requested','project_builder_started','project_builder_completed',
    'billboard_viewed','billboard_booking_started','billboard_booking_requested','consultation_requested',
    'contact_submitted','whatsapp_click','ai_assist_used','qr_landing','bundle_viewed','reorder_requested')),
  path text not null default '',
  product_slug text,
  ref text,                       -- design/quote/booking ref when relevant
  step text,                      -- funnel stage inside a flow
  source text,                    -- utm_source / qr code
  value_lak numeric(16,2)
);
create index analytics_events_name_at_idx on analytics_events(name, at desc);
create index analytics_events_session_idx on analytics_events(session_id, at);
create index analytics_events_product_idx on analytics_events(product_slug) where product_slug is not null;

-- High-intent activity that did not convert. Populated by record_intent();
-- contact details are stored ONLY when the visitor gave recovery consent.
create table abandoned_activities (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid references profiles(id) on delete cascade,
  flow text not null check (flow in ('design','quote','billboard_booking','project_builder')),
  stage text not null,
  product_slug text,
  ref text,
  contact_email citext,
  recovery_consent boolean not null default false,
  resume_href text not null default '',
  last_seen timestamptz not null default now(),
  converted boolean not null default false,
  contacted_at timestamptz,
  unique (session_id, flow)
);
create index abandoned_open_idx on abandoned_activities(flow, last_seen desc) where not converted;

-- ═══ RLS ═══════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['brand_profiles','brand_assets','designs','design_versions','design_assets','artwork_preflights','leads','lead_activities','consultations','projects','project_milestones','project_tasks','quotes','quote_items','orders','order_items','production_jobs','quality_checks','deliveries','billboard_bookings','preorders','internal_notes','messages','attachments','notifications','email_outbox','analytics_events','abandoned_activities']
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;

-- Brand library: strictly the owner's; designers/sales may view to do the work.
create policy brand_profiles_owner on brand_profiles for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy brand_profiles_staff on brand_profiles for select using (can('designs'));
create policy brand_assets_owner on brand_assets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy brand_assets_staff on brand_assets for select using (can('designs'));

-- Designs
create policy designs_owner on designs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy designs_staff_read on designs for select using (can('designs') or can('production'));
create policy designs_staff_update on designs for update using (can('designs')) with check (can('designs'));
create policy design_versions_owner on design_versions for select using (exists (select 1 from designs d where d.id = design_id and d.owner_id = auth.uid()));
create policy design_versions_staff on design_versions for select using (can('designs') or can('production'));
create policy design_assets_owner on design_assets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy design_assets_staff on design_assets for select using (can('designs') or can('production'));
create policy preflights_owner on artwork_preflights for select using (exists (select 1 from designs d where d.id = design_id and d.owner_id = auth.uid()));
create policy preflights_owner_insert on artwork_preflights for insert with check (
  exists (select 1 from designs d where d.id = design_id and d.owner_id = auth.uid())
  and reviewed_by is null and review_verdict is null);
create policy preflights_staff on artwork_preflights for all using (can('designs')) with check (can('designs'));

-- Leads: never visible to customers.
create policy leads_staff on leads for all using (can('sales')) with check (can('sales'));
create policy leads_marketing_read on leads for select using (can('analytics'));
create policy lead_activities_staff on lead_activities for all using (can('sales')) with check (can('sales'));

-- Consultations
create policy consultations_owner_read on consultations for select using (customer_id = auth.uid());
create policy consultations_staff on consultations for all using (can('sales')) with check (can('sales'));

-- Projects
create policy projects_owner_read on projects for select using (customer_id = auth.uid());
create policy projects_staff on projects for all using (can('sales') or can('production')) with check (can('sales') or can('production'));
create policy milestones_owner_read on project_milestones for select using (exists (select 1 from projects p where p.id = project_id and p.customer_id = auth.uid()));
create policy milestones_staff on project_milestones for all using (can('sales') or can('production')) with check (can('sales') or can('production'));
create policy tasks_staff on project_tasks for all using (can('sales') or can('production')) with check (can('sales') or can('production'));

-- Quotes: customers read their own; all writes go through RPCs or staff.
create policy quotes_owner_read on quotes for select using (customer_id = auth.uid());
create policy quotes_staff on quotes for all using (can('sales')) with check (can('sales'));
create policy quotes_designer_read on quotes for select using (can('designs'));
create policy quote_items_owner_read on quote_items for select using (exists (select 1 from quotes q where q.id = quote_id and q.customer_id = auth.uid()));
create policy quote_items_staff on quote_items for all using (can('sales')) with check (can('sales'));
create policy quote_items_designer_read on quote_items for select using (can('designs'));

-- Orders
create policy orders_owner_read on orders for select using (customer_id = auth.uid());
create policy orders_staff on orders for all using (can('sales')) with check (can('sales'));
create policy order_items_owner_read on order_items for select using (exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy order_items_staff on order_items for all using (can('sales')) with check (can('sales'));

-- Production and design staff need to know WHAT to make and WHEN — never what
-- it cost. They get no policy on orders/order_items; instead this view exposes
-- the money-free columns. (A view runs with its owner's rights, so the WHERE
-- clause is the gate.)
create view production_orders with (security_barrier = true) as
  select o.id, o.ref, o.status, o.due_on, o.delivery_method, o.delivery_address,
         o.contact ->> 'name' as contact_name, o.contact ->> 'company' as contact_company, o.created_at
  from orders o where can('production');
create view production_order_items with (security_barrier = true) as
  select i.id, i.order_id, i.product_slug, i.product_name, i.design_id, i.design_version, i.qty, i.config, i.sort
  from order_items i where can('production');
grant select on production_orders, production_order_items to authenticated;

-- Production / QC / delivery: internal only.
create policy jobs_staff on production_jobs for all using (can('production') or can('sales')) with check (can('production') or can('sales'));
create policy qc_staff on quality_checks for all using (can('production')) with check (can('production'));
create policy qc_sales_read on quality_checks for select using (can('sales'));
create policy deliveries_staff on deliveries for all using (can('production') or can('sales')) with check (can('production') or can('sales'));
create policy deliveries_owner_read on deliveries for select using (exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Billboard bookings
create policy bookings_owner_read on billboard_bookings for select using (customer_id = auth.uid());
create policy bookings_staff on billboard_bookings for all using (can('billboards')) with check (can('billboards'));

create policy preorders_owner_read on preorders for select using (customer_id = auth.uid());
create policy preorders_staff on preorders for all using (can('sales')) with check (can('sales'));

-- Internal notes: staff only. There is deliberately NO customer policy.
create policy internal_notes_staff on internal_notes for all using (is_staff()) with check (is_staff() and author = auth.uid());

-- Messages: the owning customer and staff.
create policy messages_owner_read on messages for select using (customer_id = auth.uid());
create policy messages_owner_insert on messages for insert with check (customer_id = auth.uid() and sender = auth.uid() and not from_staff);
create policy messages_staff on messages for all using (is_staff()) with check (is_staff());

create policy attachments_owner_read on attachments for select using (owner_id = auth.uid() and not internal);
create policy attachments_owner_insert on attachments for insert with check (owner_id = auth.uid() and not internal);
create policy attachments_staff on attachments for all using (is_staff()) with check (is_staff());

create policy notifications_own on notifications for select using (user_id = auth.uid() or (audience is not null and can(audience)));
create policy notifications_mark_read on notifications for update using (user_id = auth.uid() or (audience is not null and can(audience))) with check (true);

create policy email_outbox_admin on email_outbox for select using (is_admin());

create policy analytics_read on analytics_events for select using (can('analytics'));
create policy abandoned_read on abandoned_activities for select using (can('sales') or can('analytics'));
create policy abandoned_update on abandoned_activities for update using (can('sales')) with check (can('sales'));

-- ── Triggers ───────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['designs','leads','consultations','projects','quotes','orders','production_jobs','deliveries','billboard_bookings','brand_profiles']
  loop execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t); end loop;
  foreach t in array array['leads','consultations','projects','quotes','quote_items','orders','production_jobs','quality_checks','deliveries','billboard_bookings','preorders','designs']
  loop execute format('create trigger %I after insert or update or delete on %I for each row execute function audit_row()', t || '_audit', t); end loop;
end $$;

-- Lead status changes and assignments write themselves into the timeline.
create or replace function lead_timeline() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into lead_activities(lead_id, kind, body, actor) values (new.id, 'created', 'Lead captured from ' || new.source::text, auth.uid());
  else
    if new.status is distinct from old.status then
      insert into lead_activities(lead_id, kind, body, meta, actor)
      values (new.id, 'status', old.status::text || ' → ' || new.status::text, jsonb_build_object('from', old.status, 'to', new.status), auth.uid());
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      insert into lead_activities(lead_id, kind, body, meta, actor)
      values (new.id, 'assignment', 'Assignment changed', jsonb_build_object('to', new.assigned_to), auth.uid());
    end if;
  end if;
  return new;
end $$;
create trigger leads_timeline after insert or update on leads for each row execute function lead_timeline();

-- Snapshot every saved design version (immutable history for traceability).
create or replace function snapshot_design() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.sides is distinct from old.sides or new.colour is distinct from old.colour then
    if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
    insert into design_versions(design_id, version, colour, sides, created_by)
    values (new.id, new.version, new.colour, new.sides, auth.uid());
  end if;
  return new;
end $$;
create trigger designs_snapshot_ins after insert on designs for each row execute function snapshot_design();
create trigger designs_snapshot_upd before update on designs for each row execute function snapshot_design();

-- A customer may never reassign ownership, forge a ref, or self-approve.
create or replace function guard_design_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not can('designs') then
    if new.owner_id is distinct from old.owner_id or new.ref is distinct from old.ref then
      raise exception 'forbidden: protected design fields' using errcode = '42501';
    end if;
    if new.status = 'approved' and old.status is distinct from 'approved' then
      raise exception 'forbidden: only SPP can approve artwork' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger designs_guard before update on designs for each row execute function guard_design_update();

-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0004 · Server-side operations (RPC)
-- The public site never writes to tables directly. Every inbound action goes
-- through one of these functions, which validate, rate-limit, create the
-- lead → quote/booking/consultation chain atomically, and queue notifications.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Validation helpers ─────────────────────────────────────────────────────
create or replace function clean(t text, max_len int) returns text
language sql immutable as $$
  -- strip control characters (keeps tab, newline, carriage return), trim, cap length
  select left(btrim(regexp_replace(coalesce(t, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), max_len)
$$;

create or replace function valid_email(t text) returns boolean
language sql immutable as $$
  select t is not null and length(t) <= 254 and t ~* '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'
$$;

create or replace function require(cond boolean, msg text) returns void
language plpgsql immutable as $$
begin
  if cond is not true then raise exception '%', msg using errcode = '22023'; end if;
end $$;

-- Parse the shared contact block once.  → (name, company, email, phone, social)
create or replace function parse_contact(p jsonb, out name text, out company text, out email text, out phone text, out social text)
language plpgsql immutable as $$
begin
  name := clean(p ->> 'name', 120);
  company := clean(p ->> 'company', 160);
  email := lower(clean(p ->> 'email', 254));
  phone := clean(p ->> 'phone', 40);
  social := clean(p ->> 'social', 160);
  perform require(length(name) >= 2, 'Please tell us your name.');
  perform require(email <> '' or phone <> '' or social <> '', 'Please give us at least one way to reach you.');
  perform require(email = '' or valid_email(email), 'That email address does not look right.');
  perform require(phone = '' or phone ~ '^[0-9+()\-\s]{6,40}$', 'That phone number does not look right.');
end $$;

-- ── Reference assignment for customer-created designs ──────────────────────
create or replace function assign_design_ref() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.ref := next_ref('design');      -- whatever the client sent is ignored
  new.version := 1;
  if not can('designs') then new.status := case when new.status in ('draft','saved') then new.status else 'draft' end; end if;
  return new;
end $$;
create trigger designs_assign_ref before insert on designs for each row execute function assign_design_ref();

-- ── Notifications & email ──────────────────────────────────────────────────
create or replace function notify_staff(aud text, k text, ttl text, bdy text, link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications(audience, kind, title, body, href) values (aud, k, ttl, bdy, link)
$$;
revoke all on function notify_staff(text,text,text,text,text) from public, anon, authenticated;

create or replace function queue_email(recipient text, tpl text, subj text, v jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if recipient is null or recipient = '' then return; end if;
  insert into email_outbox(to_email, template, subject, vars) values (recipient, tpl, subj, v);
end $$;
revoke all on function queue_email(text,text,text,jsonb) from public, anon, authenticated;

-- ── Internal: create a lead ────────────────────────────────────────────────
create or replace function _create_lead(
  c_name text, c_company text, c_email text, c_phone text, c_social text,
  src lead_source, src_detail text, interest text[], msg text, est numeric, consent boolean
) returns leads
language plpgsql security definer set search_path = public as $$
declare l leads; pr priority_level := 'normal';
begin
  if est is not null and est >= 50000000 then pr := 'high'; end if;   -- ≥ 50M LAK
  insert into leads(ref, customer_id, name, company_name, email, phone, social_contact, source, source_detail, product_interest, message, estimated_value_lak, priority, marketing_consent)
  values (next_ref('lead'), auth.uid(), c_name, c_company, nullif(c_email,''), c_phone, c_social, src, clean(src_detail, 200), coalesce(interest, '{}'), clean(msg, 4000), est, pr, coalesce(consent, false))
  returning * into l;
  perform notify_staff('sales', case when pr = 'high' then 'lead_high_value' else 'lead_new' end,
    case when pr = 'high' then 'High-value lead: ' else 'New lead: ' end || l.name,
    initcap(replace(src::text, '_', ' ')) || coalesce(' · ' || nullif(c_company, ''), ''),
    '/admin/leads/?id=' || l.id);
  return l;
end $$;
revoke all on function _create_lead(text,text,text,text,text,lead_source,text,text[],text,numeric,boolean) from public, anon, authenticated;

-- ═══ PRICING ENGINE ════════════════════════════════════════════════════════
-- Returns only a range and coarse, customer-safe line labels. Rule amounts,
-- tier boundaries and margins never leave the database.
create or replace function _price(p_slug text, p_qty int, opts jsonb)
returns table (mode pricing_mode, unit numeric, total numeric, lines jsonb, moq int, online boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  prod products; base numeric; u numeric; flat numeric := 0; r pricing_rules;
  locs int := greatest(coalesce(jsonb_array_length(opts -> 'locations'), 1), 1);
  needed date := nullif(opts ->> 'neededBy', '')::date;
  out_lines jsonb := '[]'::jsonb;
begin
  select * into prod from products where slug = p_slug and status = 'published';
  if prod.id is null then raise exception 'Unknown product' using errcode = 'P0002'; end if;
  moq := prod.moq; mode := prod.pricing_mode;
  online := coalesce((select enabled from feature_flags where key = 'ONLINE_PRICING'), false);
  if mode = 'quote' or not online then unit := null; total := null; lines := '[]'::jsonb; return next; return; end if;

  select amount into base from pricing_rules where product_id = prod.id and kind = 'base' and active order by created_at desc limit 1;
  if base is null then mode := 'quote'; unit := null; total := null; lines := '[]'::jsonb; return next; return; end if;
  u := base;
  out_lines := out_lines || jsonb_build_object('label', prod.name);

  for r in
    select * from pricing_rules pr
    where pr.active and (pr.product_id = prod.id or pr.product_id is null) and pr.kind <> 'base'
      and (pr.starts_at is null or pr.starts_at <= now()) and (pr.ends_at is null or pr.ends_at >= now())
    order by case pr.kind when 'material' then 1 when 'size' then 2 when 'method' then 3 when 'finishing' then 4 when 'location' then 5 when 'qty_tier' then 6 when 'seasonal' then 7 when 'rush' then 8 else 9 end
  loop
    if r.kind = 'qty_tier' then
      continue when p_qty < coalesce(r.min_qty, 0) or p_qty > coalesce(r.max_qty, 2147483647);
    elsif r.kind in ('method','material','size','finishing') then
      continue when not (opts @> r.match);
    elsif r.kind = 'location' then
      continue when locs <= 1;
    elsif r.kind = 'rush' then
      continue when needed is null or prod.lead_min_days is null or needed >= (current_date + prod.lead_min_days);
    elsif r.kind in ('delivery','installation') then
      continue when not coalesce((opts ->> r.kind)::boolean, false);
    end if;

    if r.amount_type = 'percent' then u := u * (1 + r.amount / 100.0);
    elsif r.amount_type = 'per_unit' then u := u + r.amount * (case when r.kind = 'location' then locs - 1 else 1 end);
    else flat := flat + r.amount; end if;

    out_lines := out_lines || jsonb_build_object('label',
      case r.kind when 'qty_tier' then 'Volume pricing applied' when 'rush' then 'Rush production' when 'location' then (locs - 1)::text || ' additional print location' || case when locs > 2 then 's' else '' end
                  when 'seasonal' then r.label when 'delivery' then 'Delivery' when 'installation' then 'Installation' else r.label end);
  end loop;

  unit := round(greatest(u, 0), -2);                      -- LAK, to the nearest 100
  total := round(unit * p_qty + flat, -3);
  lines := out_lines;
  return next;
end $$;
revoke all on function _price(text,int,jsonb) from public, anon, authenticated;

create or replace function estimate_price(product_slug text, qty int, options jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p record;
begin
  perform require(qty between 1 and 1000000, 'Quantity must be between 1 and 1,000,000.');
  perform require(pg_column_size(options) < 4096, 'Options too large.');
  select * into p from _price(product_slug, qty, coalesce(options, '{}'::jsonb));
  if p.unit is null then
    return jsonb_build_object('mode', 'quote', 'moq', p.moq, 'belowMoq', qty < p.moq);
  end if;
  -- An estimate is published as a ±8% band, never as a single confidential figure.
  return jsonb_build_object(
    'mode', p.mode, 'moq', p.moq, 'belowMoq', qty < p.moq, 'currency', 'LAK',
    'unitLow', round(p.unit * 0.92, -2), 'unitHigh', round(p.unit * 1.08, -2),
    'totalLow', round(p.total * 0.92, -3), 'totalHigh', round(p.total * 1.08, -3),
    'lines', p.lines,
    'disclaimer', 'Estimate only. Your written quotation from SPP is the confirmed price.');
end $$;
grant execute on function estimate_price(text,int,jsonb) to anon, authenticated;

-- ═══ PUBLIC SUBMISSIONS ════════════════════════════════════════════════════

-- Contact form
create or replace function submit_contact(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; l leads;
begin
  perform rate_limit('contact', 5, interval '10 minutes');
  perform require(coalesce(payload ->> 'website', '') = '', 'Rejected.');     -- honeypot
  select * into c from parse_contact(payload -> 'contact');
  perform require(length(clean(payload ->> 'message', 4000)) >= 5, 'Please add a short message.');
  l := _create_lead(c.name, c.company, c.email, c.phone, c.social, 'contact', payload ->> 'path', null, payload ->> 'message', null, (payload ->> 'consent')::boolean);
  perform queue_email(c.email, 'contact_received', 'We have your message — SPP', jsonb_build_object('name', c.name, 'ref', l.ref));
  return jsonb_build_object('ref', l.ref);
end $$;
grant execute on function submit_contact(jsonb) to anon, authenticated;

-- Quote request (single product, multi-item, bundle, project or campaign)
create or replace function submit_quote(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c record; l leads; q quotes; it jsonb; prod products; d designs; p record;
  low numeric := 0; high numeric := 0; priced boolean := true; n int := 0;
  k text := coalesce(payload ->> 'kind', 'product'); interest text[] := '{}';
begin
  perform rate_limit('quote', 6, interval '10 minutes');
  perform require(coalesce(payload ->> 'website', '') = '', 'Rejected.');
  perform require(k in ('product','project','bundle','campaign'), 'Unknown quote kind.');
  perform require(jsonb_typeof(payload -> 'items') = 'array' and jsonb_array_length(payload -> 'items') between 1 and 30, 'Add at least one item.');
  select * into c from parse_contact(payload -> 'contact');

  insert into quotes(ref, customer_id, contact, kind, needed_by, needs_design_help, customer_notes, status)
  values (next_ref('quote'), auth.uid(),
          jsonb_build_object('name', c.name, 'company', c.company, 'email', c.email, 'phone', c.phone, 'social', c.social),
          k, nullif(payload ->> 'neededBy', '')::date, coalesce((payload ->> 'needsDesignHelp')::boolean, false),
          clean(payload ->> 'notes', 4000), 'submitted')
  returning * into q;

  for it in select * from jsonb_array_elements(payload -> 'items') loop
    select * into prod from products where slug = it ->> 'product' and status = 'published';
    perform require(prod.id is not null, 'One of the products is no longer available.');
    perform require((it ->> 'qty')::int between 1 and 1000000, 'Quantity must be at least 1.');
    d := null;
    if nullif(it ->> 'designRef', '') is not null then
      -- IDOR guard: a design may only be attached by its owner.
      select * into d from designs where ref = it ->> 'designRef' and owner_id = auth.uid();
      perform require(d.id is not null, 'That design could not be found on your account.');
      update designs set status = 'submitted' where id = d.id and status in ('draft','saved');
    end if;
    select * into p from _price(prod.slug, (it ->> 'qty')::int, coalesce(it -> 'config', '{}'::jsonb) || jsonb_build_object('neededBy', payload ->> 'neededBy'));
    if p.unit is null then priced := false; else low := low + p.total * 0.92; high := high + p.total * 1.08; end if;
    insert into quote_items(quote_id, product_id, product_slug, product_name, design_id, design_version, qty, config, estimate_unit_lak, note, sort)
    values (q.id, prod.id, prod.slug, prod.name, d.id, d.version, (it ->> 'qty')::int, coalesce(it -> 'config', '{}'::jsonb), p.unit, clean(it ->> 'note', 500), n);
    interest := interest || prod.slug; n := n + 1;
  end loop;

  if priced then update quotes set estimate_low_lak = round(low, -3), estimate_high_lak = round(high, -3) where id = q.id returning * into q; end if;

  l := _create_lead(c.name, c.company, c.email, c.phone, c.social,
        case k when 'project' then 'project_builder'::lead_source when 'campaign' then 'campaign'::lead_source else 'quote'::lead_source end,
        coalesce(payload ->> 'source', ''), interest, payload ->> 'notes', case when priced then (low + high) / 2 end, (payload ->> 'consent')::boolean);
  update quotes set lead_id = l.id where id = q.id;
  update leads set status = 'quote' where id = l.id;
  insert into lead_activities(lead_id, kind, body, meta) values (l.id, 'quote', 'Quote request ' || q.ref, jsonb_build_object('quote_id', q.id));

  if k = 'project' and payload ? 'project' then
    insert into projects(ref, lead_id, customer_id, name, objective, requirements, due_on)
    values (next_ref('project'), l.id, auth.uid(), clean(payload #>> '{project,name}', 160), clean(payload #>> '{project,goal}', 600), payload -> 'project', nullif(payload ->> 'neededBy','')::date);
  end if;

  update abandoned_activities set converted = true where session_id = payload ->> 'sessionId' and flow in ('quote','design','project_builder');
  perform notify_staff('sales', 'quote_new', 'New quote request ' || q.ref, c.name || ' · ' || n || ' item' || case when n > 1 then 's' else '' end, '/admin/quotes/?id=' || q.id);
  perform queue_email(c.email, 'quote_submitted', 'Quote request ' || q.ref || ' received', jsonb_build_object('name', c.name, 'ref', q.ref));
  return jsonb_build_object('ref', q.ref, 'leadRef', l.ref, 'estimateLow', q.estimate_low_lak, 'estimateHigh', q.estimate_high_lak);
end $$;
grant execute on function submit_quote(jsonb) to anon, authenticated;

-- Consultation
create or replace function submit_consultation(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; l leads; k consultations; pref timestamptz := (payload ->> 'preferredAt')::timestamptz;
begin
  perform rate_limit('consultation', 4, interval '10 minutes');
  perform require(coalesce(payload ->> 'website', '') = '', 'Rejected.');
  select * into c from parse_contact(payload -> 'contact');
  perform require(c.email <> '', 'We need an email address to confirm your consultation.');
  perform require((payload ->> 'durationMins')::int in (15,30,45,60), 'Choose a consultation length.');
  perform require(pref > now() + interval '2 hours' and pref < now() + interval '120 days', 'Choose a time at least two hours from now.');
  perform require(length(clean(payload ->> 'topic', 160)) >= 2, 'Tell us what you would like to talk about.');
  l := _create_lead(c.name, c.company, c.email, c.phone, c.social, 'consultation', payload ->> 'topic', null, payload ->> 'goal', null, (payload ->> 'consent')::boolean);
  insert into consultations(ref, lead_id, customer_id, name, company_name, email, phone, topic, goal, duration_mins, preferred_at, alternative_at, channel, info)
  values (next_ref('consult'), l.id, auth.uid(), c.name, c.company, c.email, c.phone, clean(payload ->> 'topic', 160), clean(payload ->> 'goal', 1000),
          (payload ->> 'durationMins')::int, pref, nullif(payload ->> 'alternativeAt','')::timestamptz,
          coalesce(nullif(payload ->> 'channel',''), 'in_person'), clean(payload ->> 'info', 2000))
  returning * into k;
  perform notify_staff('sales', 'consultation_new', 'Consultation request ' || k.ref, c.name || ' · ' || k.duration_mins || ' min', '/admin/consultations/?id=' || k.id);
  perform queue_email(c.email, 'consultation_requested', 'Consultation request ' || k.ref || ' received', jsonb_build_object('name', c.name, 'ref', k.ref, 'when', k.preferred_at));
  return jsonb_build_object('ref', k.ref);
end $$;
grant execute on function submit_consultation(jsonb) to anon, authenticated;

-- Billboard booking REQUEST. Never confirms; never blocks dates.
create or replace function submit_booking(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; l leads; b billboards; k billboard_bookings; s date := (payload ->> 'startsOn')::date; e date := (payload ->> 'endsOn')::date; a design_assets; clash boolean;
begin
  perform rate_limit('booking', 5, interval '10 minutes');
  perform require(coalesce(payload ->> 'website', '') = '', 'Rejected.');
  select * into c from parse_contact(payload -> 'contact');
  select * into b from billboards where code = payload ->> 'billboard' and publish = 'published';
  perform require(b.id is not null, 'That billboard could not be found.');
  perform require(b.status <> 'unavailable', 'This location is not currently offered.');
  perform require(s >= current_date and e > s and e <= current_date + 1100, 'Choose a valid campaign period.');
  perform require((e - s) >= b.min_months * 28, 'The minimum booking for this location is ' || b.min_months || ' month(s).');
  if nullif(payload ->> 'artworkAssetId','') is not null then
    select * into a from design_assets where id = (payload ->> 'artworkAssetId')::uuid and owner_id = auth.uid();   -- IDOR guard
    perform require(a.id is not null, 'That artwork could not be found on your account.');
  end if;
  select exists (select 1 from billboard_availability av where av.billboard_id = b.id and av.starts_on <= e and av.ends_on >= s) into clash;

  l := _create_lead(c.name, c.company, c.email, c.phone, c.social, 'billboard', b.code, array['billboard-rental'], payload ->> 'notes',
        case when b.price_from_usd_month is not null then b.price_from_usd_month * greatest(((e - s) / 30.0), 1) * 21500 end, (payload ->> 'consent')::boolean);
  insert into billboard_bookings(ref, billboard_id, lead_id, customer_id, contact, starts_on, ends_on, design_asset_id, needs_design, needs_print_install, notes)
  values (next_ref('booking'), b.id, l.id, auth.uid(), jsonb_build_object('name', c.name, 'company', c.company, 'email', c.email, 'phone', c.phone),
          s, e, a.id, coalesce((payload ->> 'needsDesign')::boolean, false), coalesce((payload ->> 'needsPrintInstall')::boolean, true), clean(payload ->> 'notes', 2000))
  returning * into k;
  update abandoned_activities set converted = true where session_id = payload ->> 'sessionId' and flow = 'billboard_booking';
  perform notify_staff('billboards', 'booking_new', 'Billboard enquiry ' || k.ref, b.code || ' · ' || b.name || case when clash then ' · DATE CLASH' else '' end, '/admin/billboards/?booking=' || k.id);
  perform queue_email(c.email, 'booking_requested', 'Booking request ' || k.ref || ' received', jsonb_build_object('name', c.name, 'ref', k.ref, 'billboard', b.name));
  return jsonb_build_object('ref', k.ref, 'possibleClash', clash,
    'message', 'Request received. This is not a confirmed booking — our team will check availability and reply.');
end $$;
grant execute on function submit_booking(jsonb) to anon, authenticated;

-- ═══ CUSTOMER ACTIONS ══════════════════════════════════════════════════════
create or replace function respond_to_quote(quote uuid, accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q quotes;
begin
  select * into q from quotes where id = quote and customer_id = auth.uid();
  if q.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform require(q.status = 'sent', 'This quote is not awaiting your decision.');
  perform require(q.valid_until is null or q.valid_until >= current_date, 'This quote has expired. Please ask us to refresh it.');
  update quotes set status = case when accept then 'accepted'::quote_status else 'declined'::quote_status end, decided_at = now() where id = q.id;
  perform notify_staff('sales', 'quote_decision', 'Quote ' || q.ref || case when accept then ' ACCEPTED' else ' declined' end, coalesce(q.contact ->> 'name', ''), '/admin/quotes/?id=' || q.id);
  return jsonb_build_object('ref', q.ref, 'status', case when accept then 'accepted' else 'declined' end);
end $$;
grant execute on function respond_to_quote(uuid, boolean) to authenticated;

-- Reorder: clone a completed order into a new quote request with changed quantities.
create or replace function request_reorder(order_id uuid, quantities jsonb default '{}'::jsonb, needed_by date default null, notes text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; q quotes; oi order_items; new_qty int; l leads;
begin
  perform rate_limit('reorder', 6, interval '10 minutes');
  select * into o from orders where id = order_id and customer_id = auth.uid();            -- IDOR guard
  if o.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform require(o.status in ('completed','delivery','ready'), 'Only fulfilled orders can be reordered.');
  insert into quotes(ref, customer_id, contact, kind, needed_by, customer_notes, status, reorder_of)
  values (next_ref('quote'), auth.uid(), o.contact, 'reorder', needed_by, clean(notes, 2000), 'submitted', o.id) returning * into q;
  for oi in select * from order_items where order_items.order_id = o.id order by sort loop
    new_qty := coalesce((quantities ->> oi.id::text)::int, oi.qty);
    continue when new_qty <= 0;
    insert into quote_items(quote_id, product_id, product_slug, product_name, design_id, design_version, qty, config, sort)
    values (q.id, oi.product_id, oi.product_slug, oi.product_name, oi.design_id, oi.design_version, new_qty, oi.config, oi.sort);
  end loop;
  perform require(exists (select 1 from quote_items where quote_id = q.id), 'Nothing to reorder.');
  l := _create_lead(coalesce(o.contact ->> 'name', 'Customer'), coalesce(o.contact ->> 'company', ''), coalesce(o.contact ->> 'email', ''), coalesce(o.contact ->> 'phone', ''), '', 'quote', 'reorder:' || o.ref, null, notes, o.total_lak, false);
  update quotes set lead_id = l.id where id = q.id;
  perform notify_staff('sales', 'reorder', 'Reorder request ' || q.ref, 'From order ' || o.ref, '/admin/quotes/?id=' || q.id);
  return jsonb_build_object('ref', q.ref);
end $$;
grant execute on function request_reorder(uuid, jsonb, date, text) to authenticated;

-- Private share links for designs
create or replace function set_design_sharing(design uuid, shared boolean) returns text
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if not exists (select 1 from designs where id = design and owner_id = auth.uid()) then raise exception 'not found' using errcode = 'P0002'; end if;
  tok := case when shared then encode(gen_random_bytes(18), 'hex') end;
  update designs set share_token = tok where id = design;
  return tok;
end $$;
grant execute on function set_design_sharing(uuid, boolean) to authenticated;

create or replace function get_shared_design(token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ref', ref, 'name', name, 'productSlug', product_slug, 'garment', garment, 'colour', colour, 'sides', sides, 'updatedAt', updated_at)
  from designs where share_token = token and length(token) = 36
$$;
grant execute on function get_shared_design(text) to anon, authenticated;

-- ═══ STAFF WORKFLOW ════════════════════════════════════════════════════════
create or replace function convert_quote_to_order(quote uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q quotes; o orders;
begin
  if not can('sales') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into q from quotes where id = quote for update;
  if q.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform require(q.status in ('accepted','sent'), 'Only a sent or accepted quote can become an order.');
  perform require(not exists (select 1 from orders where quote_id = q.id), 'This quote already has an order.');
  perform require(not exists (select 1 from quote_items where quote_id = q.id and unit_price_lak is null), 'Price every line before creating the order.');
  insert into orders(ref, quote_id, lead_id, project_id, customer_id, contact, status, total_lak, due_on, reorder_of)
  values (next_ref('order'), q.id, q.lead_id, q.project_id, q.customer_id, q.contact, 'approved', q.total_lak, q.needed_by, q.reorder_of) returning * into o;
  insert into order_items(order_id, quote_item_id, product_id, product_slug, product_name, design_id, design_version, qty, config, unit_price_lak, line_total_lak, sort)
  select o.id, id, product_id, product_slug, product_name, design_id, design_version, qty, config, unit_price_lak, coalesce(line_total_lak, unit_price_lak * qty), sort from quote_items where quote_id = q.id;
  update quotes set status = 'accepted', decided_at = coalesce(decided_at, now()) where id = q.id;
  if q.lead_id is not null then update leads set status = 'won' where id = q.lead_id; end if;
  if q.customer_id is not null then
    insert into notifications(user_id, kind, title, body, href) values (q.customer_id, 'order_created', 'Order ' || o.ref || ' confirmed', 'Your order is now with our artwork team.', '/account/orders/?id=' || o.id);
  end if;
  perform queue_email(q.contact ->> 'email', 'order_created', 'Order ' || o.ref || ' confirmed', jsonb_build_object('name', q.contact ->> 'name', 'ref', o.ref));
  return jsonb_build_object('orderId', o.id, 'ref', o.ref);
end $$;
grant execute on function convert_quote_to_order(uuid) to authenticated;

create or replace function release_to_production(p_order uuid) returns int
language plpgsql security definer set search_path = public as $$
declare o orders; n int := 0; oi order_items;
begin
  if not (can('sales') or can('production')) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from orders where id = p_order for update;
  if o.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform require(o.status in ('approved','artwork_review'), 'Order is already in production.');
  -- Artwork gate: every designed line must carry SPP-approved artwork.
  perform require(not exists (
    select 1 from order_items i join designs d on d.id = i.design_id where i.order_id = o.id and d.status <> 'approved'
  ), 'Approve the artwork on every line before releasing to production.');
  for oi in select * from order_items where order_id = o.id order by sort loop
    insert into production_jobs(ref, order_id, order_item_id, product_name, qty, print_method, materials, design_id, final_artwork_version, deadline)
    values (next_ref('job'), o.id, oi.id, oi.product_name, oi.qty, coalesce(oi.config ->> 'method', ''), coalesce(oi.config ->> 'material', ''), oi.design_id, oi.design_version, o.due_on);
    n := n + 1;
  end loop;
  update orders set status = 'production' where id = o.id;
  perform notify_staff('production', 'jobs_new', n || ' new production job' || case when n > 1 then 's' else '' end, 'Order ' || o.ref, '/admin/production/');
  if o.customer_id is not null then
    insert into notifications(user_id, kind, title, body, href) values (o.customer_id, 'production_started', 'Production has started', 'Order ' || o.ref, '/account/orders/?id=' || o.id);
  end if;
  return n;
end $$;
grant execute on function release_to_production(uuid) to authenticated;

-- QC result drives the job and, when every job passes, the order.
create or replace function record_qc(job uuid, checklist jsonb, result qc_result, note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare j production_jobs;
begin
  if not can('production') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into j from production_jobs where id = job for update;
  if j.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  insert into quality_checks(job_id, checklist, result, note, checked_by) values (j.id, checklist, result, clean(note, 2000), auth.uid());
  update production_jobs set status = case result when 'pass' then 'done'::production_status when 'fail' then 'in_progress'::production_status else 'qc'::production_status end,
         finished_at = case when result = 'pass' then now() end where id = j.id;
  if result = 'pass' and not exists (select 1 from production_jobs where order_id = j.order_id and status <> 'done' and id <> j.id) then
    update orders set status = 'ready' where id = j.order_id;
    insert into deliveries(order_id, method, address) select id, delivery_method, delivery_address from orders o where o.id = j.order_id and not exists (select 1 from deliveries d where d.order_id = o.id);
  end if;
end $$;
grant execute on function record_qc(uuid, jsonb, qc_result, text) to authenticated;

create or replace function convert_consultation_to_project(consultation uuid, project_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k consultations; p projects;
begin
  if not can('sales') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into k from consultations where id = consultation for update;
  if k.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform require(k.project_id is null, 'Already converted.');
  insert into projects(ref, lead_id, consultation_id, customer_id, name, objective, requirements)
  values (next_ref('project'), k.lead_id, k.id, k.customer_id, clean(project_name, 160), k.goal,
          jsonb_build_object('topic', k.topic, 'info', k.info, 'contact', jsonb_build_object('name', k.name, 'company', k.company_name, 'email', k.email, 'phone', k.phone)))
  returning * into p;
  -- carry the internal notes across so history is not lost
  insert into internal_notes(entity, entity_id, body, author, created_at)
  select 'project', p.id, body, author, created_at from internal_notes where entity = 'consultation' and entity_id = k.id;
  update consultations set status = 'converted', project_id = p.id where id = k.id;
  if k.lead_id is not null then update leads set status = 'qualified' where id = k.lead_id and status in ('new','contacted'); end if;
  return jsonb_build_object('projectId', p.id, 'ref', p.ref);
end $$;
grant execute on function convert_consultation_to_project(uuid, text) to authenticated;

-- Confirming a booking is a deliberate staff act, and it is what blocks dates.
create or replace function confirm_booking(booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k billboard_bookings;
begin
  if not can('billboards') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into k from billboard_bookings where id = booking for update;
  if k.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform require(not exists (select 1 from billboard_availability a where a.billboard_id = k.billboard_id and a.starts_on <= k.ends_on and a.ends_on >= k.starts_on and a.booking_id is distinct from k.id), 'Those dates clash with an existing commitment.');
  insert into billboard_availability(billboard_id, starts_on, ends_on, kind, booking_id) values (k.billboard_id, k.starts_on, k.ends_on, 'booked', k.id);
  update billboard_bookings set status = 'confirmed' where id = k.id;
  if k.starts_on <= current_date then update billboards set status = 'reserved', available_from = k.ends_on + 1 where id = k.billboard_id; end if;
  if k.customer_id is not null then
    insert into notifications(user_id, kind, title, body, href) values (k.customer_id, 'booking_confirmed', 'Billboard booking confirmed', k.ref, '/account/billboards/');
  end if;
  perform queue_email(k.contact ->> 'email', 'booking_confirmed', 'Booking ' || k.ref || ' confirmed', jsonb_build_object('name', k.contact ->> 'name', 'ref', k.ref));
end $$;
grant execute on function confirm_booking(uuid) to authenticated;

-- ═══ ANALYTICS ═════════════════════════════════════════════════════════════
create or replace function track_event(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform rate_limit('event', 240, interval '5 minutes');
  insert into analytics_events(session_id, user_id, name, path, product_slug, ref, step, source, value_lak)
  values (clean(payload ->> 'sessionId', 64), auth.uid(), payload ->> 'name', clean(payload ->> 'path', 300), nullif(clean(payload ->> 'product', 120), ''),
          nullif(clean(payload ->> 'ref', 60), ''), nullif(clean(payload ->> 'step', 60), ''), nullif(clean(payload ->> 'source', 120), ''), nullif(payload ->> 'value', '')::numeric);
exception when check_violation then null;   -- unknown event names are dropped, not errors
end $$;
grant execute on function track_event(jsonb) to anon, authenticated;

create or replace function record_intent(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare consent boolean := coalesce((payload ->> 'recoveryConsent')::boolean, false); em text := lower(clean(payload ->> 'email', 254));
begin
  perform rate_limit('intent', 120, interval '5 minutes');
  insert into abandoned_activities(session_id, user_id, flow, stage, product_slug, ref, contact_email, recovery_consent, resume_href)
  values (clean(payload ->> 'sessionId', 64), auth.uid(), payload ->> 'flow', clean(payload ->> 'stage', 60), nullif(clean(payload ->> 'product', 120), ''), nullif(clean(payload ->> 'ref', 60), ''),
          case when consent and valid_email(em) then em end, consent, clean(payload ->> 'resumeHref', 300))
  on conflict (session_id, flow) do update set stage = excluded.stage, product_slug = coalesce(excluded.product_slug, abandoned_activities.product_slug),
      ref = coalesce(excluded.ref, abandoned_activities.ref), last_seen = now(), resume_href = excluded.resume_href,
      recovery_consent = abandoned_activities.recovery_consent or excluded.recovery_consent,
      contact_email = coalesce(excluded.contact_email, abandoned_activities.contact_email);
end $$;
grant execute on function record_intent(jsonb) to anon, authenticated;

create or replace function track_qr_scan(qr_code text, session text default null, ua text default null, ref text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q campaign_qr_codes; c campaigns;
begin
  perform rate_limit('qr', 60, interval '5 minutes');
  select * into q from campaign_qr_codes where code = qr_code and active;
  if q.id is null then return jsonb_build_object('destination', '/'); end if;
  select * into c from campaigns where id = q.campaign_id;
  insert into qr_scans(qr_id, session_id, ua_family, referrer) values (q.id, clean(session, 64), clean(ua, 40), clean(ref, 200));
  return jsonb_build_object('destination', coalesce(nullif(q.destination, ''), '/campaigns/?c=' || c.slug), 'campaign', c.slug, 'code', q.code);
end $$;
grant execute on function track_qr_scan(text, text, text, text) to anon, authenticated;

-- ── Command Center read models ─────────────────────────────────────────────
create or replace function attention_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'newLeads',           case when can('sales') then (select count(*) from leads where status = 'new') end,
    'highValueLeads',     case when can('sales') then (select count(*) from leads where priority in ('high','urgent') and status not in ('won','lost')) end,
    'quotesAwaiting',     case when can('sales') then (select count(*) from quotes where status in ('submitted','in_review')) end,
    'followUpsDue',       case when can('sales') then (select count(*) from leads where follow_up_on <= current_date and status not in ('won','lost')) end,
    'consultations',      case when can('sales') then (select count(*) from consultations where status = 'requested') end,
    'billboardEnquiries', case when can('billboards') then (select count(*) from billboard_bookings where status in ('requested','in_review')) end,
    'artworkApprovals',   case when can('designs') then (select count(*) from designs where status = 'submitted') end,
    'urgentOrders',       case when can('sales') or can('production') then (select count(*) from orders where status not in ('completed','cancelled') and due_on <= current_date + 3) end,
    'jobsOverdue',        case when can('production') then (select count(*) from production_jobs where status <> 'done' and deadline < current_date) end,
    'jobsBlocked',        case when can('production') then (select count(*) from production_jobs where status = 'blocked') end,
    'abandonedHighIntent',case when can('sales') then (select count(*) from abandoned_activities where not converted and last_seen > now() - interval '7 days' and last_seen < now() - interval '1 hour') end
  );
end $$;
grant execute on function attention_summary() to authenticated;

create or replace function funnel_summary(since timestamptz default now() - interval '30 days') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ev jsonb;
begin
  if not can('analytics') then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(jsonb_object_agg(name, n), '{}'::jsonb) into ev from (select name, count(distinct session_id) n from analytics_events where at >= since group by name) s;
  return jsonb_build_object(
    'since', since, 'sessionsByEvent', ev,
    'visitors',        (select count(distinct session_id) from analytics_events where at >= since),
    'qualifiedLeads',  (select count(*) from leads where created_at >= since and status in ('qualified','quote','negotiation','won')),
    'leads',           (select count(*) from leads where created_at >= since),
    'quotes',          (select count(*) from quotes where created_at >= since),
    'orders',          (select count(*) from orders where created_at >= since),
    'revenueLak',      (select coalesce(sum(total_lak), 0) from orders where created_at >= since and status <> 'cancelled'),
    'pipelineLak',     (select coalesce(sum(estimated_value_lak), 0) from leads where status not in ('won','lost')),
    'avgOrderLak',     (select coalesce(avg(total_lak), 0) from orders where created_at >= since and status <> 'cancelled' and total_lak is not null),
    'repeatCustomers', (select count(*) from (select customer_id from orders where customer_id is not null group by customer_id having count(*) > 1) r),
    'reorders',        (select count(*) from orders where reorder_of is not null and created_at >= since),
    'leadsBySource',   (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb) from (select source::text, count(*) n from leads where created_at >= since group by source) s),
    'leadsByStatus',   (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status::text, count(*) n from leads group by status) s),
    'productViews',    (select coalesce(jsonb_agg(jsonb_build_object('product', product_slug, 'views', n) order by n desc), '[]'::jsonb) from (select product_slug, count(*) n from analytics_events where at >= since and name = 'product_view' and product_slug is not null group by product_slug order by n desc limit 12) s),
    'abandonment',     (select coalesce(jsonb_agg(jsonb_build_object('flow', flow, 'stage', stage, 'count', n) order by n desc), '[]'::jsonb) from (select flow, stage, count(*) n from abandoned_activities where last_seen >= since and not converted group by flow, stage) s),
    'qrByCode',        (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'label', label, 'scans', n) order by n desc), '[]'::jsonb) from (select q.code, q.label, count(s.id) n from campaign_qr_codes q left join qr_scans s on s.qr_id = q.id and s.at >= since group by q.code, q.label) s),
    'daily',           (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visitors', v, 'leads', l) order by d), '[]'::jsonb) from (
                          select g::date d,
                                 (select count(distinct session_id) from analytics_events e where e.at::date = g::date) v,
                                 (select count(*) from leads le where le.created_at::date = g::date) l
                          from generate_series(greatest(since::date, current_date - 89), current_date, interval '1 day') g) s)
  );
end $$;
grant execute on function funnel_summary(timestamptz) to authenticated;

-- Tighten an over-broad policy from 0003.
drop policy notifications_mark_read on notifications;
create policy notifications_mark_read on notifications for update
  using (user_id = auth.uid() or (audience is not null and can(audience)))
  with check (user_id is not distinct from auth.uid() or (audience is not null and can(audience)));

-- Audit entity ids for tables keyed by something other than `id`.
create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into audit_log(actor, actor_role, action, entity, entity_id, before, after, ip)
  values (auth.uid(), (select role from profiles where id = auth.uid()), lower(tg_op), tg_table_name,
          coalesce(j ->> 'id', j ->> 'key', j ->> 'code'),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
          request_ip());
  return coalesce(new, old);
end $$;

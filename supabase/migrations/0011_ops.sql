-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0011 · Command Center operations
-- Closes the gaps the staff workflow hit under RLS:
--   · reference numbers come only from next_ref(), which staff cannot call, so
--     manual leads / quotes / projects / consultations need a server-side door
--   · notifications has no INSERT policy (by design) — staff-to-customer
--     notices must go through a narrow SECURITY DEFINER function
--   · production staff cannot update orders (money), so delivery progress must
--     move the order forward on their behalf
-- Re-runnable: functions are `create or replace`, triggers are dropped first.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Staff → customer notification (portal links only) ──────────────────────
create or replace function notify_customer(target uuid, k text, ttl text, bdy text, link text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if target is null then return; end if;
  perform require(clean(link, 300) like '/account/%', 'Customer notifications may only link into My SPP.');
  perform require(length(clean(ttl, 160)) >= 2, 'A notification needs a title.');
  insert into notifications(user_id, kind, title, body, href)
  select p.id, clean(k, 60), clean(ttl, 160), clean(bdy, 400), clean(link, 300) from profiles p where p.id = target and p.role = 'customer';
end $$;
revoke all on function notify_customer(uuid,text,text,text,text) from public, anon;
grant execute on function notify_customer(uuid,text,text,text,text) to authenticated;

-- ── Manual lead ────────────────────────────────────────────────────────────
create or replace function staff_create_lead(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; l leads; src lead_source := coalesce(nullif(payload ->> 'source', ''), 'manual')::lead_source;
begin
  if not can('sales') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from parse_contact(payload -> 'contact');
  insert into leads(ref, name, company_name, email, phone, social_contact, source, source_detail, product_interest, message, estimated_value_lak, priority, assigned_to, follow_up_on)
  values (next_ref('lead'), c.name, c.company, nullif(c.email, ''), c.phone, c.social, src, clean(payload ->> 'sourceDetail', 200),
          coalesce((select array_agg(clean(x, 120)) from jsonb_array_elements_text(coalesce(payload -> 'interest', '[]'::jsonb)) x where clean(x, 120) <> ''), '{}'),
          clean(payload ->> 'message', 4000), nullif(payload ->> 'estimatedValueLak', '')::numeric,
          coalesce(nullif(payload ->> 'priority', ''), 'normal')::priority_level,
          coalesce(nullif(payload ->> 'assignedTo', '')::uuid, auth.uid()), nullif(payload ->> 'followUpOn', '')::date)
  returning * into l;
  return jsonb_build_object('id', l.id, 'ref', l.ref);
end $$;
revoke all on function staff_create_lead(jsonb) from public, anon;
grant execute on function staff_create_lead(jsonb) to authenticated;

-- ── Manual quote (draft) for an existing lead or a fresh contact ───────────
create or replace function staff_create_quote(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; l leads; q quotes; it jsonb; prod products; n int := 0; v_lead uuid := nullif(payload ->> 'leadId', '')::uuid;
begin
  if not can('sales') then raise exception 'forbidden' using errcode = '42501'; end if;
  perform require(jsonb_typeof(payload -> 'items') = 'array' and jsonb_array_length(payload -> 'items') between 1 and 30, 'Add at least one item.');
  if v_lead is not null then
    select * into l from leads where id = v_lead;
    if l.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  else
    select * into c from parse_contact(payload -> 'contact');
    insert into leads(ref, name, company_name, email, phone, social_contact, source, source_detail, status, assigned_to)
    values (next_ref('lead'), c.name, c.company, nullif(c.email, ''), c.phone, c.social, 'manual', 'staff quote', 'quote', auth.uid()) returning * into l;
  end if;
  insert into quotes(ref, lead_id, project_id, customer_id, contact, kind, needed_by, needs_design_help, customer_notes, status)
  values (next_ref('quote'), l.id, nullif(payload ->> 'projectId', '')::uuid, l.customer_id,
          jsonb_build_object('name', l.name, 'company', l.company_name, 'email', coalesce(l.email::text, ''), 'phone', l.phone, 'social', l.social_contact),
          coalesce(nullif(payload ->> 'kind', ''), 'product'), nullif(payload ->> 'neededBy', '')::date,
          coalesce((payload ->> 'needsDesignHelp')::boolean, false), clean(payload ->> 'notes', 4000), 'draft')
  returning * into q;
  for it in select * from jsonb_array_elements(payload -> 'items') loop
    select * into prod from products where slug = it ->> 'product';
    perform require(prod.id is not null, 'One of the products could not be found.');
    perform require((it ->> 'qty')::int between 1 and 1000000, 'Quantity must be at least 1.');
    insert into quote_items(quote_id, product_id, product_slug, product_name, qty, note, sort)
    values (q.id, prod.id, prod.slug, prod.name, (it ->> 'qty')::int, clean(it ->> 'note', 500), n);
    n := n + 1;
  end loop;
  update leads set status = 'quote' where id = l.id and status in ('new','contacted','qualified');
  insert into lead_activities(lead_id, kind, body, meta, actor) values (l.id, 'quote', 'Quote ' || q.ref || ' drafted by staff', jsonb_build_object('quote_id', q.id), auth.uid());
  return jsonb_build_object('id', q.id, 'ref', q.ref, 'leadId', l.id);
end $$;
revoke all on function staff_create_quote(jsonb) from public, anon;
grant execute on function staff_create_quote(jsonb) to authenticated;

-- ── Send a quote: the moment it becomes visible as an offer in My SPP ──────
create or replace function send_quote(quote uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q quotes;
begin
  if not can('sales') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into q from quotes where id = quote for update;
  if q.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform require(q.status in ('draft','submitted','in_review','sent','expired'), 'This quote has already been decided.');
  perform require(exists (select 1 from quote_items where quote_id = q.id), 'Add at least one line before sending.');
  perform require(not exists (select 1 from quote_items where quote_id = q.id and unit_price_lak is null), 'Price every line before sending the quote.');
  perform require(q.total_lak is not null and q.total_lak > 0, 'Set the quote total before sending.');
  perform require(q.valid_until is null or q.valid_until >= current_date, 'The valid-until date is in the past.');
  update quotes set status = 'sent', sent_at = now() where id = q.id;
  if q.customer_id is not null then
    insert into notifications(user_id, kind, title, body, href)
    select p.id, 'quote_sent', 'Your quotation ' || q.ref || ' is ready', 'Review it and accept or decline in My SPP.', '/account/quotes/?id=' || q.id
    from profiles p where p.id = q.customer_id and p.role = 'customer';
  end if;
  perform queue_email(q.contact ->> 'email', 'quote_sent', 'Your quotation ' || q.ref || ' from SPP', jsonb_build_object('name', q.contact ->> 'name', 'ref', q.ref, 'total', q.total_lak, 'validUntil', q.valid_until));
  if q.lead_id is not null then
    update leads set status = 'negotiation' where id = q.lead_id and status in ('new','contacted','qualified','quote');
    insert into lead_activities(lead_id, kind, body, meta, actor) values (q.lead_id, 'quote', 'Quote ' || q.ref || ' sent', jsonb_build_object('quote_id', q.id), auth.uid());
  end if;
  return jsonb_build_object('ref', q.ref, 'status', 'sent');
end $$;
revoke all on function send_quote(uuid) from public, anon;
grant execute on function send_quote(uuid) to authenticated;

-- ── Manual project ─────────────────────────────────────────────────────────
create or replace function staff_create_project(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p projects; l leads; v_lead uuid := nullif(payload ->> 'leadId', '')::uuid;
begin
  if not can('sales') then raise exception 'forbidden' using errcode = '42501'; end if;
  perform require(length(clean(payload ->> 'name', 160)) >= 2, 'Give the project a name.');
  if v_lead is not null then
    select * into l from leads where id = v_lead;
    if l.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  end if;
  insert into projects(ref, lead_id, customer_id, company_id, name, objective, scope, due_on, owner_staff)
  values (next_ref('project'), l.id, l.customer_id, l.company_id, clean(payload ->> 'name', 160), clean(payload ->> 'objective', 600),
          clean(payload ->> 'scope', 4000), nullif(payload ->> 'dueOn', '')::date, auth.uid())
  returning * into p;
  if l.id is not null then
    update leads set status = 'qualified' where id = l.id and status in ('new','contacted');
    insert into lead_activities(lead_id, kind, body, meta, actor) values (l.id, 'system', 'Project ' || p.ref || ' created', jsonb_build_object('project_id', p.id), auth.uid());
  end if;
  return jsonb_build_object('id', p.id, 'ref', p.ref);
end $$;
revoke all on function staff_create_project(jsonb) from public, anon;
grant execute on function staff_create_project(jsonb) to authenticated;

-- ── Manual consultation (phone / walk-in bookings) ─────────────────────────
create or replace function staff_create_consultation(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; l leads; k consultations; at_ timestamptz := (payload ->> 'preferredAt')::timestamptz; v_lead uuid := nullif(payload ->> 'leadId', '')::uuid;
begin
  if not can('sales') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from parse_contact(payload -> 'contact');
  perform require(c.email <> '', 'An email address is needed to confirm the consultation.');
  perform require((payload ->> 'durationMins')::int in (15,30,45,60), 'Choose a consultation length.');
  perform require(at_ is not null, 'Choose a date and time.');
  perform require(length(clean(payload ->> 'topic', 160)) >= 2, 'Add a topic.');
  if v_lead is not null then
    select * into l from leads where id = v_lead;
    if l.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  else
    insert into leads(ref, name, company_name, email, phone, social_contact, source, source_detail, assigned_to)
    values (next_ref('lead'), c.name, c.company, c.email, c.phone, c.social, 'manual', 'staff consultation', auth.uid()) returning * into l;
  end if;
  insert into consultations(ref, lead_id, customer_id, name, company_name, email, phone, topic, goal, duration_mins, preferred_at, channel, info)
  values (next_ref('consult'), l.id, l.customer_id, c.name, c.company, c.email, c.phone, clean(payload ->> 'topic', 160), clean(payload ->> 'goal', 1000),
          (payload ->> 'durationMins')::int, at_, coalesce(nullif(payload ->> 'channel', ''), 'in_person'), clean(payload ->> 'info', 2000))
  returning * into k;
  return jsonb_build_object('id', k.id, 'ref', k.ref);
end $$;
revoke all on function staff_create_consultation(jsonb) from public, anon;
grant execute on function staff_create_consultation(jsonb) to authenticated;

-- ── Artwork: request changes ───────────────────────────────────────────────
-- Hands the design back to its owner, tells them why, and — where the design
-- sits on one of their quotes — records the reason on that customer thread.
create or replace function request_design_changes(design uuid, note text) returns void
language plpgsql security definer set search_path = public as $$
declare d designs; q quotes; msg text := clean(note, 2000);
begin
  if not can('designs') then raise exception 'forbidden' using errcode = '42501'; end if;
  perform require(length(msg) >= 5, 'Tell the customer what needs to change.');
  select * into d from designs where id = design for update;
  if d.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform require(d.status in ('submitted','approved'), 'Only submitted or approved artwork can be sent back.');
  update designs set status = 'saved' where id = d.id;
  insert into notifications(user_id, kind, title, body, href)
  values (d.owner_id, 'artwork_changes', 'Artwork changes requested · ' || d.ref, left(msg, 400), '/design/?id=' || d.id);
  select qq.* into q from quotes qq join quote_items qi on qi.quote_id = qq.id
  where qi.design_id = d.id and qq.customer_id = d.owner_id order by qq.created_at desc limit 1;
  if q.id is not null then
    insert into messages(entity, entity_id, customer_id, sender, from_staff, body)
    values ('quote', q.id, q.customer_id, auth.uid(), true, 'Artwork ' || d.ref || ' — changes requested: ' || msg);
  end if;
end $$;
revoke all on function request_design_changes(uuid, text) from public, anon;
grant execute on function request_design_changes(uuid, text) to authenticated;

-- ── Messages notify the other side ─────────────────────────────────────────
create or replace function message_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text; path text;
begin
  if new.entity = 'quote' then select ref into r from quotes where id = new.entity_id; path := 'quotes';
  elsif new.entity = 'order' then select ref into r from orders where id = new.entity_id; path := 'orders';
  elsif new.entity = 'project' then select ref into r from projects where id = new.entity_id; path := 'projects';
  else return new; end if;      -- booking threads are announced by the billboard workflow
  if new.from_staff then
    if new.customer_id is not null then
      insert into notifications(user_id, kind, title, body, href)
      values (new.customer_id, 'message', 'New message from SPP · ' || coalesce(r, ''), left(new.body, 200), '/account/' || path || '/?id=' || new.entity_id);
    end if;
  else
    insert into notifications(audience, kind, title, body, href)
    values ('sales', 'message', 'Customer message · ' || coalesce(r, ''), left(new.body, 200), '/admin/' || path || '/?id=' || new.entity_id);
  end if;
  return new;
end $$;
drop trigger if exists messages_notify on messages;
create trigger messages_notify after insert on messages for each row execute function message_notify();

-- ── Delivery progress moves the order (production cannot update orders) ────
create or replace function delivery_sync_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into o from orders where id = new.order_id;
  if new.status = 'in_transit' and o.status in ('ready','quality_control','production') then
    update orders set status = 'delivery' where id = o.id;
    if o.customer_id is not null then
      insert into notifications(user_id, kind, title, body, href) values (o.customer_id, 'order_delivery', 'Your order is on its way', 'Order ' || o.ref, '/account/orders/?id=' || o.id);
    end if;
  elsif new.status in ('delivered','installed') and o.status not in ('completed','cancelled') then
    update orders set status = 'completed', completed_at = now() where id = o.id;
    if o.customer_id is not null then
      insert into notifications(user_id, kind, title, body, href) values (o.customer_id, 'order_completed', 'Order ' || o.ref || ' ' || new.status::text, 'Thank you — reorder any time from My SPP.', '/account/orders/?id=' || o.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists deliveries_sync_order on deliveries;
create trigger deliveries_sync_order after update on deliveries for each row execute function delivery_sync_order();

-- A job entering QC puts a producing order into its quality-control stage.
create or replace function job_sync_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'qc' and old.status is distinct from 'qc' then
    update orders set status = 'quality_control' where id = new.order_id and status = 'production'
      and not exists (select 1 from production_jobs j where j.order_id = new.order_id and j.id <> new.id and j.status in ('queued','in_progress','blocked'));
  end if;
  return new;
end $$;
drop trigger if exists production_jobs_sync_order on production_jobs;
create trigger production_jobs_sync_order after update on production_jobs for each row execute function job_sync_order();

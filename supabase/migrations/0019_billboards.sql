-- 0019 · Billboards: yearly terms, no public pricing, structure type + material.
--
-- Client decisions (2026-09-27):
--   1. Terms are quoted in YEARS and no price is published anywhere. Customers
--      request a location; SPP replies with a written quotation.
--   2. Two structure types: a printed billboard ("static") and an LED screen.
--   3. The face material is recorded (die-cut vinyl, plastwood, …), free text.
--
-- `billboards` is readable by anon (billboards_read), so the monthly price
-- column is DROPPED rather than left in place: a public table must not carry a
-- confidential figure. `pricing_mode` stays (harmless default) for compatibility.

alter table billboards
  add column if not exists kind text not null default 'static',
  add column if not exists material text,
  add column if not exists min_years int not null default 1;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'billboards'::regclass and conname = 'billboards_kind_check') then
    alter table billboards add constraint billboards_kind_check check (kind in ('static','led'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'billboards'::regclass and conname = 'billboards_min_years_check') then
    alter table billboards add constraint billboards_min_years_check check (min_years between 1 and 10);
  end if;
end $$;

comment on column billboards.kind is 'static = printed billboard, led = LED screen';
comment on column billboards.material is 'Face material as recorded by SPP, e.g. Die-cut vinyl, Plastwood, Flex banner, Aluminium composite, LED panel';
comment on column billboards.min_years is 'Minimum term in whole years; every request is quoted in writing';

-- Carry existing minimum terms across (3 months → 1 year), then drop the old columns.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'billboards' and column_name = 'min_months') then
    update billboards set min_years = least(10, greatest(1, ceil(min_months / 12.0)::int));
    alter table billboards drop column min_months;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'billboards' and column_name = 'price_from_usd_month') then
    alter table billboards drop column price_from_usd_month;
  end if;
end $$;

-- The public FAQ that described a monthly guide price is reworded in place.
update faqs set q = 'How is a billboard priced?',
  a = 'No price is published online. Choose a location, a start date and a term in years, and SPP sends a written quotation covering site rental for that term, with artwork design, printing and installation itemised alongside it. Multi-site and longer-term campaigns are quoted together.'
  where q = 'What is included in the billboard price?';

-- Billboard booking REQUEST. Never confirms; never blocks dates; never prices.
-- The term must cover at least `min_years` whole years (end is inclusive, so a
-- one-year term is 1 Feb 2027 → 31 Jan 2028). Up to ~5 years ahead.
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
  perform require(s >= current_date and e > s and e <= current_date + 1900, 'Choose a valid campaign period.');
  perform require(e >= (s + make_interval(years => b.min_years))::date - 1, 'The minimum term for this location is ' || b.min_years || ' year(s).');
  if nullif(payload ->> 'artworkAssetId','') is not null then
    select * into a from design_assets where id = (payload ->> 'artworkAssetId')::uuid and owner_id = auth.uid();   -- IDOR guard
    perform require(a.id is not null, 'That artwork could not be found on your account.');
  end if;
  select exists (select 1 from billboard_availability av where av.billboard_id = b.id and av.starts_on <= e and av.ends_on >= s) into clash;

  -- no estimated value: billboards carry no public price, staff quote the lead
  l := _create_lead(c.name, c.company, c.email, c.phone, c.social, 'billboard', b.code, array['billboard-rental'], payload ->> 'notes', null, (payload ->> 'consent')::boolean);
  insert into billboard_bookings(ref, billboard_id, lead_id, customer_id, contact, starts_on, ends_on, design_asset_id, needs_design, needs_print_install, notes)
  values (next_ref('booking'), b.id, l.id, auth.uid(), jsonb_build_object('name', c.name, 'company', c.company, 'email', c.email, 'phone', c.phone),
          s, e, a.id, coalesce((payload ->> 'needsDesign')::boolean, false), coalesce((payload ->> 'needsPrintInstall')::boolean, true), clean(payload ->> 'notes', 2000))
  returning * into k;
  update abandoned_activities set converted = true where session_id = payload ->> 'sessionId' and flow = 'billboard_booking';
  perform notify_staff('billboards', 'booking_new', 'Billboard enquiry ' || k.ref, b.code || ' · ' || b.name || case when clash then ' · DATE CLASH' else '' end, '/admin/billboards/?booking=' || k.id);
  perform queue_email(c.email, 'booking_requested', 'Booking request ' || k.ref || ' received', jsonb_build_object('name', c.name, 'ref', k.ref, 'billboard', b.name));
  return jsonb_build_object('ref', k.ref, 'possibleClash', clash,
    'message', 'Request received. This is not a confirmed booking — our team will check availability and send you a written quotation.');
end $$;
grant execute on function submit_booking(jsonb) to anon, authenticated;

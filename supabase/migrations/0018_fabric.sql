-- 0018 · Fabric groups and bag handle colour
--
-- Products carry `fabric` inside products.data (jsonb) — no schema change needed
-- there. Designs gain the customer's handle / rope colour for bags, kept with the
-- version history and included in shared-link payloads.

alter table designs add column if not exists trim_colour text;
comment on column designs.trim_colour is 'Handle / rope colour for bags (#rrggbb). Null = matched to the bag fabric.';
alter table designs drop constraint if exists designs_trim_colour_hex;
alter table designs add constraint designs_trim_colour_hex check (trim_colour is null or trim_colour ~ '^#[0-9a-fA-F]{6}$');

alter table design_versions add column if not exists trim_colour text;

-- Snapshot every saved design version, now including the handle colour.
create or replace function snapshot_design() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.sides is distinct from old.sides or new.colour is distinct from old.colour or new.trim_colour is distinct from old.trim_colour then
    if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
    insert into design_versions(design_id, version, colour, trim_colour, sides, created_by)
    values (new.id, new.version, new.colour, new.trim_colour, new.sides, auth.uid());
  end if;
  return new;
end $$;

create or replace function get_shared_design(token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ref', ref, 'name', name, 'productSlug', product_slug, 'garment', garment, 'colour', colour, 'trimColour', trim_colour, 'sides', sides, 'updatedAt', updated_at)
  from designs where share_token = token and length(token) = 36
$$;
grant execute on function get_shared_design(text) to anon, authenticated;

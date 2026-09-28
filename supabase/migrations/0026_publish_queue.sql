-- 0026 · Publishing that never depends on a personal token
--
-- "Publish site" records a request here. When the GitHub dispatch token is set
-- the rebuild starts at once; when it is missing or has expired, a scheduled
-- GitHub Actions job compares this stamp with the one baked into the live site
-- and starts the rebuild itself (within about 15 minutes). Either way staff can
-- publish without a developer.
--
-- The stamp is only a timestamp, so it is safe to expose to the anonymous key.
create or replace function publish_stamp() returns text
language sql stable security definer set search_path = public as $$
  select value ->> 'at' from settings where key = 'publish_request'
$$;
revoke all on function publish_stamp() from public;
grant execute on function publish_stamp() to anon, authenticated;

-- Staff with content, catalogue or settings rights may ask for a publish directly
-- (used by the Command Center if the Edge Function cannot be reached).
create or replace function request_publish() returns jsonb
language plpgsql security definer set search_path = public as $$
declare stamp jsonb;
begin
  if not (can('content') or can('catalogue') or can('settings') or can('billboards')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  stamp := jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', auth.uid());
  insert into settings(key, value, is_public, updated_by) values ('publish_request', stamp, false, auth.uid())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;
  return stamp;
end $$;
revoke all on function request_publish() from public, anon;
grant execute on function request_publish() to authenticated;

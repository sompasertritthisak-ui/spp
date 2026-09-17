-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0015 · AI assistant usage quota
-- The assistant costs real money per call, so every call is metered per
-- signed-in user (guests included). The Edge Function calls ai_quota_take()
-- with the caller's own JWT before it ever contacts the model.
-- ═══════════════════════════════════════════════════════════════════════════
create table ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  task text not null default 'design',
  at timestamptz not null default now()
);
create index ai_usage_user_idx on ai_usage(user_id, at desc);
alter table ai_usage enable row level security;
create policy ai_usage_admin_read on ai_usage for select using (can('analytics'));

create or replace function ai_quota_take(p_task text default 'design') returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); hourly int; daily int; staff boolean := is_staff();
  max_hour int := (case when staff then 60 else 12 end); max_day int := (case when staff then 300 else 40 end);
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'Sign-in required.'); end if;
  if not coalesce((select enabled from feature_flags where key = 'AI_DESIGN'), false) then
    return jsonb_build_object('ok', false, 'reason', 'The design assistant is switched off at the moment.');
  end if;
  delete from ai_usage where at < now() - interval '2 days';
  select count(*) filter (where at > now() - interval '1 hour'), count(*) into hourly, daily from ai_usage where user_id = uid and at > now() - interval '1 day';
  if hourly >= max_hour or daily >= max_day then
    return jsonb_build_object('ok', false, 'reason', 'You have reached the assistant''s usage limit for now. Please try again later.');
  end if;
  insert into ai_usage(user_id, task) values (uid, left(coalesce(p_task, 'design'), 20));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function ai_quota_take(text) from public, anon;
grant execute on function ai_quota_take(text) to authenticated;

-- Jarvis (conversational expert assistant) shares the AI usage table but a chat
-- needs more turns than one-shot layout suggestions, so limits are per task:
--   design  12 / hour, 40 / day   (staff 60 / 300)   — unchanged
--   jarvis  30 / hour, 120 / day  (staff 120 / 600)
create or replace function ai_quota_take(p_task text default 'design') returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); hourly int; daily int; staff boolean := is_staff();
  v_task text := left(coalesce(p_task, 'design'), 20);
  max_hour int; max_day int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'Sign-in required.'); end if;
  if not coalesce((select enabled from feature_flags where key = 'AI_DESIGN'), false) then
    return jsonb_build_object('ok', false, 'reason', 'The assistant is switched off at the moment.');
  end if;
  if v_task = 'jarvis' then
    max_hour := case when staff then 120 else 30 end; max_day := case when staff then 600 else 120 end;
  else
    max_hour := case when staff then 60 else 12 end; max_day := case when staff then 300 else 40 end;
  end if;
  delete from ai_usage where at < now() - interval '2 days';
  select count(*) filter (where at > now() - interval '1 hour'), count(*) into hourly, daily
    from ai_usage where user_id = uid and task = v_task and at > now() - interval '1 day';
  if hourly >= max_hour or daily >= max_day then
    return jsonb_build_object('ok', false, 'reason', 'You have reached the assistant''s usage limit for now. Please try again later.');
  end if;
  insert into ai_usage(user_id, task) values (uid, v_task);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function ai_quota_take(text) from public, anon;
grant execute on function ai_quota_take(text) to authenticated;

-- Two analytics events for Jarvis (the browser's allowlist mirrors this in src/lib/backend/analytics.ts).
alter table analytics_events drop constraint if exists analytics_events_name_check;
alter table analytics_events add constraint analytics_events_name_check check (name in (
  'page_view','product_view','customizer_started','design_created','design_saved','mockup_downloaded',
  'artwork_uploaded','quote_started','quote_requested','project_builder_started','project_builder_completed',
  'billboard_viewed','billboard_booking_started','billboard_booking_requested','consultation_requested',
  'contact_submitted','whatsapp_click','ai_assist_used','jarvis_used','jarvis_action','qr_landing','bundle_viewed','reorder_requested'));

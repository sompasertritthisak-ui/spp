-- ═══════════════════════════════════════════════════════════════════════════
-- SPP PLATFORM · 0020 · Google Sheets backup log
-- The `sheets-backup` Edge Function mirrors every lead, quote, order, booking
-- and consultation into a Google Sheet owned by SPP (a running, human-readable
-- backup). It keeps one watermark per entity here so each run only touches
-- rows changed since the last one.
--   · written ONLY by the function (service role bypasses RLS) — no policy
--     grants insert/update/delete to anyone else
--   · readable by staff so Command Center → Settings → Backups can show
--     "last synced" honestly; customers and anon see nothing
-- Re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists backup_sync (
  entity text primary key check (entity ~ '^[a-z_]{1,40}$'),
  last_synced_at timestamptz not null default 'epoch',
  last_run_at timestamptz,
  rows_synced int not null default 0 check (rows_synced >= 0),
  last_error text,
  updated_at timestamptz not null default now()
);
alter table backup_sync enable row level security;
drop policy if exists backup_sync_staff_read on backup_sync;
create policy backup_sync_staff_read on backup_sync for select using (is_staff());
drop trigger if exists backup_sync_touch on backup_sync;
create trigger backup_sync_touch before update on backup_sync for each row execute function touch_updated_at();

insert into backup_sync(entity) values ('leads'), ('quotes'), ('quote_items'), ('orders'), ('order_items'), ('billboard_bookings'), ('consultations')
on conflict (entity) do nothing;

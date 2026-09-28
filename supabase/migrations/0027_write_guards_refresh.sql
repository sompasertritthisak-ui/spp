-- 0027 · Write guards, refreshed after 0025 and 0026.
-- The guards built in 0024 are a snapshot of the policies and staff RPCs that
-- existed at that point. Migrations numbered after it (the landing-page editor,
-- the publish queue) add their own; this brings the guards up to date.
-- Any later migration that adds a policy or a staff RPC ends with the same line.
select refresh_write_guards();

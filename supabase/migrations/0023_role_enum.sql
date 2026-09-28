-- 0023 · Custom roles, step 1 of 2.
-- People on a role created by the super admin carry the enum value 'staff';
-- what they may do comes from roles / role_capabilities (0024). A new enum value
-- cannot be used in the transaction that adds it, so it has a migration to itself.
alter type app_role add value if not exists 'staff';

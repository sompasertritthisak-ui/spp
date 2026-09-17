# Backups & Disaster Recovery

**Responsible administrator:** _name here_ · **Deputy:** _name here_ · Review this page every 6 months.

## What must survive
| Asset | Where it lives | Backup |
|---|---|---|
| Source code, content seed, migrations, workflows | GitHub repository | Git itself + every developer clone. Tag releases. |
| Database (customers, designs, leads, quotes, orders, CMS) | Supabase Postgres | **A** Supabase daily backups (Pro: 7 days, PITR optional) · **B** `backup.yml`: nightly encrypted `pg_dump`, 30-day retention as a private Actions artifact |
| Uploaded artwork + media | Supabase Storage | Monthly `supabase storage cp -r` of `private-artwork`, `design-previews`, `public-media` to an encrypted external drive. Pro-plan backups do **not** include storage objects. |
| Secrets | Supabase function secrets, GitHub secrets | Recorded **only** in the company password manager |
| Domain / DNS | Registrar | Auto-renew on; registrar login in the password manager with 2FA |

Targets for a business this size: **RPO 24 h** (lose at most a day), **RTO 4 h**.

## Enable the nightly backup
GitHub → Settings → Secrets and variables → Actions:
`BACKUPS_ENABLED=true` (variable), `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` (secrets).
Losing the passphrase makes every backup unreadable — it lives in the password manager.

## Restore procedure
1. Actions → *Database backup* → latest successful run → download `spp-db-backup`.
2. Decrypt: `gpg --decrypt spp-<stamp>.dump.gpg > spp.dump`
3. Create a **new** Supabase project (never restore over a live one), then
   `pg_restore --no-owner --no-privileges --clean --if-exists -d "<new connection string>" spp.dump`
4. Run `npm run db:test` locally against the migrations to confirm the schema version matches; apply any newer migrations with `supabase db push`.
5. Re-deploy the Edge Functions and secrets (`docs/DEPLOY.md` §4), restore storage objects, update the two `NEXT_PUBLIC_SUPABASE_*` variables in GitHub, run the deploy workflow.
6. Log in as a super admin; check a recent quote, a design thumbnail, and the audit log.

**Restore test:** do steps 1–4 into a scratch project every quarter and record the date here: `last tested: ____`.

## Incident scenarios
| Scenario | Action |
|---|---|
| Site down, GitHub healthy | Actions → re-run *Deploy to GitHub Pages*. The previous build stays live until a new one succeeds. |
| Bad content published | Fix in the CMS → **Publish site**. Or GitHub → revert the commit → redeploy. |
| Supabase outage | The public site, catalogue, Studio (local mode) and billboard map keep working — they are static. Forms show the WhatsApp/email fallback. Check status.supabase.com. |
| Supabase project paused (free tier) | Dashboard → Restore. Confirm the `scheduled.yml` workflow is enabled; move to Pro. |
| Leaked token / key | Revoke it at the issuer first, then rotate: `supabase secrets set …`; GitHub PAT → regenerate; anon key → Supabase API settings → update the GitHub variable → redeploy. Review `audit_log`. |
| Compromised staff account | Command Center → Team & roles → set role to `customer`; Supabase Auth → sign out user / reset password; review `audit_log` filtered by that actor. |
| Accidental deletion | Row-level: recover values from `audit_log.before`. Bulk: restore the backup into a scratch project and copy the rows across. |

## Monitoring (all free)
- GitHub emails on any failed workflow (deploy, backup, email queue) — keep notifications on for the repo owner.
- An external uptime monitor (e.g. UptimeRobot) on the home page and on `https://<ref>.supabase.co/rest/v1/`.
- Supabase → Reports for API errors and database load; Logs → Edge Functions for assistant/publish errors.
- Command Center → Settings → Email outbox: anything stuck in `failed`.

# Deploying SPP — GitHub Pages + Supabase

No Vercel anywhere. The public site is a **static export on GitHub Pages**; the
back-end is a **Supabase** project. GitHub hosts the code, CI, releases, the
live site and the scheduled jobs.

```
 Browser ──► GitHub Pages (static HTML/JS, built by GitHub Actions)
    │
    └─────► Supabase  ── Postgres + Row-Level Security   (all data + permissions)
                      ── Auth                            (customers, staff, Studio guests)
                      ── Storage                         (private artwork, public media)
                      ── Edge Functions                  (AI assistant · publish · email)
 CMS "Publish site" ─► Edge Function ─► GitHub repository_dispatch ─► rebuild Pages (~2–3 min)
```

> **Why it was built this way.** Tested from the project network on 2026-09-17:
> `*.vercel.app`, `*.pages.dev`, `*.web.app` and `*.onrender.com` all time out
> (ISP-level block). `*.github.io`, `api.github.com`, Google APIs and
> `supabase.com` respond normally.

---

## 0 · Do this first: the 2-minute reachability test

The one thing that could not be tested in advance is whether **your own**
`<project>.supabase.co` address is reachable from Lao ISPs.

1. Create the Supabase project (step 2 below).
2. From the SPP office network **and** from a phone on mobile data (Unitel / LTC / ETL), open
   `https://<your-project-ref>.supabase.co/rest/v1/` — a short JSON error such as
   `{"message":"No API key found…"}` means **reachable**. A timeout means blocked.
3. If it is blocked: stop, and tell your developer. All back-end calls are isolated
   in `src/lib/backend/`, so the provider can be swapped (Firebase on Google
   infrastructure was confirmed reachable) without touching the rest of the site.
   A paid Supabase **custom domain** (`api.spp.la`) is the other fix.

---

## 1 · Put the code on GitHub

```bash
cd /Users/top/SPP
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Keep the repository **private** if you like — GitHub Pages works from private
repos on paid plans; on the free plan the repo must be public. Nothing secret is
in the repository either way (`npm run build && node scripts/check-bundle.mjs`
enforces that on every deploy).

## 2 · Create the Supabase project

1. <https://supabase.com> → New project. Region: **Singapore (ap-southeast-1)** — closest to Laos. Save the database password in a password manager.
2. **Authentication → Sign In / Providers**
   - Email: enabled, **Confirm email: ON**.
   - **Anonymous sign-ins: ON** (lets a visitor save a Studio design and upload artwork before creating an account; the account later inherits the work).
3. **Authentication → URL configuration** — Site URL = your live URL; add it (and `http://localhost:3000`) to *Redirect URLs*.
4. **Authentication → Attack protection** — enable CAPTCHA (Turnstile/hCaptcha) for anonymous sign-ins once you are live. Rate limits: leave defaults.

## 3 · Create the database

Install the CLI (`brew install supabase/tap/supabase`, or use `npx supabase`), then:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push                       # applies supabase/migrations/*.sql in order
npx supabase db execute -f supabase/seed.sql   # loads the starter content (idempotent)
```

No CLI? Open **SQL Editor** and run each file in `supabase/migrations/` in
numeric order, then `supabase/seed.sql`.

### Make yourself the first super admin
Register on the site (`/register/`), confirm your email, then run once in the SQL editor:

```sql
select set_config('spp.privileged', 'on', false);
update profiles set role = 'super_admin' where email = 'you@example.com';
```

After that, manage every other role from **Command Center → Settings → Team & roles**.
(Roles can only be changed through the database's own guarded function — never from the browser.)

## 4 · Deploy the Edge Functions

```bash
npx supabase functions deploy ai-assistant
npx supabase functions deploy publish
npx supabase functions deploy send-email --no-verify-jwt

npx supabase secrets set \
  SITE_ORIGINS="https://<you>.github.io,https://www.spp.la" \
  SITE_URL="https://www.spp.la" \
  GITHUB_REPO="<you>/<repo>" \
  CRON_SECRET="$(openssl rand -hex 32)"
```

Then add the secret keys **yourself** (never paste them into chat, code or the repo):

| Secret | What it is | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | SPP AI Design Assistant | console.anthropic.com → API keys. Set a monthly spend limit there. |
| `ANTHROPIC_MODEL` *(optional)* | Defaults to `claude-opus-5`. `claude-sonnet-5` or `claude-haiku-4-5` cost less. | your choice |
| `GITHUB_DISPATCH_TOKEN` | Lets "Publish site" trigger a rebuild | GitHub → Settings → Developer settings → **Fine-grained token**, *only this repository*, permission **Contents: Read and write**. Set an expiry and a calendar reminder. |
| `RESEND_API_KEY`, `EMAIL_FROM` *(optional)* | Transactional email | resend.com, after verifying your domain. Without it, emails wait safely in *Settings → Email outbox*. |

Until `ANTHROPIC_API_KEY` is set the assistant panel says it has not been set up — nothing is faked.

## 5 · Configure GitHub

**Settings → Pages** → Source: **GitHub Actions**.

**Settings → Secrets and variables → Actions**

| Kind | Name | Value |
|---|---|---|
| Variable | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| Variable | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon / publishable** key (safe in browsers — RLS is the gate). **Never the service-role key.** |
| Variable | `SITE_URL` | only with a custom domain, e.g. `https://www.spp.la` |
| Variable | `BACKUPS_ENABLED` | `true` to switch on nightly backups |
| Secret | `CRON_SECRET` | same value you set in step 4 |
| Secret | `SUPABASE_DB_URL` | *Project settings → Database → Connection string (URI, session pooler)* |
| Secret | `BACKUP_PASSPHRASE` | a long passphrase, stored in your password manager |

Push to `main` (or run **Actions → Deploy to GitHub Pages → Run workflow**). The site goes live at
`https://<you>.github.io/<repo>/`.

### Custom domain (recommended)
A real domain (`www.spp.la`) looks professional **and** is far less likely to be
caught by subdomain blocklists. Pages → Custom domain → follow the DNS
instructions → tick *Enforce HTTPS* → set the `SITE_URL` variable → redeploy.

## 6 · First-day checklist in the Command Center

- **Settings → Company & contact**: the brochure details are pre-filled (Nakham Village address, office 021 550226, mobile +856 20 5551 8882, spp_sole@yahoo.com). Confirm three things: (1) **WhatsApp** is assumed to be on the mobile number — clear it if not; (2) the **Facebook** link currently opens a search for the page name "ບໍລິສັດ SPP ການພິມແລະສື່ໂຄສະນາ" — replace it with the page's real URL; (3) the **map pin** is the centre of Nakham Village — move the coordinates to the gate. Add Instagram / TikTok / LINE if SPP has them.
- **Logo**: the site draws SPP's roundel as vector (redrawn from the brochure). If SPP has the original artwork file, drop `spp-logo.svg`/`.png` into `public/brand/` and point *Settings → logo* at it, or upload it in the media library — nothing else changes.
- **Billboards**: confirm each location on site and tick *Verified*. Coordinates and guide prices were carried over from the previous website and are unconfirmed.
- **Pricing**: review every rule. Starter figures were derived from the old site's public price ranges.
- **CMS → Portfolio**: replace the three *Sample project* case studies with real work.
- **CMS → Testimonials**: add real ones (publishing requires the *consent recorded* tick).
- Press **Publish site**.
- The previous website shipped the owner password `spp2024` in public JavaScript. If that password is used anywhere else, change it.

## 7 · Local development

```bash
cp .env.example .env.local     # add the two NEXT_PUBLIC_SUPABASE_* values (optional)
npm install
npm run dev                    # http://localhost:3000
npm run audit                  # typecheck + lint + unit tests + database security audit
npm run build && npm run preview   # production static export, served locally
```

With no `.env.local` the site still runs from the seed content; forms explain
that online requests are not switched on and offer WhatsApp / email instead.

## 8 · Costs

| Item | Cost |
|---|---|
| GitHub (repo, Actions, Pages) | Free for public repos; Actions minutes are ample for this workload |
| Supabase | Free tier to start. **Free projects pause after 7 days with no API traffic** — the 10-minute scheduled job prevents that. Plan on **Pro ($25/mo)** for a live business: daily backups with point-in-time recovery, no pausing, more storage. |
| Claude API | Pay per use. Each assistant request is one short call; hard per-user limits are enforced in the database (12/hour, 40/day). |
| Domain | ~$15–60 / year |

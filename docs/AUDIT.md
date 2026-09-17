# SPP Platform — Running System Audit

A living log. Every module is exercised when it is built, and the result — pass
or fail — is written here. Re-run everything with `npm run audit`.

## 2026-09-17 · Environment & hosting

| Check | Result |
|---|---|
| Hosting reachability from the project network (Laos ISP) | `*.github.io` ✅ · `api.github.com` ✅ · Google APIs ✅ · `*.netlify.app` ✅ · **`*.vercel.app` ❌ · `*.pages.dev` ❌ · `*.web.app` ❌ · `*.onrender.com` ❌** (TCP timeout — ISP-level block) |
| Decision | Static site on **GitHub Pages**; back-end on **Supabase**. No Vercel dependency anywhere. |
| ⚠ Open risk | `<project>.supabase.co` could not be tested until a project exists. All back-end calls go through `src/lib/backend/` so the provider can be swapped. **Test from SPP's network on day one.** |
| `npm audit` | First install: 6 vulns (1 critical `tar`, high XSS in `fabric@6` SVG export). Fixed by moving to `fabric@7`, `vitest@5`. **Now 0 vulnerabilities.** |

## 2026-09-17 · Previous site review (`_previous/spp-sole-website.zip`)

| Finding | Severity | Status |
|---|---|---|
| "CMS" wrote to the visitor's own `localStorage` — edits never reached other visitors | Critical (non-functional) | Replaced by Postgres-backed CMS |
| Owner password `spp2024` shipped in public `js/data.js` | Critical (security) | Replaced by Supabase Auth + RLS; **SPP should treat that password as burned** |
| No backend: quote/contact forms went nowhere | High | Replaced by validated RPCs |
| Customizer: front only, no watermark, no Design ID | Medium | Rebuilt as SPP Studio |
| Billboard tenant names (real brands) shown publicly, unconfirmed | Medium | Not carried over |
| Placeholder phone number `+856 20 XXXX XXXX` | Low | Left empty; UI hides phone/WhatsApp until SPP sets them |
| **Kept:** product list + LAK ranges, 20 billboard coordinates, company facts, garment outline geometry | — | Migrated into `src/content/seed` |

## 2026-09-17 · Database (`npm run db:test`) — 60 / 60 pass

Boots a real PostgreSQL 17, applies all migrations + seed, then connects the way
PostgREST does (as `anon` / `authenticated` with JWT claims) and attacks it.

**Found and fixed during this audit**
1. `0004_rpc.sql` contained raw control bytes from a regex escape → migration refused to load. Rewritten with hex escapes.
2. `next_ref(kind)` / `rate_limit(bucket)` parameter names collided with column names → every submission failed. Renamed.
3. **Security:** designers could `select` from `orders` and read order totals (spec §68 forbids it). Replaced the policy with money-free `production_orders` / `production_order_items` views; test added.

**Verified**
- RLS enabled on every table; every `SECURITY DEFINER` function pins `search_path`; internal helpers not callable by clients.
- Public sees only published content; **pricing rules unreadable** by anon, customers, designers. Estimates return a ±8 % band with no rule internals. `ONLINE_PRICING` flag hides all figures.
- **IDOR:** Bob cannot read/update/delete Alice's design, attach it to his quote, respond to her quote, reorder her order, or share her design.
- **Privilege escalation:** customers cannot change their own role (direct or RPC); sales cannot grant roles or flip flags; admins cannot mint admins or demote a super admin; nobody can change their own role.
- Customers cannot self-approve artwork, set prices, or see internal notes / leads / production / QC.
- Server assigns all reference numbers (client-supplied `ref` ignored).
- Full chain traceable: production job → order → quote → lead → design.
- Artwork gate: order cannot enter production until SPP approves the design. Order cannot be created until every line is priced.
- Billboard request **never auto-confirms or blocks dates**; only staff confirmation blocks; double-booking refused; public sees dates, never who booked.
- Audit log captures actor + before/after; admin-only; cannot be deleted.
- Rate limiting stops form flooding; honeypot rejects bots; SQL-injection / XSS payloads stored as inert text.
- Abandoned-activity email stored **only** with recovery consent.
- Testimonials cannot be published without recorded consent (DB constraint).

**Not covered locally:** `0005_storage.sql` (needs Supabase Storage). Verify bucket isolation after deploy — see `docs/DEPLOY.md`.

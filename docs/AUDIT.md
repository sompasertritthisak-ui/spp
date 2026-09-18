# SPP Platform — Running System Audit

**Status at hand-off (2026-09-18):** typecheck 0 errors · lint 0 errors · unit tests 30/30 · database security audit 81/81 · production static export 95 pages · bundle gate clean · `npm audit` 0 vulnerabilities. Everything below the "Not yet verifiable" line still needs the live Supabase project.

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

## 2026-09-17 · Brand palette correction
Client specified SPP's colours: **gold, light blue, deep blue/purple, a bit of white.** The first pass (black + process yellow) was re-themed through the design tokens in one place (`globals.css` + `src/lib/brand.ts`); `warn` moved to orange so it cannot be confused with brand gold. Brand guidelines page, logo SVG downloads, OG image, emails and exports regenerated. Contrast re-checked: all text tokens ≥ 4.5:1 on the indigo grounds; gold-on-white and sky-on-white are documented as **failing** pairs in the brand guidelines.

## 2026-09-17 · Front-end, build and release gates

| Check | Result |
|---|---|
| `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) | **0 errors** |
| `eslint .` incl. React compiler-safety rules | **0 errors, 0 warnings** (14 found in the lead's own files and fixed structurally — see below) |
| Unit tests (`npm test`) | **30 / 30** — design schema rejects hostile layers; every seeded template valid; print areas match physical proportions (±12 %); undo/redo; preflight verdicts; WhatsApp messages; seed integrity + honesty rules |
| Database audit (`npm run db:test`) | **81 / 81** with all migrations (0001–0015) |
| Production build (`next build`, static export, no back-end) | **Pass** — 92 HTML pages, 13 s |
| Release gate (`scripts/check-bundle.mjs`) | **Pass** — no secrets, no blocked hosts, no third-party CDNs in `out/` |
| `npm audit` | **0 vulnerabilities** |

**Found and fixed in this pass**
1. `0015_ai.sql`: an inline `CASE … THEN` inside a PL/pgSQL `IF` terminated the condition early → migration failed. Rewritten; AI-quota checks added (sign-in required, flag respected, 12/hour cap, usage table unreadable by customers).
2. **Portal security gaps found by review and closed in `0014_portal.sql`:** (a) guest sessions could not start (null email into a NOT NULL column); (b) a customer could post a message/attachment against *another* customer's quote id; (c) files SPP shared were invisible to the customer; (d) staff *draft* quotes were readable by the customer. Tests added for each.
3. **Ops gaps closed in `0011_ops.sql`:** staff could not create manual leads/quotes (no access to `next_ref`), could not notify customers, and production staff could not advance order status — now guarded RPCs + triggers, all tested.
4. `vite` missing (peer of vitest, skipped by `legacy-peer-deps`) → unit tests could not start. Installed.
5. `Button` dropped `onClick` on external links → WhatsApp click tracking silently lost. Fixed.
6. React lint: state reset inside effects (command palette, nav, admin shell, visualise dialog), a ref written during render (`useQuery`), and a ref passed as a prop then mutated (3D preview). Restructured — derived state, mount-on-open, local refs — rather than suppressed. Two targeted suppressions remain in WebGL code, each with its reason.
7. Mobile Studio: **Request Quote was pushed off-screen** by the print-area tabs at 375 px. Header is now two rows on phones.
8. Mobile hero: intro text overflowed the viewport (implicit grid column sized to content). Constrained.
9. `DesignThumb` clip-path ids collided when the same garment appeared twice on a page. Now unique per instance.
10. CMS photography (product cover + gallery, portfolio and journal covers) was not mapped into public content, so images chosen in the CMS never reached the site. Mapped in `src/lib/content.ts`; product page shows a real photo over the drawn garment when one exists.
11. A failed content fetch during a deploy would have silently published seed content over live CMS data. In CI the build now fails instead (the previous deployment stays live).

**Verified in the browser (production build, not the dev server)**
- Hero: typing a brand name prints it live on tee, billboard, poster, cup and tote; Enter carries it into the Studio. Desktop 1440 and mobile 375. No console errors.
- Studio: template load via URL, select / drag / snap / rotate handles, inspector, per-side tabs with artwork indicators, undo, continuous preflight chip, mobile bottom tool rail, no horizontal overflow.
- Outdoor Network: markers, clusters, Vientiane district zoom with labels, site detail page, honest "unverified" and "not yet surveyed" states.
- Home narrative sections, paper/indigo alternation, reveal-on-scroll.

> Note: during the build the dev server failed to hydrate pages while six processes were writing files at once. That was dev-mode recompile congestion; the production build hydrates normally. Judge the site with `npm run build && npm run preview`.

## Not yet verifiable — needs the live Supabase project
These are implemented and reasoned against the SQL, but have **never executed against a real back-end** (none exists yet, and this machine has no Docker/Deno):
- [ ] `<project>.supabase.co` reachable from Lao ISPs (**do first** — `docs/DEPLOY.md` §0)
- [ ] Sign-up, email confirmation, guest → account upgrade keeps designs
- [ ] Studio cloud save: private upload → `design_assets` → `SPP-DESIGN-…` ref → reload by `?id=`
- [ ] `0005` / `0013` / `0014` storage policies: customer A cannot fetch customer B's artwork by path
- [ ] Quote → lead → staff pricing → send → customer accept → order → production → QC → delivery, through the UI
- [ ] Billboard booking request with artwork; staff confirm; clash refusal
- [ ] Edge Functions: `ai-assistant` (valid JSON, quota, refusal path), `publish` (dispatch → Pages rebuild), `send-email`
- [ ] CMS edit → Publish site → change visible on Pages
- [ ] Playwright suite (`npm run test:e2e`) — written; runs in GitHub Actions on Chromium, WebKit (Safari) and iPhone emulation. Browsers are not installed on the build machine.
- [ ] Lighthouse on the deployed URL (targets: Perf 90+, A11y 95+, BP 95+, SEO 90+)
- [ ] Real-device pass: iOS Safari + Android Chrome — Studio drag/pinch, map pan/zoom

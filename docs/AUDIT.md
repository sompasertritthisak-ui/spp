# SPP Platform — Running System Audit

**Status at hand-off (2026-09-18):** typecheck 0 errors · lint 0 errors · unit tests 30/30 · database security audit 81/81 · production static export 100 pages · bundle gate clean · `npm audit` 0 vulnerabilities. Everything below the "Not yet verifiable" line still needs the live Supabase project.

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

## 2026-09-18 · Real logo and company details

Source: SPP's own printed product brochure (supplied by SPP as a 595 × 842 px scan; the previous developer's zip contained no image assets at all — its nav logo was an empty placeholder `<img>`).

| Item | Result |
|---|---|
| Logo | The roundel (indigo/sky wave, gold italic "SPP", "SOLE CO., LTD" on the base) **redrawn as vector** — `scripts/build-logo.ts` bakes the letterforms to outlines so it renders identically in React, canvas exports, librsvg (OG image, touch icon) and the three downloadable SVGs. Compared side-by-side with the scan at 10×. |
| Where it appears | Nav, footer, Studio header and loading states, admin and portal shells, auth pages, 404/error, Studio mockup and scene exports (canvas), OG share image, favicon (`app/icon.svg`), Apple touch icon, PWA manifest, brand guidelines page (versions, anatomy, clear space, misuse, mockups), landing-page plate drawings. The invented "constructed wordmark" is gone everywhere, including the brand-guidelines copy. |
| Company details | Legal name (EN + Lao), Nakham Village address, office line, mobile, email and Facebook page name now seeded and shown in the footer, contact page and the landing-page *Get in touch* band. Numbers stored E.164, displayed formatted (`formatPhone`). |
| ⚠ To confirm with SPP | WhatsApp assumed on the brochure mobile number; Facebook link is a search for the printed page name (no URL found online); map pin = Nakham Village centre from OpenStreetMap, not the gate; Lao legal name transcribed from a small scan. All editable in Settings. |
| Honesty test | `tests/lib.test.ts` now asserts the seeded numbers are real Lao E.164 numbers with no placeholder digits, and WhatsApp is either empty or a Lao mobile. |

## 2026-09-18 · First deploy to GitHub

| Check | Result |
|---|---|
| Repository | `https://github.com/sompasertritthisak-ui/spp` (public, `main`). Commit authors set to the owner's GitHub no-reply address before the first push. |
| GitHub Pages | Source = Actions. **Live at `https://sompasertritthisak-ui.github.io/spp/`** — deploy workflow green; assets, `og.png`, deep links and the 404 page all serve under the `/spp/` base path. Built from seed content (no Supabase yet). |
| CI on GitHub Actions | `verify` green (audit, typecheck, lint, unit, db:test 81/81, build, bundle gate). **Playwright: 79 / 79** on Chromium, WebKit and iPhone emulation. |
| Found and fixed | Three assertions in the e2e suite itself (never run locally — no browsers): a straight apostrophe vs the page's typographic one; an unscoped `alert` locator; a substring match on "Download mockup" that also hit the mobile "Visualise and download mockup" launcher. No site defects. |
| Tooling on the build Mac | GitHub CLI 2.101.0 at `~/.local/gh` (checksum-verified release binary); owner signed in with `gh auth login --web` themselves. |

## 2026-09-18 · Supabase project live (`gmntsplhportnppjpxjr`, Singapore, free tier)

| Check | Result |
|---|---|
| Reachability | `https://gmntsplhportnppjpxjr.supabase.co/rest/v1/` answers from the owner's network ✅. **Still to test from SPP's office Wi-Fi and Lao mobile data.** |
| Migrations | All 11 applied with `supabase db push --include-seed` (second `0014` file renamed to `0016_portal_storage.sql` — the CLI needs unique versions; local audit still 81/81). Seed loaded. |
| Published content via anon REST | products 19 · categories 8 · services 4 · solutions 9 · bundles 6 (23 items) · billboards 20 · portfolio 3 · faqs 10 · blog posts 3 · templates 11 · flags 8 · settings 1. Media/testimonials empty by design. |
| RLS as an anonymous visitor | `pricing_rules`, `leads`, `quotes`, `orders`, `profiles`, `audit_log`, `ai_usage` all return **empty** ✅ |
| Storage | Buckets `public-media`, `private-artwork`, `design-previews` created by the migrations ✅ (cross-customer isolation still to test with two real accounts) |
| Edge Functions | `ai-assistant`, `publish` (JWT verified), `send-email` (cron secret) deployed and ACTIVE. Secrets set: `SITE_ORIGINS`, `SITE_URL`, `GITHUB_REPO`, `CRON_SECRET` (same value stored as a GitHub secret). **Owner still to add:** `ANTHROPIC_API_KEY`, `GITHUB_DISPATCH_TOKEN`, optional `RESEND_API_KEY`/`EMAIL_FROM`. |
| GitHub → Pages with the database | Variables `NEXT_PUBLIC_SUPABASE_URL` + anon key set; deploy at `c210129` built from the live database and the shipped bundle embeds the project URL ✅ |
| Auth | Anonymous sign-ins were **disabled** at the time of the probe (`anonymous_provider_disabled`) — Studio guest saves will not work until the owner turns them on in Authentication → Providers. Email confirmation and redirect URLs also to be set in the dashboard. |

## 2026-09-18 · Live back-end verified after the owner enabled auth

Owner set Site URL + redirect URLs (`…github.io/spp/**`, `localhost:3000/**`), Email with confirmation, and anonymous sign-ins. Probes run against the real project with two throw-away guest sessions and the deployed site:

| Flow | Result |
|---|---|
| Anonymous (guest) sign-in | ✅ returns `is_anonymous` users |
| Studio save through the **deployed UI** | ✅ guest signed in transparently, toast "Saved as SPP-DESIGN-2026-00002" (design named *TEST guest save — delete me*) |
| Design ownership (REST) | server assigns `SPP-DESIGN-2026-0000N`; client-set ref → `forbidden: protected design fields`; other guest sees/updates nothing; version bumps only when artwork/colour changes (by design); bogus share token → null; owner can delete |
| `private-artwork` storage | owner upload/download/delete ✅ · other guest → not found · anon token → 400 · public URL → 400 · writing into another user's folder → RLS 403 |
| Price estimate | `estimate_price` answers for anon (T-shirt × 50 → 92,400–108,400 ₭/unit, disclaimer attached) |
| Quote → lead | `submit_quote` as guest → `SPP-QUOTE-2026-00001` + `SPP-LEAD-2026-00001`; owner reads it, other guest cannot; honeypot-filled submission → "Rejected." |
| Customer portal | guest visiting `/account/` is sent to sign-in with the honest "guest designs stay on this device unless you create an account" notice ✅ |
| Console | no errors on Studio, portal, sign-in pages |

**Test data now in the database (delete from Command Center when convenient):** design `SPP-DESIGN-2026-00002`, quote `SPP-QUOTE-2026-00001` / lead `SPP-LEAD-2026-00001` (contact "TEST probe — delete me", test-probe@example.com), plus a few anonymous guest users.

## 2026-09-24 · Colour pass — gold as the second colour

Client feedback: the site read as "way too blue dominated" (landing page, billboards, Start a project, My SPP). Response, site-wide: ink tokens warmed/desaturated (`#08091c` base, mirrored in `src/lib/brand.ts`); page heroes carry a gold top bar, gold halftone and a `glow-brand` gold/sky/violet glow; `Section tone="gold"` (ink text) used for one band per page (Manifesto, billboards "How rental works", services, solutions Campaign Builder, about Principles, Studio "How it works", product estimate, case-study numbers); raised sections gold-ruled; outline buttons gold-framed; eyebrow labels, footer headings, numerals, card rules, hover washes, empty states, portal nav, auth panels and the Outdoor Network map (graticule, provinces, clusters, selected rows, booking progress) in gold. Contrast rule kept: ink on gold, never gold on white; small text on gold is solid ink. Gates after the pass: tsc 0 · eslint 0 · unit 30/30 · build 100 pages · bundle clean. Brand guide colour proportions updated (gold 20 %).

## Not yet verifiable — needs the live Supabase project
These are implemented and reasoned against the SQL, but have **never executed against a real back-end** (none exists yet, and this machine has no Docker/Deno):
- [~] `gmntsplhportnppjpxjr.supabase.co` reachable from the owner's network (2026-09-18); **still to test from the SPP office and Lao mobile data**
- [x] Sign-up + email confirmation + sign-in + super-admin promotion done by the owner (2026-09-19); guest → account upgrade still to try
- [x] Studio cloud save on the deployed site → `SPP-DESIGN-2026-00002` (2026-09-18); reload by `?id=` and image upload still to click through
- [x] `private-artwork` isolation verified live with two guests (2026-09-18); `public-media` / `design-previews` to check when the CMS uploads its first file
- [x] Quote → lead → staff pricing → send → customer accept → convert to order → release → production → QC → delivery: walked through by the owner on the live system (2026-09-19, `SPP-QUOTE-2026-00002`) — reported working
- [ ] Billboard booking request with artwork; staff confirm; clash refusal
- [ ] Edge Functions: `ai-assistant` (valid JSON, quota, refusal path), `publish` (dispatch → Pages rebuild), `send-email`
- [ ] CMS edit → Publish site → change visible on Pages
- [x] Playwright suite — **79 / 79 in GitHub Actions** (Chromium, WebKit, iPhone emulation), 2026-09-18
- [ ] Lighthouse on the deployed URL (targets: Perf 90+, A11y 95+, BP 95+, SEO 90+)
- [ ] Real-device pass: iOS Safari + Android Chrome — Studio drag/pinch, map pan/zoom

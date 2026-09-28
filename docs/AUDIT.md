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

## 2026-09-24 · Studio upgrade — typefaces, colour codes, elements, 3D

Client asks: more text options/fonts, more elements, colour-code entry (RGB/CMYK), and a less cartoonish 3D preview.

| Item | Result |
|---|---|
| Typefaces | 4 → **17**, all self-hosted through next/font at build time (no CDN), `preload: false` so a face is fetched only when a design uses it. Includes **Noto Sans Lao** for Lao-script text. Per-face metadata (`FONT_META`: weights shipped, italic support, generic fallback) drives the Text panel (grouped, searchable, live samples), the inspector (weight slider clamped to what the face ships, italic toggle) and the canvas fallbacks; the AI assistant's schema/prompt know every key. Schema stays backward compatible (old keys unchanged). |
| Colour codes | `ColourEntry` (HEX · RGB · CMYK · native picker) behind the "+" swatch on garment colour and ink colour; all notations round-trip through hex; CMYK labelled as an on-screen approximation. Unit tests: normalisation, hex⇄rgb, cmyk round-trip (33/33). |
| Elements | Library 16 → **99** vector graphics in 10 groups (frames & banners, marks, food & drink, nature, Laos, sport, business, celebration, school, transport), each verified on a rendered contact sheet; Elements panel now searchable. |
| 3D preview | Extruded slab replaced by an **inflated fabric body** (distance-to-edge profile from the same garment outline the editor uses), the whole side baked to one texture (colour, seams, trims, artwork at 1536 px), procedural cotton-weave normal map, `MeshPhysicalMaterial` with sheen, room environment lighting and a painted ground shadow. Found and fixed: front-face winding was reversed (mesh culled, inside of the back shell showed); drei `ContactShadows` leaked its depth override into the main render → replaced with a canvas shadow plane. Verified black / red / white garments with artwork. |

## 2026-09-24 · Jarvis — SPP's production expert (AI)

Client ask: an AI assistant called Jarvis during "Start a project" and mockup design, acting as an expert in SPP's services.

| Item | Result |
|---|---|
| Edge Function `jarvis` | Conversational (up to 16 turns), structured output: reply + suggested actions (`add_line`, `set_needed_by`, `set_design_help`, `open_studio`, `suggest_layout`) + follow-up prompts. Persona covers apparel/print methods, artwork prep, signage, billboards, campaigns; **grounded in the live published catalogue** (products, MOQ, lead times, price hints, print methods, billboards, FAQ, company facts) fetched server-side through RLS and cached as a prompt prefix. Effort medium. No tools, no writes: cannot order, price, approve, book or contact. Deployed and ACTIVE. |
| Quota | `0017_jarvis.sql`: per-task limits — Jarvis 30/hour, 120/day (staff 120/600); layout assistant unchanged at 12/40. DB audit: 82/82 incl. the new cap check. Analytics events `jarvis_used`, `jarvis_action` allowed. |
| Request a quote | Floating "Ask Jarvis" dock; the page stays editable; suggestions appear as gold buttons the customer taps (adds lines with qty/spec, sets the date, ticks design help, opens Studio). Applied buttons turn green. |
| SPP Studio | The AI tool is now **Jarvis** with two tabs: *Ask Jarvis* (chat with product/garment/colour/side context) and *Lay it out* (the existing layout engine); a chat action can hand a brief to the layout tab. |
| Honesty | Panel states "Jarvis suggests; you decide … never orders, books or contacts anyone." Without `ANTHROPIC_API_KEY` the function answers 503 "Jarvis has not been set up yet." and the panel shows it; with no back-end configured the UI says he is not switched on. |
| ⚠ Owner | `ANTHROPIC_API_KEY` is still not set — Jarvis and the layout engine are dark until it is (see docs/DEPLOY.md §4). |

## 2026-09-27 · Client round 2 — tone, hero, logo (lead's part)

| Ask | Done |
|---|---|
| "Make it more light blue, it is too dark now" | Public site and My SPP now run a **light theme**: `.theme-light` remaps the ink/fog/paper tokens (sky-tinted white grounds, navy text, navy inverse bands) so every component keeps its classes; hero and footer are wrapped in `.theme-dark`; Studio and Command Center stay dark tools. Gold text on light grounds deepens to a readable gold-brown; ink-on-gold buttons stay navy. Checked home, services, contact at 1440 px — no console errors. |
| Hero "all SPP, swap between fonts and designs" | Example brand names removed. The word is **SPP** (or what the visitor types) and the print style cycles every 3.4 s through ten treatments (Grotesque, Impact block, Brush script, Tall condensed, Editorial serif, Stencil, Retro script, Comic, Geometric, Lao) on the shirt, billboard, poster, cup and tote; the caption names the current style. Reduced-motion users get a single style. |
| Logo top-left bigger (files pending) | Nav lockup raised to 2.75 / 3.5 rem. The slot for SPP's own file (`settings.logo`) is unchanged, waiting for their artwork. |

## 2026-09-27 · Billboards: yearly terms, no public pricing, kind + material

Client ask: switch the billboard map from monthly to yearly, remove pricing ("let them request, then we quote them afterwards"), add the two structure types (billboard / LED) and the face material (die-cut, plastwood…).

| Item | Result |
|---|---|
| No public price | `guidePrice`, the "Guide" cells, the "Pricing model" row and the admin "Price from" field are gone. `Billboard` type: `priceFromUsdMonth`/`minMonths`/`pricingMode` → `kind`, `material`, `minYears`. Every public surface (map card, list, detail, portal, booking flow, enquiry fallback, WhatsApp/email text) says a **written quotation** follows the request. The billboard price FAQ is reworded (seed + in-place `update faqs` in the migration). |
| Yearly terms | Booking step 1 = start date + term chips (1…5 years from the site minimum); the end date is derived (`termEnd`: anniversary − 1 day) and shown, never typed. `submit_booking` re-created in `0019_billboards.sql`: term ≥ `min_years` whole years, up to ~5 years ahead, lead value `null` (no estimate), success message names the written quotation. |
| Kind + material | `billboards.kind` (`static`/`led`, CHECK), `material` (free text), `min_years` (1–10, CHECK). Old `price_from_usd_month`/`min_months` are **dropped** (public table under RLS must not carry a confidential figure); existing minimum terms migrate as `ceil(months/12)`. Map: "Type" filter chips (`?kind=`), BB/LED badge on the site card, list rows and detail hero; detail spec shows Type, Material ("Confirmed in the quotation" when unknown) and Minimum term in years. Admin editor: Type select, Material select with "Other — type it in", Minimum term in years; sites table shows type/material/min term instead of "From / mo". |
| Seed | All 20 sites: `kind: "static"`, `material: null`, `minYears: 1` — LED sites unknown, left for SPP to set in Command Center. `seed.sql` regenerated; `db-types.ts` regenerated. |
| Verified | `tsc` clean in scope, `eslint` clean, vitest incl. new `tests/period.test.ts` (term maths, minimum, ceiling, clashes), `db-test` incl. new checks: no price-like column on `billboards`, CHECKs refuse `kind='neon'` / `min_years=0`, anon sees kind + min_years, 11-month and one-day-short requests refused with "minimum term", 2-year site refuses a 1-year request, lead `estimated_value_lak` is null. |
| ⚠ Owner | Mark which sites are LED screens and record materials in Command Center → Billboards; old monthly figures are no longer stored anywhere. |

## 2026-09-28 · Client round 2 — integration

Four parallel workstreams (fabric/print rules, billboards, ERP exports + backups, Lao language) were integrated on top of the light theme and verified together.

| Check | Result |
|---|---|
| Gates on the combined tree | tsc 0 · eslint 0 · unit **62/62** · database audit **88/88** (migrations 0018 fabric/handles, 0019 billboards, 0020 backup log) · build **103 pages** · bundle gate clean · `exceljs` reachable only from `/admin/**` chunks |
| Floating WhatsApp button | Bottom-right on every public page and My SPP; `wa.me` link with greeting; hidden when no number is set; rides above the quote page's mobile summary bar; Jarvis dock stacked above it. Translated. |
| Language | EN / ລາວ toggle in header, mobile menu, footer and auth; 560+ keys; choice persists; `<html lang>` and the Lao webfont switch with it. Hero and floating button translated by the lead. **Lao copy needs a native proofread by SPP.** CMS content stays as authored (docs/I18N.md). |
| Studio | Products grouped Cotton / Sports fabric / Bags & caps; cotton tee + polo: left chest and right chest 8 × 8 cm, back 10 × 25 cm, enforced by preflight; sports fabric free-flow (clipped to the garment outline); sizes to 8XL; tote prints the full face and has a handle-colour control; "Ask SPP" WhatsApp / phone buttons. |
| Billboards | Terms in years, no price anywhere public, kind (Billboard / LED screen) and material fields, booking request promises a written quotation. Price columns dropped from the public table. |
| Command Center | Quote and order export to Excel, CSV and print-to-PDF with letterhead; list exports; design mockup + 3D + preflight in quote and order drawers; Reports panel; Backups tab. |
| Live database | 0018–0020 applied with the refreshed seed (live content had not been edited since the first seed, so nothing of SPP's was overwritten). `sheets-backup` deployed; answers 403 without the cron secret and 503 until the Google secrets are set. |
| ⚠ Owner | Google Sheets backup needs a service account + three secrets (docs/DEPLOY.md → Google Sheets backup) and the repo variable `SHEETS_BACKUP_ENABLED=true`. Mark LED sites and materials in Command Center → Billboards. Price the new Sports T-Shirt. Supplier mockups ("Modern") and SPP's logo files still pending. |

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

## 2026-09-27 · ERP exports, design mockups in the Command Center, Google Sheets backup

Client asks: admin CMS to work like an ERP with quotation export to Excel and PDF; everything flowing into Sheets as SPP's backup; design mockups (flat + 3D) visible when opening a quote or order.

| Item | Result |
|---|---|
| Excel export | `exceljs` (MIT, 4.4.0) added and **lazy-loaded** — it is absent from every public-page chunk (`check-bundle` + manual grep of `out/_next`). Quote and order documents: letterhead block from Settings → Company (legal name EN + Lao, address, phone, email), ref/dates/customer/status, line table (product, specification, qty, unit LAK, line total, note, design ref), totals row (flags an overridden total against the sum of lines), terms and disclaimers; frozen header, autofilter, A4 print setup. List exports on Quotes and Orders (all visible rows after tabs/filters/search) with a totals row. |
| CSV | Same `Sheet` model → RFC 4180 with UTF-8 BOM (Lao text opens correctly in Excel); cells starting with `= + - @` are neutralised against formula injection. Unit tests `tests/export.test.ts` (7). |
| PDF | `/admin/quotes/print/?id=` and `/admin/orders/print/?id=` render the document black-on-white with the SPP roundel lockup (`Logo tone="paper"`), letterhead, items, totals, terms and validity; `@media print` isolates the paper from the shell and forces A4; **Download PDF** = `window.print()` → Save as PDF. Both routes are static-export safe (query-string id, Suspense). |
| ERP feel | Quotes: kind + period filters, totals footer (quoted total, count priced, engine band, labelled "not invoiced"). Orders: payment filter, totals footer (order value, not-yet-paid, count paid). Dashboard: **Reports** panel — this week / this month leads, quotes sent, orders created, order value "from quoted totals, not invoiced" (Vientiane calendar). |
| Design mockups | `ops/DesignPreview.tsx`: every used side rendered with `DesignThumb` (signed private-artwork URLs via the existing `DesignArt` loader), a **3D** toggle mounting the Studio `Garment3D` viewer (dynamic import, ssr:false) after `hydrateArt` loads the bitmaps into the Studio registry, plus the latest **preflight verdict** (automated or SPP review) with the advisory line. Shown as a "Design mockups" section in the quote drawer and the order drawer, one card per distinct design/version. RLS caveat: image layers staff cannot fetch render as labelled placeholders with "artwork files are available in the design record" — no policy was weakened. |
| Google Sheets backup | Edge Function `sheets-backup`: cron-secret guarded; service-account JWT signed with WebCrypto RS256 (no SDK); one tab per entity (Leads, Quotes, Quote lines, Orders, Order lines, Billboard requests, Consultations), header row auto-created, **upsert by ref** (column A), 400 rows/entity/run with a per-entity watermark in `backup_sync` (0020: staff-readable, service-role-writable only; db-test proves customers/anon see nothing and admins cannot write). Line items ride on their parent's `updated_at`. Without the three Google secrets → 503 with a clear message. `scheduled.yml`: second cron `*/30`, job guarded by repo variable `SHEETS_BACKUP_ENABLED`. Settings → **Backups** tab shows last-sync per entity, errors, staleness, and how to run it now (Actions → Run workflow) — an in-browser "back up now" would expose the cron secret, so it is deliberately not offered. Docs: DEPLOY.md *Google Sheets backup*, BACKUP-DR.md. |
| ⚠ Not executed live | The Sheets function has not run against Google (no secrets, no Deno here) — the JWT/Sheets calls follow the documented REST shapes and are guarded by per-entity error capture into `backup_sync.last_error`. First live run should be watched in Settings → Backups. |

## 2026-09-27 · Fabric groups, print-size rules, 8XL, full-face tote with handle colour, Ask SPP in Studio

Client asks: separate merchandise by cotton type and fabric; cotton/round-collar shirts print a front logo up to 8 × 8 cm (left or right chest) and a back up to 10 × 25 cm; sports fabric is free-flow (whole garment); sizes to 8XL; tote design covers the full face with customisable handles; Studio buttons to ask SPP.

| Item | Result |
|---|---|
| Fabric | `Product.fabric` (`cotton · sports · canvas · other`) in `products.data` (no migration needed); rules in `src/lib/studio/fabric.ts`. Catalogue groups each category by fabric with the rule under the heading and a Fabric filter (`?fabric=`); product pages show the rule and a "Print sizes" row in cm. Cotton T-Shirt (screen/DTF, cotton only) and new **Sports T-Shirt** (`sports-tee` garment, sublimation, quote-only until SPP prices it). |
| Print areas | Cotton tee & polo: left chest 8 × 8, right chest 8 × 8, back 10 × 25 (w × h), sleeves 9 × 9. Sports tee and sleeveless jersey: front/back `freeFlow` — artwork clipped to the garment outline, no cap. Geometry in `src/lib/garments.ts` (0.75 mm/unit); a chest region has `view: "front"` so both logos render on the front face in Stage ghosting, thumbnails, mockup export, scenes and the 3D bake. Legacy `"front"` artwork on cotton products is moved to `left-chest` on load (`remapSides`), and back when switching to a free-flow product. |
| Preflight | Capped areas: "larger than the 8 × 8 cm maximum for cotton" (attention) when a layer's bounds exceed the area; free-flow areas skip crop/safe-margin warnings, keep resolution checks, and carry an info note. Unit tests cover caps, free-flow, remapping, 8XL, tote coverage (`tests/studio.test.ts`, 22 tests). |
| Tote | Print area is the full face (350 × 360 mm, ≥ 95 % of the drawn width). Straps are a filled path in `DesignDoc.trimColour` (hex, optional; unset = tone of the bag). Handle-colour swatches in the Product panel. Migration **0018**: `designs.trim_colour` + `design_versions.trim_colour`, snapshot trigger and `get_shared_design` updated; persistence falls back to saving without the column until 0018 is pushed. db-test: 88 / 88. |
| Ask SPP | Product panel: "Unsure about fabric or sizes? Ask SPP" — WhatsApp deep link (`kind: "custom"`) and `tel:` link; each hidden when the number is unset. `phone` now passed from `/design` to Studio. |
| ⚠ Follow-ups | 0018 must be applied live (`supabase db push`) — until then handle colour is not stored server-side. Tote handles are not part of the inflated 3D mesh (outside the body outline). `account/designs/shared.tsx` still previews a single side; pass `sides` to `DesignThumb` to show both chest logos. |

## 2026-09-27 · Lao language, no promotions, Ask SPP on designs, SPP PREVIEW watermark

Client asks: a Lao translator ("we are based in Laos"); remove promotions ("we don't really do promotions"); a button on designs so customers can contact SPP when unsure about fabric; SPP watermark on designs in My SPP.

| Item | Result |
|---|---|
| EN / ລາວ | `src/lib/i18n/` — typed dictionaries (`en.ts`, `lo.ts`, **544 keys**; `lo` is `Record<Key,string>` so a missing string fails `tsc`), pure `core.ts`, client `index.tsx` (`LangProvider`, `useT`, `useLang`, `useLiteral`, `<T>`, `<Tx>`). Choice stored in `localStorage["spp.lang"]`, applied after hydration via `useSyncExternalStore` (static HTML stays English → no hydration mismatch); sets `<html lang>` and slots Noto Sans Lao after each Latin face. Switch in the header (desktop), mobile menu, footer and auth screens. How-to and the content TODO list: `docs/I18N.md`. |
| Verified | Headless Chromium against the exported site (`out/` on :4173): switch → `<html lang="lo">`, nav / header CTA / footer headings / Get-in-touch band / CTA band in Lao; quote form legends, labels, submit and validation errors in Lao; login and My SPP notices in Lao; choice survives navigation and reload; back to English restores everything; mobile menu carries the switch; no console errors, no horizontal overflow at 375 px; Noto Sans Lao loaded and present in the computed stack of mono labels. Toggle markup present in the static HTML of `/`, `/request-quote/`, `/login/`, `/account/designs/`, `/solutions/`, `/contact/`, `/consultation/`. Unit tests `tests/i18n.test.ts` (9): key parity, matching placeholders, Lao script, brand kept in Latin, literal mapping. |
| Stays English | CMS / seed content (products, services, solutions, bundles, blog, portfolio, FAQs, billboards, legal pages, SEO metadata) — **never machine-translated**; editorial headlines written inline in pages; home-page sections and hero; Studio; Command Center; messages returned by the database; the shared `FormError` "Attention" label and `Plate` prefix (`src/components/ui`, not edited). Text SPP staff read (offline hand-off summary, notes sent with a quote) is deliberately kept in English. |
| Promotions | Marketing-consent copy no longer promises "offers": quote, contact, consultation, register and profile forms now say "Send me occasional SPP news". `/campaigns/` meta description no longer says "campaigns and offers". A regression test guards the consent strings. "Promotional Products" is a product category (cups, pillows, giveaways) and stays; copy that mentions a *customer's* promotion (pavement signs, counters) stays. No seed content changed, so the seed was not regenerated. |
| ⚠ For SPP to decide | (1) **Bundles** advertise a percentage "bundle saving" (7–12 %, `discountPct` in the seed) on Solutions, product pages and the quote builder — a standing package price rather than a promotion, left in place; say the word and it goes. (2) `/campaigns/` landing pages (created in the Command Center) show an "The offer" line when a campaign has one — that component is in the catalogue folder and was not edited. |
| Ask SPP | My SPP → My Designs: every card has **Ask SPP about this design** (WhatsApp, message pre-written with the design reference and product, in the visitor's language) and **Call SPP** (`tel:`). Numbers come from Settings through the portal context; each channel is hidden when its number is unset, the whole block when both are. `whatsappHref` kind `custom` is used because the `design` kind writes a quotation request, not a question. |
| Watermark | Portal previews are drawn live as SVG (`DesignThumb`), never from the stored PNG, so `DesignPreview` — the single component behind design cards, the overview strip and quote / order lines — now lays a tiled, rotated **SPP PREVIEW · <design ref>** pattern over every preview (`designs/Watermark.tsx`), two-tone so it reads on light and dark garments. The portal has no mockup download of its own; downloads happen in Studio, where `exportMockup` already calls `stampWatermark`. Render-checked: mark present on card and line previews, carries the reference. |
| ⚠ Not covered | The design detail and the shared view (`/design/?id=`, `/design/?share=`) are the Studio itself (`src/components/studio`, not edited) — the live stage there is unmarked; only its exports are stamped. The portal screens behind sign-in could not be exercised end-to-end locally (no back-end configured in this build). |

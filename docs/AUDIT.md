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

## 2026-09-28 · ERP back end — integration and live verification

| Check | Result |
|---|---|
| Gates on the combined tree | tsc 0 · eslint 0 · unit **86/86** · database audit **129/129** · build **104 pages** · bundle gate clean · CI e2e green |
| Live database | 0023 role enum, 0024 roles + write guards, 0025 home row policies, 0026 publish queue, 0027 guard refresh — applied in order, no errors. |
| Live probes (guest customer) | `my_access` returns no capabilities; `roles` unreadable; `save_role` and `assign_role` refused; customer can still create, update and delete their own design (incl. handle colour) and upload/delete their own artwork behind the new write guards; cannot change products or write the `home` settings row; publish function answers 403. |
| Publishing without a token | `publish` always queues a request (`publish_request`), dispatches immediately when `GITHUB_DISPATCH_TOKEN` works, otherwise the scheduled **publish-watch** job (every 10 min) compares `publish_stamp()` with the live `build-stamp.json` and starts the deploy with the workflow's own token. Watcher run verified ("No publish has been requested yet"). Publishing now requires `can_write` on content, catalogue or settings. |
| CMS gaps closed by the lead | Pages manager, Publish button and CMS hub now follow dynamic capabilities (edit vs view); "Home page" added to the Command Center sidebar. |
| Not verified | The Roles, People and Home page screens signed in as the owner on the live site (the lead cannot sign in as SPP). First real publish through the queue. |
| ⚠ Owner | Open Settings → Roles & hierarchy and People once to confirm they load; create the first custom roles (docs/OPERATIONS.md has a recommended ladder); press Publish site once to exercise the queue. |

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

## 2026-09-28 · Bundle savings removed

Client decision: "Bundle saving — remove it." SPP does not run promotions or discounts. Bundles stay as a convenient way to request several products at once; nothing a customer sees mentions a saving, a discount or a percentage, and the system neither applies nor promises one.

| Item | Result |
|---|---|
| Public site | Saving badge and sentences removed from product pages ("Bundles with this product"), Solutions (matching-bundle line, Bundles heading and lede — now "Ready-made, ordered together"), the bundle list, Project Builder ("Suggested bundle" now lists what the bundle also includes, no "to qualify"), Campaign Builder and the quote builder / summary. `BundleLite` no longer carries `discountPct`, so the figure is not in any page payload. |
| Campaign Builder | No longer picks "the bundle with the biggest discount". It names a bundle only when the campaign holds every product in it — the campaign type's own bundle first, else the fullest match — as "Matching bundle · This campaign includes everything in the {name}." |
| Quote request | Customer sees a neutral `Bundle · <name>` badge; staff notes carry `Bundle: <name>` so sales know the request came from a package. No percentage is written to the quote. |
| i18n | Removed `quote.saving`, `quote.bundleNote`, `bundle.saving`, `cb.includeAll`; `cb.includes` reworded; added `quote.bundle`. `en.ts` and `lo.ts` in step. New test in `tests/i18n.test.ts`: no dictionary string (English or Lao) words a saving or discount, and no `{pct}` placeholder remains. |
| Content | Seed bundles `discountPct: 0` (summaries never mentioned a saving); `supabase/seed.sql` regenerated. `Bundle.discountPct` stays in the type because the column exists; nothing public reads it. |
| Database | Migration **0022**: `discount_pct` set to 0 on every bundle, check constraint `bundles_no_discount (discount_pct = 0)`, and any live summary that mentions a saving / discount is reset to the seed text. No SQL function ever applied a bundle discount (`_price` / `estimate_price` price products one by one), so none was re-created. `scripts/db-test.ts` +3 checks: no bundle carries a discount, the database refuses one, summaries and the estimate output carry no discount wording. |
| Command Center | Bundle editor: discount field disabled at 0 with "SPP does not offer bundle discounts."; every save writes 0. Discount column removed from the bundle list. Campaign editor: the "15% off…" placeholder replaced and the hint now says not to promise a saving. |
| Jarvis | Persona line added: SPP does not run promotions or discounts; never promise a saving. |
| Also reworded | CMS campaign block "See the current offer." → "See the current campaign."; the brand-guidelines misuse example no longer reads "50% OFF". |
| Verified | `tsc`, `eslint`, `vitest` (63), `db:test` (93), `npm run build`; `grep -rniE "saving\|discount\|% off" out/ --include=*.html` returns nothing. |
| ⚠ To do live | Apply 0022 (`supabase db push`), redeploy the `jarvis` function, then **Publish site**. Until 0022 is applied the old Command Center build can still store a discount, though no page shows it. |
| ⚠ For SPP to decide | Quantity tiers in Command Center → Pricing still lower the unit price for larger runs (customers see "Volume pricing applied" inside an estimate band). That is volume pricing, not a bundle saving, and was left as it is. Campaigns keep their free-text "Offer" field (shown on `/campaigns/` as "The campaign"); staff should not type a discount into it. |

## 2026-09-28 · Custom roles and hierarchy

Client requirement: "The super admin must be able to create roles and set the role hierarchy for people, because the back end will have a lot of staff using it." Roles were a fixed Postgres enum with a hard-coded `can()`; they are now data the super admin manages. Rules and mechanism: `docs/SECURITY.md` → Roles and capabilities.

| Item | Result |
|---|---|
| Migrations | **0023** adds the enum value `staff` (alone — a new enum value cannot be used in the transaction that adds it). **0024** `roles`, `role_capabilities`, `profiles.role_id`, the helpers (`my_role_id`, `role_rank`, `my_rank`, `cap_level`, `can`, `can_write`, `staff_can_write`, `is_admin`), the RPCs (`list_roles`, `save_role`, `delete_role`, `assign_role`, `set_user_role`, `my_access`), the role/enum sync trigger, the last-super-admin triggers and the write guards. **0027** refreshes the guards after 0025 and 0026. |
| System roles | Seeded from the old map, all at `edit`: super admin 100 · admin 90 · sales 60 · content manager (`marketing`) 60 · designer 50 · production 50. db-test compares `can()` and `can_write()` for 8 kinds of caller × 12 domains against the map in 0001 — identical. The 97 checks that existed before this work pass unchanged. |
| View vs edit | "Accounts (view only)" with `sales: view` reads every quote, quote line and lead; update and delete match 0 rows; insert fails RLS; `staff_create_lead`, `staff_create_quote`, `send_quote`, `convert_quote_to_order`, `set_user_company`, `notify_customer` answer *forbidden*; internal notes and customer messages refused. With `sales: edit` all of those work, and nothing outside sales does. |
| No leakage between domains | `pricing: view` + `sales: edit` cannot change a pricing rule; `designs: view` + `production: edit` cannot change a customer's design. Guards are built per command from write policies only. |
| Rank rules | An admin (90) cannot give a role ranked 90 or 95, cannot give admin / super admin, cannot change a director (95) or another admin. A team lead (70, `team: edit`) can give and remove Sales (60), cannot give or change team lead. A director (95) cannot change an admin — super admin only. `team: view` is not enough. Nobody changes their own role by RPC or by updating `profiles`. |
| Super admin cannot be locked out | The last super admin cannot be demoted (enum or `role_id`) or deleted, even by SQL with the privileged flag. With two super admins one can demote the other; the remaining one is then protected. |
| Role management | Only a super admin saves or deletes roles. `security` is refused by `save_role` and by a check constraint. Keys, names, ranks (1–99), colours, levels and domains validated. System roles editable but not deletable; the super admin role keeps rank 100 and every capability. A role with members cannot be deleted (RPC and foreign key). |
| Customers and guests | Unaffected by the guards: own design insert / update / delete, own preflight, `submit_quote`, own message, anonymous `submit_contact`. Staff keep their own rows too (production staff saving a design of their own). `roles`, `role_capabilities`, `list_roles()` unreadable by customers; `my_access()` and `list_roles()` not executable by anon. |
| SECURITY DEFINER RPCs | **Confirmed, not assumed:** no table has `FORCE ROW LEVEL SECURITY` and every definer function is owned by the table owner, so RPCs write past the guards; the customer-facing RPCs above prove it in practice. Because RLS does not apply inside them, the 16 volatile functions that checked `can()` now check `can_write()` and `notify_customer()` checks `staff_can_write()` (rewritten by `refresh_write_guards()`); the two `STABLE` reports keep `can()`. |
| Guard coverage | 40+ tables, 120+ restrictive policies. `write_guards_pending()` returns nothing after all migrations; db-test fails if it ever returns a row, so a later migration that forgets `select refresh_write_guards();` is caught. |
| Storage | `storage.objects` is guarded by the same function. Tested locally against a stub built from the real policy text of 0005: view-only content cannot upload or delete, `content: edit` can, owners still upload to their own folder. |
| Audit trail | Role creation, deletion, capability changes and every role assignment are in `audit_log`; view-only staff cannot read it. |
| Front end | `useAuth()` exposes `access`, `can`, `canWrite`, `canWriteAny` from `my_access()`; the static capability map is gone (`canDo` remains as a wrapper over the dynamic capabilities). Navigation, ⌘K, dashboard and every screen under `src/app/admin` and `src/components/admin` (outside `cms/`) follow them. View-only screens show a **View only** tag and disabled or hidden controls. Sidebar shows the role's name and colour. Assignee lists show role names and offer anyone whose role may edit production. |
| Settings | **People**: search, filter by role, role chip + rank, change role (only roles below the caller's rank are offered), remove staff access, add a person by email. **Roles & hierarchy**: ladder by rank with member counts, "who can do what" matrix, create / edit drawer (name, key locked after creation, description, colour, rank with move above / below, capability matrix with plain-language notes), duplicate, delete with the reason when disabled, four one-click templates (Accounts, Customer service, Warehouse & delivery, Viewer). Read-only for everyone but the super admin. |
| Verified | `tsc` 0 errors · `eslint .` clean · `vitest` 86/86 · `db:test` 128/128 (24 new checks in the ROLES & HIERARCHY block) · `npm run build`. |
| ⚠ Not verified | The Settings screens were not exercised in a browser against a live back-end (the lead does visual QA). Nothing has been applied to the live database. |
| ⚠ To do live | Apply 0023 → 0027 in order. Then check: `select * from write_guards_pending();` is empty; `select policyname from pg_policies where schemaname = 'storage' and policyname like 'objects_wguard_%';` returns three rows (a warning during the migration means the role could not manage `storage.objects`); `select count(*) from profiles where (role = 'customer') <> (role_id is null);` is 0; the owner is still super admin. |
| ⚠ Follow-up outside this change | The `publish` Edge Function asks `can('content')` / `can('settings')`, which a view-only role now satisfies — it should ask `can_write(…)`. `cms/PublishSite.tsx` and `cms/pages/PagesManager.tsx` still gate on `canDo` (view level), so a view-only content role sees Publish / New page controls that the database then refuses. `cms/publish.ts` tests the enum for admin. |

## 2026-09-28 · Home page editor

Client requirement: "The super admin / content manager must be able to edit content and add new products and things to the main landing page … fully functional without a developer." The landing page is now assembled from one settings row that staff edit in **Command Center → CMS → Home page**. Staff guide: `docs/CMS-HOME.md`.

| Item | Result |
|---|---|
| Data model | One public `settings` row, key `home`, typed `HomeConfig` (`src/content/types.ts`): `announcement`, `hero`, ordered `sections[]` (13 keys), `seo`. Every text is `{ en, lo }` and **empty means "use the site's own wording"**, so the defaults (`src/content/seed/home.ts`) invent nothing. `SiteContent.home` is filled by `src/lib/content.ts` (one request: `settings?key=in.(site,home)`). |
| Reading is defensive | `parseHome()` in `src/lib/home.ts` (zod): a bad field falls back to its default, over-long text is cut to its limit, unknown section keys and duplicates are ignored, a section the stored value does not know is put back in its designed place, links must be a site path or `https://`. A missing or broken row builds the designed page — the build cannot fail on it. `validateHome()` is the strict check the editor runs before saving. |
| Seed | `scripts/build-seed.ts` writes the row with `on conflict (key) do nothing`; `supabase/seed.sql` regenerated (+1 statement). db-test proves a saved row survives a re-seed. |
| Public page | `src/app/(site)/page.tsx` renders the hero, then `home.sections` in order, skipping hidden and empty ones. Every home component takes an optional `copy` (+ `plate`) and falls back to today's text, which now lives in `src/components/home/defaults.ts`. Overrides go through `<Copy>` (`src/components/home/Copy.tsx`): Lao when the visitor reads Lao and Lao was written, else English, else the default. In a headline `*asterisks*` mark the accent word; no HTML is interpreted. |
| Unchanged by default | With the default row the `<main>` markup of `/` is **identical** to the previous build (compared after removing React comment nodes, script payloads and generated ids): same 26 headings, same plate numbers (00–07, 09, 09), same title and description, no announcement bar, no new section. |
| New · Featured products | `src/components/home/FeaturedProducts.tsx`: chosen products in the chosen order (max 12); photo when the product has a cover, otherwise the drawn garment (`ProductVisual`) or the category mockup; category · fabric, minimum order, lead time; "View product" and — only for products with a Studio garment while `MOCKUP_STUDIO` is on — "Design it". A price line appears only when `ONLINE_PRICING` is on and the product has a public "from" hint (`hasPriceHint` / `priceLabel`). Not rendered while nothing is chosen or published. |
| New · Custom blocks | The sections of the CMS page whose slug is `home`, drawn by the existing `CmsSections` renderer (new `embedded` flag: a hero block is an `<h2>` there, with no room reserved for the navigation). That page is excluded from `/p/[slug]` — `/p/home/` does not exist. No page, a draft page or no sections → the slot renders nothing. |
| New · Announcement bar | `src/components/home/AnnouncementBar.tsx`: slim gold or navy bar above the navigation, optional link, translated close button (`aria-label`), closed for the browser session and keyed to the message so a new announcement shows again. `Nav.tsx` was not edited: the bar sits in the page flow and moves the fixed header down by its own visible height (CSS variable + one inline rule), releasing it as the visitor scrolls. An inline script hides an already-closed bar before first paint. |
| Hero | `Hero.tsx` takes `word`, `styles`, `copy`, `primaryCta`, `secondaryCta`. Empty copy keeps the translated i18n default; an empty style list cycles all ten. |
| Plate numbers | Designed page keeps its designed numbers; once a section is hidden, moved or added the plates count up in page order (`plateNumbers()`), so the page never shows Plate 05 before Plate 03. |
| Command Center | Route `/admin/cms/home/` (`?section=` in the query string, inside `<Suspense>`), prominent card at the top of the CMS hub. Left: the page top to bottom — announcement bar, hero, the 13 sections with **Move up / Move down** buttons (no drag needed, keyboard operable), a visibility switch and a status chip (Visible / Hidden / Empty with the reason), SEO. Right: English and ລາວ side by side with character counters, the default as placeholder and "Reset to default"; searchable, reorderable pickers for products, categories, portfolio projects and FAQs (drafts are labelled "not on the site"); hero word, print-style tick list, buttons with a page picker or a full https address; announcement bar with preview; landing-page SEO with search preview. "Custom blocks" opens the page builder on the `home` page and creates it (published, empty) when it does not exist. |
| Saving | Upserts the `home` row; toast "Saved — press Publish site to put it live."; the header carries `PublishSite` (last publish time, "Unpublished changes"), which now also watches the `home` row. Unsaved-changes guard: `beforeunload`, plus a confirmation on any in-app link that would leave the screen. "Preview live page" opens the landing page in a new tab. |
| Capability | Seen with `canDo(role, "content")` like the other CMS screens; editable with `useAuth().canWrite("content")`, so a view-only content role gets a read-only screen instead of a refused save. |
| Database | Migration **0025**: `settings_home_insert` / `settings_home_update` — `key = 'home' and is_public and can('content')`. No other key is opened, no delete policy is added, and the row cannot be made private or renamed. Ends with `refresh_write_guards()` (when 0024 is present) so the restrictive write guards include the new policies. `pages.slug` has no pattern or reserved-word constraint, so `home` needed no change. No table or column changed → `db-types.ts` not regenerated. |
| db-test | +6 checks in one block, "HOME PAGE EDITOR (0025)": seed creates the row and never overwrites it; marketing saves `home` (update and first insert, `updated_at` moves); marketing cannot write `site`, any other key or the publish log, cannot hide, rename or delete `home`; sales / designer / production / customer / anon cannot save it; anon and customers can read it, admins keep full control; marketing can create the CMS page `home`, anon reads its sections only once published, sales cannot add a block. The existing check "anon reads only public settings" now expects `home` and `site`. |
| Tests | `tests/home.test.ts` (23): defaults, non-object input, one bad field repaired without losing the rest, unknown / duplicate / junk sections, order kept and missing sections restored, older shapes filled in, max lengths, trimming, print-style names, picker caps, link rules, unknown fields dropped, `validateHome`, `pickBilingual`, plate numbers. |
| i18n | 9 keys added to `en.ts` / `lo.ts` (`home.announce.*`, `home.featured.*`); `pickBilingual()` added to `core.ts`. |
| Verified | `tsc`, `eslint .`, `vitest` (86), `db:test` (128), `npm run build`. On the exported site (:4173): `/` 200 and identical to before; `/admin/cms/home/` and `/admin/cms/` 200; `/p/home/` 404. With a temporary fixture (removed again): announcement bar above the header on desktop and at 375 px (two lines, no horizontal scroll, mobile menu clear of it), close → gone after reload with no flash; hero word and style subset; reordered and hidden sections with plates renumbered; four featured cards with and without "Design it"; custom blocks between FAQ and Get in touch with the hero block as `<h2>`; Lao visitor sees Lao overrides, the English override where no Lao was written, and Lao labels on the new components; no console errors. The editor's list, pickers, tick list, link picker and validation were driven in the browser with sample data. |
| ⚠ Not exercised | Signing in and saving against a live database: this build has no back-end configured. The write path is the same `settings` upsert the Company tab uses, and its permissions are proven by db-test. |
| ⚠ To do live | Apply 0023 → 0027 in order (`supabase db push`); 0027 refreshes the write guards once more after 0025/0026. Re-running `seed.sql` is optional — without a `home` row the site builds the designed page and the first Save creates the row. Then **Publish site**. |
| ⚠ Still needs a developer | The inner copy of three sections — the five verbs of the position statement, the five "plates" (titles, body, bullet points, drawings) and the three SPP Studio feature rows; the fixed notes that are honesty rules ("A request is not a booking…", "Mockups are a close visual guide…", the sample-project note); the billboard figures (counted from live data by design); the layout and colours of each section; adding a brand-new kind of built-in section or a new custom-block kind. Lao versions of product, category, FAQ and portfolio content remain the TODO in `docs/I18N.md`. |
| Shared files touched | `src/components/site/ConnectBand.tsx` (optional `copy`, `plate`), `src/components/cms/Sections.tsx` (optional `embedded`), `src/app/(site)/p/[slug]/page.tsx` (skips `home`), `src/content/types.ts`, `src/lib/content.ts`, `src/lib/cms-pages.ts`, `src/lib/i18n/*`. `Nav.tsx`, `globals.css`, `src/components/brand/**`, the auth module, `settings/**`, `nav.ts` and the Shell were not edited — so the Home page has no sidebar entry of its own; it is reached from the CMS hub. |

## 2026-09-28 · Studio: more print areas, grouped views, redrawn sleeves

Client feedback: "The cotton T-shirt — make it have more design options, not just the left chest and right chest … more room to design for others as well, and change how the left and right sleeve look, it just looks very weird."

| Item | Result |
|---|---|
| Cotton T-shirt | 7 areas (was 5): **Full front 30 × 40 cm**, Left chest 8 × 8, Right chest 8 × 8, **Full back 30 × 40**, **Upper back 25 × 10**, Left / Right sleeve **10 × 10** (was 9 × 9). Opens on the full front. |
| Polo | Left / right chest 8 × 8 (opens here), **Front panel below the placket 27 × 30**, **Full back 30 × 40**, **Upper back 25 × 10**, sleeves 10 × 10. |
| Sports T-shirt | Front and back free-flow as before, plus **free-flow left and right sleeves**. |
| Cap | Front panel 11 × 5.5 as before, plus **left side and right side 6 × 4 cm** and **back 7 × 3 cm**, each with its own drawing. |
| ⚠ Rule changed | The earlier cotton rule "back max 10 × 25 cm" is replaced by Full back 30 × 40 and Upper back 25 × 10. The 8 × 8 cm chest logo cap is unchanged. **The new maximum sizes are working assumptions (standard A3 platen, standard sleeve and cap hoops) and must be confirmed by SPP production**; each is one constant in `src/content/seed/catalogue.ts` and editable per product in the Command Center. |
| Sleeve view | The skewed quadrilateral is gone. A sleeve is now the shirt seen from the side at the same scale as the front view: the sleeve in front with cuff hem, the torso behind a tone darker (`GarmentSide.backdrop`), neck rib or polo collar, side seam and hem, with a soft shadow lifting the sleeve. Right mirrors left. Drawn identically by the stage (SVG), thumbnails (SVG) and exports (canvas). |
| Studio header | Tabs now switch the **view** (Front · Back · Left sleeve · Right sleeve), so seven areas no longer crowd the bar. A **placement picker** above the garment chooses the area on that view, showing each maximum size and a dot where artwork exists; returning to a view reopens the placement last used. On phones the picker is a slim full-width bar. |
| Helpers | `isProfile()`, `viewsOf()` in `src/lib/garments.ts`; `facesOf()` excludes sleeves and cap sides, so the mockup sheet still shows front + back with profiles as extras underneath. |
| Database | Migration **0028_print_areas.sql**: replaces `data.studio` for the four products; summary, description, customisation list and SEO description change only where they still read exactly as seeded, so Command Center edits are preserved. `supabase/seed.sql` regenerated. |
| Tests | `tests/studio.test.ts` +2 (24): every area a product offers exists on its garment, has the same proportions as its physical size and lies inside the outline; sleeve views have a torso backdrop and mirror each other. E2E Studio flow extended to the placement picker and sleeve view. |
| Verified | `tsc` 0 errors · `eslint .` clean · `vitest` 88/88 · `db:test` 130/130 · `npm run build` · Playwright 54/54 on installed Chrome, desktop and phone (`playwright.local.config.ts`, added so e2e can run locally without downloading browsers). Screenshots reviewed: tee sleeve, polo sleeve, sports sleeve, upper back, cap side and back, mockup sheet. |
| ⚠ Known gaps | The 3D model still shows front and back only; sleeve and cap-side artwork appear on the mockup sheet, not on the 3D mesh. Safari and iPhone WebKit e2e run in CI only. |

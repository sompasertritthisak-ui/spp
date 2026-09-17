# Architecture

## One connected chain
Every module hangs off one traceable commercial chain. Each table keeps a
foreign key to the step before it, so nothing is ever disconnected from the
request that started it.

```
visitor ─ analytics_events / abandoned_activities
   │
 DESIGN (designs → design_versions, design_assets, artwork_preflights)
   │            ▲ SPP Studio            ▲ staff artwork approval
 LEAD  (leads → lead_activities)   ← every quote, booking, consultation, contact creates one
   │
 QUOTE (quotes → quote_items ─ design_id + design_version)
   │   customer accepts · sales prices every line
 ORDER (orders → order_items)           reorder_of ─┐
   │   artwork gate: every designed line approved    │
 PRODUCTION (production_jobs → quality_checks)       │
   │   all jobs pass QC                              │
 DELIVERY (deliveries)  ── completed ── REORDER ─────┘
```
`scripts/db-test.ts` walks this whole chain on every CI run and asserts a
production job can be traced back to its original lead and design.

## Runtime topology
- **Static site** (`next build` → `out/`) on GitHub Pages. No Node server exists at runtime.
- **Public content** is fetched from Postgres at *build time* (`src/lib/content.ts`) and baked into HTML — fast, indexable. With no database it builds from `src/content/seed` (the same data that generates `supabase/seed.sql`).
- **CMS publish** = Edge Function `publish` → GitHub `repository_dispatch` → the deploy workflow rebuilds (~2–3 min). A nightly rebuild picks up scheduled content.
- **Live data** (availability, estimates, portal, admin) is read in the browser through `src/lib/backend/` under Row-Level Security.
- **Writes from the public site** only go through validated, rate-limited `SECURITY DEFINER` RPCs (`submit_quote`, `submit_booking`, …). They create the lead + record atomically, notify staff and queue email.

## Code map
```
src/app/(site)/…        public pages (server components + client islands)
src/app/design/         SPP Studio editor        src/app/account/   customer portal
src/app/admin/          Command Center
src/components/         ui · site · brand · hero (3D) · studio · map · billboards · catalogue · quote · forms · account · admin
src/lib/backend/        THE ONLY place that imports the Supabase SDK (client, api, auth, hooks, analytics, generated db-types)
src/lib/studio/         design schema · reducer store · canvas renderer · export/watermark · scenes · preflight · uploads · persistence · AI client
src/lib/geo/            generated Laos map + projection        src/lib/brand.ts   brand colours for canvas/WebGL
src/content/            content types + seed
supabase/migrations/    schema, RLS, RPCs (numbered)           supabase/functions/  ai-assistant · publish · send-email
scripts/                db-test (security audit) · gen-types · build-seed · build-map · build-og · check-bundle
```

## Key design decisions
| Decision | Why |
|---|---|
| Static export + BaaS instead of a Node server | The developer has no server to run; the client's ISP blocks Vercel and most free app hosts. GitHub Pages was verified reachable. Nothing to patch or keep alive. |
| Authorisation in Postgres (RLS + RPC), not in the app | A static front-end cannot be trusted. Every permission is enforced where the data lives and proven by `npm run db:test`. |
| Custom SVG editor instead of Fabric.js | One renderer for editor, thumbnails and saved designs; small bundle; full control of touch. Removed a dependency with a known XSS advisory and native `canvas` build requirements. |
| Canvas renderer for export / 3D | A canvas can use the page's self-hosted fonts; an `<img>`-rasterised SVG cannot. |
| Bespoke vector map, generated at build time | No tiles, no third-party requests, 41 KB, on-brand. `d3-geo` is build-only. |
| Provider isolation (`src/lib/backend/`) | If `*.supabase.co` proves unreachable in Laos the provider can be swapped without touching features. |
| Feature flags in the database | Major features (`AI_DESIGN`, `MOCKUP_STUDIO`, `BILLBOARD_BOOKING`, `ONLINE_PRICING`, `CUSTOMER_PORTAL`, `PRODUCTION_WORKFLOW`, `PREORDERS`, `PAYMENTS`) can be switched without a deploy. |
| Pricing engine in SQL | Rules never reach the browser. The public only ever receives a ±8 % band from `estimate_price()`. |

## Extension points (designed for, not built)
- **Payments** — `orders.payment_status`, `PAYMENTS` flag. Add a provider via an Edge Function + webhooks; never store card data.
- **Inventory / ERP** — `production_jobs.materials`, `product_variants.sku` are the join points for stock, suppliers and costing tables.
- **Localisation (Lao)** — content lives in the database; add a `locale` column + `Noto Sans Lao` via `next/font`.
- **Calendar / Microsoft 365 / Google Workspace** — consultations carry `confirmed_at`; sync from an Edge Function.
- **AI-generated lifestyle mockups** — `src/lib/studio/scenes.ts` is the seam; scenes today are composed from the real design, not generated.

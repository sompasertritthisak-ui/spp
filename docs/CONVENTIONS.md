# SPP Platform — Build Conventions

Read this fully before writing code. It is the contract that keeps a large
platform coherent. When in doubt, open an existing file and match it.

## 1 · What we are building

A premium creative-production platform for **SPP** (Laos): apparel, print,
signage, billboards. One connected commercial chain:

`DISCOVER → CUSTOMISE/DESIGN → VISUALISE → QUOTE → SPP REVIEW → ORDER → PRODUCE → QC → DELIVER → REORDER`

Every feature must connect to that chain and answer: does it raise conversion,
lead quality, order value, repeat orders — or cut friction / staff workload?

## 2 · Hard architectural constraints (non-negotiable)

- **Static export only** (`output: "export"` → GitHub Pages). There is NO Node
  server at runtime. Therefore:
  - No server actions, no route handlers (`route.ts`), no middleware/proxy, no
    `cookies()`/`headers()`, no `revalidate`, no `next/image` optimisation.
  - Every dynamic route (`[slug]`) MUST export `generateStaticParams()` and
    `export const dynamicParams = false`.
  - Unbounded/user data is addressed by **query string**, not path:
    `/design/?id=…`, `/admin/leads/?id=…`, `/account/orders/?id=…`.
    Reading `useSearchParams()` requires the component to sit inside `<Suspense>`.
  - `trailingSlash: true` — always write internal hrefs with a trailing slash.
  - Static asset URLs must go through `asset()` from `@/lib/env` (GitHub Pages
    base path). `next/link` hrefs do NOT need it.
- **No Vercel anything.** The client's ISP blocks it. No `@vercel/*`, no Vercel
  Blob/KV/Analytics. Also blocked from their network: `*.pages.dev`, `*.web.app`,
  `*.onrender.com`.
- **No third-party runtime CDNs.** No `<script src="https://…">`, no Google Fonts
  `<link>`, no map tiles, no external images. Fonts are self-hosted by
  `next/font` at build time. Everything ships in the bundle.
- **Do not add npm dependencies** without a strong reason. Installed and
  available: `next 16`, `react 19`, `tailwindcss 4`, `@supabase/supabase-js`,
  `zod 4`, `three`, `@react-three/fiber`, `@react-three/drei`, `motion`,
  `lenis`, `fabric 7`, `qrcode`, `dompurify`, `lucide-react`, `clsx`, `d3-geo`
  (dev/build only). If you truly need another, say so in your final report
  instead of installing it.

## 3 · Back-end model

- Back-end = **Supabase** (Postgres + Auth + Storage + Edge Functions), reached
  from the browser with the public anon key.
- **All authorisation lives in Postgres** (RLS + `SECURITY DEFINER` RPCs) —
  see `supabase/migrations/`. The front-end only decides what to *render*.
  Never rely on hiding a button for security.
- The ONLY files that may import `@supabase/supabase-js` are in
  `src/lib/backend/`. Everything else uses:
  - `backend()` / `requireBackend()` — `@/lib/backend/client`
  - `api.*` — typed public RPC wrappers — `@/lib/backend/api`
  - `useAuth()`, `canDo(role, domain)` — `@/lib/backend/auth`
  - `useQuery()`, `useMutation()` — `@/lib/backend/hooks`
  - `track()`, `recordIntent()` — `@/lib/backend/analytics`
  - Row types — `@/lib/backend/db-types` (GENERATED; `LeadsRow`, `QuotesInsert`…)
- The site must **build and render with no back-end configured**
  (`backendConfigured === false`). Public content then comes from the seed.
  Interactive features that need the back-end must show an honest state
  ("Online requests are not switched on yet — contact SPP on …") and, where it
  exists, the WhatsApp/email fallback. **Never fake a success.**
- Public content is read at **build time** via `getContent()` from
  `@/lib/content` (server components only). Do not fetch public content in the
  browser. Types: `@/content/types`.
- Writes from the public site go through RPCs only (`submit_quote`,
  `submit_booking`, `submit_consultation`, `submit_contact`, `estimate_price`,
  `track_event`, `record_intent`, `track_qr_scan`). Staff/customer screens may
  use table access under RLS.
- **Pricing is confidential.** Never read `pricing_rules` on a public page and
  never hard-code a price. Public figures come from `api.estimate()` or the
  `priceFromLak` / `priceFromUsdMonth` hints already in content.
- Need a schema change or new RPC? Add a NEW migration file
  `supabase/migrations/00NN_<your-area>.sql` (numbers 0010+; pick an unused
  one), keep it idempotent-friendly, enable RLS on any new table, pin
  `search_path` on any `SECURITY DEFINER` function, then run `npm run db:test`
  AND add checks for your change to `scripts/db-test.ts`. Never edit
  migrations `0001`–`0005`. After schema changes run
  `npx tsx scripts/gen-types.ts`.

## 4 · Honesty rules (the previous site failed these)

- No placeholder buttons. If it is on screen, it works or is visibly disabled
  with a reason.
- No invented facts: no fake client names, testimonials, statistics, traffic
  counts, awards, phone numbers or addresses. Sample portfolio entries are
  flagged `isSample` and MUST be labelled "Sample project" in the UI.
  Testimonials section renders nothing when the list is empty.
- `settings.phone` / `settings.whatsapp` may be empty → hide that channel.
  Use `whatsappHref()` from `@/lib/whatsapp` (returns `null` when unset).
- Billboard requests are *requests*. Never say "booked" or "confirmed" to a
  customer before staff confirm.
- Automated artwork preflight is **advisory**; always show: "Automated
  preflight checks are advisory. Final production approval is subject to SPP
  review."
- The AI assistant suggests; it never places orders, approves artwork,
  publishes content or takes irreversible actions.
- Never expose stack traces, SQL errors or secrets. Show `BackendError.message`.

## 5 · Design language — "The press room at midnight"

Premium, editorial, futuristic-but-restrained. NOT a SaaS template.

- **Grounds:** ink (`bg-ink-950/900/850/800`), with occasional warm **paper**
  inverse sections (`on-paper` utility / `<Section tone="paper">`).
- **One accent: process yellow** (`yellow`). Use it sparingly and decisively —
  primary CTAs, the active state, one highlighted word. Cyan/magenta appear
  only as tiny print details (`colorbar`). `ultra` (blue) is the focus/link
  colour on paper. No purple, no gradients-as-decoration, no neon glow.
- **Type:** `t-hero`, `t-display`, `t-title`, `t-heading` (Bricolage
  Grotesque, tight, condensed); `t-feel` (Instrument Serif italic) reserved for
  ONE feeling-word inside a headline; `t-label` (JetBrains Mono, uppercase,
  tracked) for every label, eyebrow, meta and button; `t-data` for numbers;
  body is Geist. Body text ≥ 16px on public pages.
- **Shape:** sharp corners everywhere. **No `rounded-*`** except true circles
  (dots, avatars, map markers). 1px rules (`rule-t`, `rule-b`,
  `border-ink-700`). No drop-shadow cards; depth comes from layering, rules and
  tone steps.
- **Print vocabulary as ornament** (utilities in `globals.css`): `crop` (corner
  crop marks), `reg` (registration target ⊕), `halftone`, `grain`, `colorbar`,
  and `<Plate n="03">Label</Plate>` section markers. Use them with restraint —
  one or two per view.
- **Layout:** `shell` for page gutters/max-width. Prefer asymmetric editorial
  grids, big type, generous vertical rhythm (`py-20 lg:py-32`). Avoid the
  "three equal rounded cards" pattern; prefer ruled lists, indexed rows, split
  layouts, oversized numerals.
- **Motion:** things *register* into place — `<Reveal i={n}>` for scroll
  reveals, `[animation:ink-in…]` for headline wipes, 150–300ms
  `ease-[var(--ease-press)]` for hovers. Nothing bounces. Animate only
  `transform`/`opacity`/`clip-path`. `prefers-reduced-motion` is already
  handled globally — do not fight it.
- **Icons:** `lucide-react` (stroke 1.5) or inline SVG. **Never emoji** as UI.
  lucide v1 has no brand icons — draw social marks inline or use text labels.
- **Command Center (admin):** same language, denser. Use the primitives in
  `@/components/admin/ui` (`PageHeader`, `Panel`, `Stat`, `DataTable`,
  `StatusPill`, `Drawer`, `Tabs`, `Meta`, `ErrorNote`, `adminInput`). Dark,
  data-rich, elegant; mono labels, tabular figures. It must not look like a
  generic CRUD table dump: lead with what needs attention.

### Shared components (use these; do not re-invent or edit them)

`@/components/ui/Button` (`Button`, `Arrow`; variants primary|outline|ghost|paper|danger; `href` → link),
`@/components/ui/Field` (`Input`, `Textarea`, `Select`, `Checkbox`, `Honeypot`, `FormError`),
`@/components/ui/Plate` (`Plate`, `Badge`), `@/components/ui/Reveal`,
`@/components/ui/Dialog`, `@/components/ui/EmptyState`, `@/components/ui/Toast` (`useToast()`),
`@/components/site/PageHero` (`PageHero`, `Section`, `SectionHead`), `@/components/site/CtaBand`,
`@/components/brand/Logo` (`Logo`, `LogoPlate`), `@/lib/format`, `@/lib/whatsapp`, `@/lib/garments`.

**Do not modify** anything under `src/components/ui/`, `src/components/site/`,
`src/components/brand/`, `src/lib/backend/`, `src/lib/*.ts`, `src/content/`,
`src/app/globals.css`, `src/app/layout.tsx`, or migrations 0001–0005. If you
need something there changed, work around it locally and tell the lead in your
final report.

## 6 · UX & accessibility bar

- Mobile-first; verify mentally at 375 / 768 / 1024 / 1440. No horizontal
  scroll. Touch targets ≥ 44px (`min-h-11`). `min-h-dvh` not `100vh`.
- Semantic HTML, one `<h1>` per page, sequential headings, `<label>` on every
  input (the Field components do this), `aria-live` for async results,
  visible focus (global), keyboard operable, colour never the only signal.
- Forms: visible labels, inline errors, `type`/`autoComplete`/`inputMode`
  set, disabled+spinner on submit (`<Button loading>`), success state with the
  **reference number**, and a clear "what happens next". Include `<Honeypot>`
  and pass it as `website`.
- Every page ends with a contextual next step (`<CtaBand>` or equivalent).
  Microcopy CTAs: START A PROJECT · DESIGN SOMETHING · OPEN SPP STUDIO ·
  CUSTOMISE THIS · BUILD MY PROJECT · REQUEST A QUOTE · GET AN ESTIMATE ·
  EXPLORE BILLBOARDS · REQUEST THIS LOCATION · LET'S TALK · UPLOAD ARTWORK ·
  VISUALISE IT · SAVE DESIGN · DOWNLOAD MOCKUP · REORDER · VIEW CASE STUDY.
- Loading → skeletons (`skeleton` utility). Empty → `<EmptyState>`. Error →
  friendly message + retry.
- SEO on public pages: `export const metadata` / `generateMetadata` with title,
  description, `alternates.canonical` via `absoluteUrl()`, Open Graph; JSON-LD
  where it fits (Product, Article, FAQPage, BreadcrumbList). British spelling
  (visualise, customise, colour). Write for real search intent; never
  keyword-stuff.

## 7 · Code quality

- TypeScript strict (`noUncheckedIndexedAccess` is ON). No `any`, no
  `@ts-ignore`. Small focused components; extract when a file passes ~300
  lines. `"use client"` only where interactivity requires it — keep pages as
  server components that pass data into client islands.
- Validate user input with zod on the client for UX; the database re-validates.
- No `console.log` left behind. No dead code. No TODO-stubs pretending to work.
- Match the surrounding comment style: brief "why" comments, not "what".

## 8 · How to verify your work

Multiple engineers are working in this repo at once, in different folders.

1. `export PATH="$HOME/.local/node/bin:$PATH"` first — Node lives there.
2. `npx tsc --noEmit 2>&1 | grep -E "<your folder paths>"` — fix every error in
   YOUR files. Errors in other folders belong to someone else; ignore them.
3. `npx eslint <your files>` — clean.
4. A dev server is ALREADY running on `http://localhost:3000`. Do **not** start
   another, do not run `next build`, and do not use browser-automation tools
   (the lead does visual QA). Smoke-test server rendering with
   `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/your/path/`
   and grep the HTML for expected text / error overlays.
5. If you touched SQL: `npm run db:test` must pass.
6. Finish with a short report: files created, what is fully working, anything
   you could not finish, anything you need changed in shared code.

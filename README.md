# SPP — Creative Production Platform

**Design it. Visualise it. Make it real.** The website, design studio, billboard
marketplace, customer portal, CRM and production back-office for SPP Sole Co., Ltd
(Vientiane, Lao PDR).

| Surface | Route | What it does |
|---|---|---|
| Brand site | `/`, `/about`, `/services`, `/portfolio`, `/blog`, `/brand` | 3D hero that prints the visitor's brand name live; brand guidelines with downloadable logos |
| Catalogue & quotes | `/products`, `/solutions`, `/request-quote` | Goal-first discovery, project + campaign builders, bundles, instant estimates, multi-item quote builder |
| **SPP Studio** | `/spp-studio`, `/design` | Front / back / sleeve mockup designer: uploads, text, elements, templates, layers, undo, snapping, artwork preflight, 3D + real-world preview, **watermarked download with Design ID**, AI design assistant |
| **SPP Outdoor Network** | `/billboards`, `/billboards/[code]` | Bespoke vector map of Laos, per-site detail, perspective artwork visualiser (day/night), booking *requests* |
| My SPP | `/account/*` | Brand library, designs, quotes (accept/decline), orders, **reorder**, projects, files |
| **Command Center** | `/admin/*` | Attention dashboard, lead CRM pipeline, quotes, orders, production + QC, billboards, pricing engine, CMS + page builder, media, campaigns + QR tracking, analytics, roles, audit log. `⌘K` palette. |

## Stack
Next.js 16 (static export) · React 19 · TypeScript (strict) · Tailwind 4 ·
React Three Fiber · Supabase (Postgres + RLS, Auth, Storage, Edge Functions) ·
Claude API (assistant) · GitHub Actions + GitHub Pages. **No Vercel** — it is blocked by the client's ISP.

## Quick start
```bash
npm install
npm run dev          # http://localhost:3000 — runs from seed content with no back-end
npm run audit        # typecheck · lint · unit tests · database security audit
npm run build        # static export → ./out
```

## Documentation
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — GitHub Pages + Supabase, step by step
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the pieces fit, data model, extension points
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, RBAC matrix, what is tested
- [`docs/BACKUP-DR.md`](docs/BACKUP-DR.md) — backups, restore, disaster recovery
- [`docs/AUDIT.md`](docs/AUDIT.md) — running audit log: what was tested, what was found, what is open
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — design system + engineering rules
- [`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md) — third-party data licences (map boundaries)

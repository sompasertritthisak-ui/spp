import { BRAND } from "@/lib/brand";
import { DesignThumb } from "@/components/studio/DesignThumb";
import { Button } from "@/components/ui/Button";
import type { GarmentKey } from "@/content/types";
import { formatDate } from "@/lib/format";
import { GARMENTS } from "@/lib/garments";
import { normaliseSides, usedSides } from "@/lib/studio/schema";
import { HEX_RE } from "../../resource/fields";
import { CheckGroupField } from "../../resource/rows";
import { asSeo, SeoField } from "../../resource/seo";
import type { ResourceConfig } from "../../resource/types";
import { DEFAULT_PALETTE, estimateReadMins, ImpactField, MarkdownLiteField, PaletteField, ReadMinsField, RecommendField, StudyField } from "../editors";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export const postsConfig: ResourceConfig<"blog_posts"> = {
  table: "blog_posts", singular: "Post", plural: "Journal posts", cap: "content", statusField: "status", schedulable: true,
  order: [{ column: "updated_at", ascending: false }],
  intro: "Journal articles. Write for a real question a customer in Laos would search for; never keyword-stuff.",
  search: (r) => `${r.title} ${r.slug} ${r.tag}`, titleOf: (r) => r.title,
  columns: [
    { key: "title", header: "Post", cell: (r) => <span className="block max-w-lg"><span className="block text-fog-50">{r.title}</span><span className="t-data block text-xs text-fog-500">/blog/{r.slug}/</span></span> },
    { key: "tag", header: "Tag", hideBelow: "sm", cell: (r) => <span className="t-label text-fog-400">{r.tag}</span> },
    { key: "date", header: "Dated", hideBelow: "md", cell: (r) => <span className="t-data text-fog-400">{formatDate(r.published_at)}</span> },
  ],
  defaults: () => ({ tag: "News", read_mins: 3, seo: {} }),
  beforeSave: (v, ctx) => ({
    ...v,
    read_mins: typeof v.read_mins === "number" ? v.read_mins : estimateReadMins(str(v.body)),
    // the public post date: fixed the first time the post is published
    published_at: v.published_at ?? (v.status === "published" ? v.publish_at ?? new Date().toISOString() : null),
    ...(ctx.isNew ? { author_id: ctx.userId } : {}),
  }),
  groups: [
    { title: "Article", fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 160, wide: true },
      { name: "slug", label: "Slug", type: "slug", from: "title", required: true, prefix: "/blog/" },
      { name: "excerpt", label: "Excerpt", type: "textarea", rows: 3, max: 320, hint: "Shown on the Journal index and used as the default meta description." },
      { name: "tag", label: "Tag", type: "text", required: true, max: 40, hint: "One word or short phrase, e.g. Guides, News, Print." },
      { name: "read_mins", label: "Read time", type: "custom", render: ({ value, onChange, values, disabled }) => <ReadMinsField value={typeof value === "number" ? value : null} onChange={onChange} body={str(values.body)} disabled={disabled} /> },
      { name: "body", label: "Body", type: "custom", check: (v) => (str(v).trim().length < 20 ? "Write the article body (at least a sentence or two)." : null), render: ({ value, onChange, error, disabled }) => <MarkdownLiteField value={str(value)} onChange={onChange} error={error} disabled={disabled} /> },
      { name: "cover_media_id", label: "Cover image", type: "media", category: "journal" },
      { name: "published_at", label: "Date shown on the post", type: "date", withTime: true, hint: "Leave empty: it is set automatically the first time the post is published." },
    ] },
    { title: "SEO", fields: [
      { name: "seo", label: "SEO", type: "custom", render: ({ value, onChange, values, disabled }) => <SeoField value={asSeo(value)} onChange={onChange} disabled={disabled} fallbackTitle={str(values.title)} fallbackDescription={str(values.excerpt)} path={`/blog/${str(values.slug) || "…"}/`} /> },
    ] },
  ],
};

export const portfolioConfig: ResourceConfig<"portfolio_projects"> = {
  table: "portfolio_projects", singular: "Project", plural: "Portfolio projects", cap: "content", statusField: "status", sortField: "sort",
  order: [{ column: "sort" }, { column: "year", ascending: false }],
  intro: <>Portfolio entries and their case studies. Anything that is not a real, client-approved project <strong className="text-fog-200">must keep “Sample project” switched on</strong> — the site then labels it clearly.</>,
  search: (r) => `${r.title} ${r.client} ${r.sector} ${r.slug}`, titleOf: (r) => r.title,
  columns: [
    { key: "title", header: "Project", cell: (r) => <span className="block max-w-md"><span className="block text-fog-50">{r.title}</span><span className="block text-xs text-fog-500">{[r.client, r.sector, r.year].filter(Boolean).join(" · ")}</span></span> },
    { key: "flags", header: "Flags", hideBelow: "sm", cell: (r) => <span className="flex gap-2">{r.is_sample && <span className="t-label text-warn">Sample</span>}{r.featured && <span className="t-label text-yellow">Featured</span>}</span> },
    { key: "study", header: "Chapters", hideBelow: "md", cell: (r) => <span className="t-data text-fog-400">{Array.isArray(r.study) ? r.study.length : 0}/8</span> },
  ],
  defaults: () => ({ year: new Date().getFullYear(), is_sample: false, featured: false, palette: [...DEFAULT_PALETTE], study: [], impact: [], services: [], sort: 0 }),
  groups: [
    { title: "Project", fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 160, wide: true },
      { name: "slug", label: "Slug", type: "slug", from: "title", required: true, prefix: "/portfolio/" },
      { name: "client", label: "Client", type: "text", max: 160, hint: "Only with the client's permission." },
      { name: "sector", label: "Sector", type: "text", max: 80 },
      { name: "year", label: "Year", type: "number", integer: true, min: 1990, max: 2100, required: true },
      { name: "sort", label: "Order", type: "number", integer: true, min: 0 },
      { name: "services", label: "Services delivered", type: "tags", suggestions: ["Design", "Apparel", "Print", "Signage", "Billboard", "Installation", "Packaging"] },
      { name: "summary", label: "Summary", type: "textarea", rows: 3, max: 500 },
      { name: "is_sample", label: "Sample project", type: "toggle", onLabel: "Sample — labelled “Sample project” on the site", offLabel: "Real client project" },
      { name: "featured", label: "Featured", type: "toggle", onLabel: "Featured on the home page", offLabel: "Not featured" },
      { name: "cover_media_id", label: "Cover image", type: "media", category: "portfolio" },
      { name: "palette", label: "Palette", type: "custom", check: (v) => (Array.isArray(v) && v.length === 3 && v.every((c) => typeof c === "string" && HEX_RE.test(c)) ? null : "Give three 6-digit hex colours."), render: ({ value, onChange, error, disabled }) => <PaletteField value={value} onChange={onChange} error={error} disabled={disabled} /> },
    ] },
    { title: "Case study", fields: [
      { name: "study", label: "Chapters", type: "custom", render: ({ value, onChange, disabled }) => <StudyField value={value} onChange={onChange} disabled={disabled} /> },
      { name: "impact", label: "Impact", type: "custom", check: (v) => (Array.isArray(v) && v.some((r: { value?: string; label?: string }) => !r.value?.trim() || !r.label?.trim()) ? "Each figure needs both a value and a label — or remove the row." : null), render: ({ value, onChange, error, disabled }) => <><ImpactField value={value} onChange={onChange} disabled={disabled} />{error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}</> },
    ] },
  ],
};

export const solutionsConfig: ResourceConfig<"solutions"> = {
  table: "solutions", singular: "Solution", plural: "Solutions", cap: "content", statusField: "status", sortField: "sort",
  order: [{ column: "sort" }, { column: "goal" }],
  intro: "Goal-led entry points (“Open a restaurant”, “Launch an event”) that recommend products by group and can point at a bundle.",
  search: (r) => `${r.goal} ${r.slug} ${r.summary}`, titleOf: (r) => r.goal,
  columns: [
    { key: "goal", header: "Goal", cell: (r) => <span><span className="block text-fog-50">{r.goal}</span><span className="t-data block text-xs text-fog-500">/solutions/{r.slug}/</span></span> },
    { key: "groups", header: "Groups", hideBelow: "sm", cell: (r) => <span className="t-data text-fog-400">{Array.isArray(r.recommend) ? r.recommend.length : 0}</span> },
    { key: "bundle", header: "Bundle", hideBelow: "md", cell: (r) => <span className="t-data text-fog-400">{r.bundle_slug ?? "—"}</span> },
  ],
  defaults: () => ({ recommend: [], sort: 0, status: "published" }),
  groups: [
    { title: "Solution", fields: [
      { name: "goal", label: "Goal", type: "text", required: true, max: 120, hint: "What the customer wants to achieve." },
      { name: "sort", label: "Order", type: "number", integer: true, min: 0 },
      { name: "slug", label: "Slug", type: "slug", from: "goal", required: true, prefix: "/solutions/" },
      { name: "prompt", label: "Prompt", type: "text", max: 200, wide: true, hint: "The question shown on the card, e.g. “Opening a restaurant?”" },
      { name: "summary", label: "Summary", type: "textarea", rows: 3, max: 500 },
      { name: "bundle_slug", label: "Suggested bundle", type: "relation", table: "bundles", valueField: "slug", labelField: "name" },
    ] },
    { title: "Recommendations", fields: [
      { name: "recommend", label: "Recommendations", type: "custom", check: (v) => (Array.isArray(v) && v.some((g: { items?: { label?: string }[] }) => g.items?.some((i) => !i.label?.trim())) ? "Every recommended item needs a label — or remove the empty row." : null), render: ({ value, onChange, error, disabled }) => <><RecommendField value={value} onChange={onChange} disabled={disabled} />{error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}</> },
    ] },
  ],
};

const TEMPLATE_CATEGORIES = ["Corporate", "Restaurant", "Sports", "School", "Event", "Promotional", "Streetwear", "Festival", "Campaign", "Minimal", "Premium"];
const GARMENT_OPTIONS = (Object.keys(GARMENTS) as GarmentKey[]).map((k) => ({ value: k, label: GARMENTS[k].name }));

export const templatesConfig: ResourceConfig<"design_templates"> = {
  table: "design_templates", singular: "Template", plural: "Design templates", cap: ["content", "designs"], statusField: "status", sortField: "sort",
  order: [{ column: "sort" }, { column: "name" }],
  intro: "Starting points offered inside SPP Studio. Here you manage the listing (name, category, garments, colour, publish, feature). The artwork itself is drawn in SPP Studio — open a template there to edit it.",
  search: (r) => `${r.name} ${r.slug} ${r.category}`, titleOf: (r) => r.name,
  columns: [
    { key: "thumb", header: "Preview", className: "w-20", cell: (r) => { const sides = normaliseSides(r.sides); const g = (r.garments[0] ?? "tee") as GarmentKey; const side = usedSides(sides)[0] ?? "front"; return <DesignThumb garment={g} side={side} colour={HEX_RE.test(r.suggested_colour) ? r.suggested_colour : BRAND.garmentWhite} layers={sides[side] ?? []} className="h-14 w-14" title={`${r.name} preview`} />; } },
    { key: "name", header: "Template", cell: (r) => <span><span className="block text-fog-50">{r.name}</span><span className="block text-xs text-fog-500">{r.category} · {r.garments.join(", ") || "no garments"}</span></span> },
    { key: "featured", header: "Featured", hideBelow: "sm", cell: (r) => (r.featured ? <span className="t-label text-yellow">Featured</span> : <span className="text-fog-500">—</span>) },
  ],
  defaults: () => ({ category: "Corporate", garments: ["tee"], suggested_colour: BRAND.garmentWhite, featured: false, sort: 0 }),
  aside: (row, values) => {
    const sides = normaliseSides(row?.sides);
    const used = usedSides(sides);
    const garments = (Array.isArray(values.garments) ? values.garments : []) as GarmentKey[];
    const colour = HEX_RE.test(str(values.suggested_colour)) ? str(values.suggested_colour) : BRAND.garmentWhite;
    return (
      <div className="border border-ink-700 bg-ink-950 p-4">
        <div className="flex flex-wrap gap-3">
          {(garments.length ? garments : (["tee"] as GarmentKey[])).flatMap((g) => (used.length ? used : ["front"]).filter((s) => GARMENTS[g]?.sides.some((x) => x.key === s)).map((s) => <DesignThumb key={`${g}-${s}`} garment={g} side={s} colour={colour} layers={sides[s] ?? []} showArea className="h-36 w-32" title={`${GARMENTS[g].name} · ${s}`} />))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {row ? <Button href={`/design/?template=${row.slug}&admin=1`} variant="outline" size="sm">Edit artwork in Studio</Button> : <p className="text-sm text-fog-400">Create the listing first; then open it in SPP Studio to draw the artwork.</p>}
          {row && used.length === 0 && <p className="text-sm text-warn">This template has no artwork yet — do not publish it empty.</p>}
        </div>
      </div>
    );
  },
  groups: [{ title: "Listing", fields: [
    { name: "name", label: "Name", type: "text", required: true, max: 120 },
    { name: "category", label: "Category", type: "select", required: true, options: TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: c })) },
    { name: "slug", label: "Slug", type: "slug", from: "name", required: true },
    { name: "garments", label: "Works on", type: "custom", check: (v) => (Array.isArray(v) && v.length ? null : "Choose at least one garment."), render: ({ value, onChange, error, disabled }) => <CheckGroupField label="Works on" required error={error} disabled={disabled} options={GARMENT_OPTIONS} value={(Array.isArray(value) ? value : []) as GarmentKey[]} onChange={onChange} /> },
    { name: "suggested_colour", label: "Suggested garment colour", type: "colour", required: true },
    { name: "featured", label: "Featured", type: "toggle", onLabel: "Shown first in Studio", offLabel: "Not featured" },
    { name: "sort", label: "Order", type: "number", integer: true, min: 0 },
  ] }],
};

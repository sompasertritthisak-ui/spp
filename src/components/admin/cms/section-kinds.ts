import { z } from "zod";

/**
 * PAGE-SECTION PROPS CONTRACT
 * ───────────────────────────
 * `page_sections.kind` is constrained by the database (0002_content.sql);
 * `page_sections.props` is free jsonb. THIS FILE defines what goes in it. The
 * page builder writes only props that pass `sectionSchemas[kind]`, and the
 * public renderer should parse with the same schema:
 *
 *     const parsed = sectionSchemas[row.kind].safeParse(row.props);
 *     if (!parsed.success) skip the section (never crash the build).
 *
 * Conventions shared by every kind
 *  - Media is referenced by `media.id` (`mediaId` / `mediaIds`), never by URL.
 *    Resolve at build time: media.path → `${SUPABASE_URL}/storage/v1/object/public/public-media/${path}`
 *    and take `alt`, `width`, `height` from the media row.
 *  - Links (`…Href`) are site paths starting with "/" (trailing slash) or https:// URLs.
 *  - `body` strings are markdown-lite (paragraphs, "## " headings, "- " lists) —
 *    render with the Journal's parseBlocks(); there is NO HTML path.
 *  - Data-backed kinds (product_showcase, testimonials, faq, pricing, portfolio,
 *    billboard_map, campaign) carry only selection parameters; the renderer
 *    pulls the rows from getContent(). `pricing` shows the public priceFrom
 *    hints only — never pricing_rules.
 *  - `embed` holds a normalised https iframe `src` from EMBED_PROVIDERS only.
 *    Render as <iframe src loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups">
 *    behind a click-to-load poster (third-party content must not load on page view).
 *  - Sections render in `sort` order; pages live at /p/<slug>/ (suggested).
 */

export const SECTION_KINDS = ["hero", "text", "image", "video", "gallery", "product_showcase", "cta", "testimonials", "faq", "pricing", "portfolio", "billboard_map", "campaign", "embed"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

const href = z.string().trim().max(300).regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Use a site path starting with / or a full https:// address.");
const optHref = z.union([z.literal(""), href]).default("");
const short = (max = 160) => z.string().trim().max(max).default("");
const tone = z.enum(["ink", "paper"]).default("ink");
const uuid = z.string().uuid("Choose a file from the media library.");
const slugs = z.array(z.string().min(1)).max(24).default([]);
export const FAQ_TOPIC_KEYS = ["ordering", "artwork", "billboards", "studio", "delivery"] as const;

/* ── Embeds: allow-listed providers only, stored as a clean iframe src ─────── */
export const EMBED_PROVIDERS = { youtube: "YouTube", vimeo: "Vimeo", google_maps: "Google Maps", facebook_video: "Facebook video" } as const;
export type EmbedProvider = keyof typeof EMBED_PROVIDERS;

/** Accepts a share URL, an embed URL or a pasted <iframe> snippet; returns a normalised embed src, or null when it is not on the allow-list. Raw HTML is never stored. */
export function parseEmbed(input: string): { provider: EmbedProvider; src: string } | null {
  const raw = (/<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(input)?.[1] ?? input).trim().replace(/&amp;/g, "&");
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{6,20}$/.test(s) ? s : null);
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    const v = id(host === "youtu.be" ? u.pathname.slice(1) : u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.searchParams.get("v"));
    return v ? { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${v}` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const v = /(\d{6,12})/.exec(u.pathname)?.[1];
    return v ? { provider: "vimeo", src: `https://player.vimeo.com/video/${v}` } : null;
  }
  if (host === "google.com" && u.pathname === "/maps/embed" && u.searchParams.get("pb")) return { provider: "google_maps", src: `https://www.google.com/maps/embed?pb=${encodeURIComponent(u.searchParams.get("pb")!)}` };
  if (host === "facebook.com" && u.pathname === "/plugins/video.php") {
    const target = u.searchParams.get("href");
    try { if (target && /(^|\.)facebook\.com$/.test(new URL(target).hostname)) return { provider: "facebook_video", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(target)}&show_text=false` }; } catch { /* fall through */ }
  }
  return null;
}

export const sectionSchemas = {
  hero: z.object({ eyebrow: short(60), title: z.string().trim().min(1, "A hero needs a title.").max(120), feelWord: short(30), lede: short(400), mediaId: uuid.nullable().default(null), ctaLabel: short(40), ctaHref: optHref, secondaryLabel: short(40), secondaryHref: optHref, tone }),
  text: z.object({ heading: short(), body: z.string().trim().min(1, "Write some text.").max(12000), width: z.enum(["narrow", "wide"]).default("narrow"), tone }),
  image: z.object({ mediaId: uuid, caption: short(240), layout: z.enum(["contained", "full"]).default("contained") }),
  video: z.object({ mediaId: uuid, posterMediaId: uuid.nullable().default(null), caption: short(240), muted: z.boolean().default(true) }),
  gallery: z.object({ heading: short(), mediaIds: z.array(uuid).min(2, "A gallery needs at least two images.").max(24), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3) }),
  product_showcase: z.object({ heading: short(), lede: short(400), mode: z.enum(["selected", "featured"]).default("selected"), productSlugs: slugs, limit: z.number().int().min(1).max(12).default(6) }).refine((p) => p.mode === "featured" || p.productSlugs.length > 0, { path: ["productSlugs"], message: "Choose at least one product, or switch to “Featured products”." }),
  cta: z.object({ title: z.string().trim().min(1, "A call to action needs a title.").max(120), body: short(400), ctaLabel: z.string().trim().min(1, "Give the button a label.").max(40), ctaHref: href, secondaryLabel: short(40), secondaryHref: optHref, tone }),
  testimonials: z.object({ heading: short(), limit: z.number().int().min(1).max(12).default(3) }),
  faq: z.object({ heading: short(), topics: z.array(z.enum(FAQ_TOPIC_KEYS)).default([]), limit: z.number().int().min(1).max(30).default(8) }),
  pricing: z.object({ heading: short(), lede: short(400), productSlugs: slugs.refine((s) => s.length > 0, "Choose the products whose “from” prices to show.") }),
  portfolio: z.object({ heading: short(), mode: z.enum(["featured", "selected"]).default("featured"), slugs, limit: z.number().int().min(1).max(12).default(3) }).refine((p) => p.mode === "featured" || p.slugs.length > 0, { path: ["slugs"], message: "Choose at least one project, or switch to “Featured projects”." }),
  billboard_map: z.object({ heading: short(), lede: short(400), province: short(80) }),
  campaign: z.object({ campaignSlug: z.string().min(1, "Choose a campaign.") }),
  embed: z.object({ provider: z.enum(["youtube", "vimeo", "google_maps", "facebook_video"]), src: z.string().refine((s) => parseEmbed(s)?.src === s, "Only YouTube, Vimeo, Google Maps and Facebook video embeds are accepted."), title: z.string().trim().min(3, "Describe the embed for screen-reader users.").max(160), aspect: z.enum(["16:9", "4:3", "1:1"]).default("16:9") }),
} satisfies Record<SectionKind, z.ZodType>;

export type SectionProps = { [K in SectionKind]: z.infer<(typeof sectionSchemas)[K]> };

export const SECTION_META: Record<SectionKind, { label: string; blurb: string }> = {
  hero: { label: "Hero", blurb: "Opening statement: big title, one line of support, up to two buttons, optional image." },
  text: { label: "Text", blurb: "A heading and body copy (markdown-lite)." },
  image: { label: "Image", blurb: "One image from the library with an optional caption." },
  video: { label: "Video", blurb: "An MP4 from the library, with an optional poster image." },
  gallery: { label: "Gallery", blurb: "A grid of 2–24 images." },
  product_showcase: { label: "Product showcase", blurb: "Chosen products, or whatever is currently featured." },
  cta: { label: "Call to action", blurb: "A closing band with a primary button." },
  testimonials: { label: "Testimonials", blurb: "Published, consented testimonials. Renders nothing while there are none." },
  faq: { label: "FAQ", blurb: "Published FAQs, optionally limited to topics." },
  pricing: { label: "Pricing", blurb: "Public “from” prices for chosen products, with an estimate button. Never the confidential rules." },
  portfolio: { label: "Portfolio", blurb: "Featured or chosen case studies." },
  billboard_map: { label: "Billboard map", blurb: "The billboard network map, optionally focused on a province." },
  campaign: { label: "Campaign", blurb: "The offer block of one campaign." },
  embed: { label: "Embed", blurb: "A video or map from YouTube, Vimeo, Google Maps or Facebook. Links only — never raw HTML." },
};

/** Defaults for a new section = the schema's own defaults over the minimum required keys. */
export function blankSection(kind: SectionKind): Record<string, unknown> {
  const seed: Record<SectionKind, Record<string, unknown>> = {
    hero: { title: "" }, text: { body: "" }, image: { mediaId: "" }, video: { mediaId: "" }, gallery: { mediaIds: [] }, product_showcase: {}, cta: { title: "", ctaLabel: "Request a quote", ctaHref: "/request-quote/" },
    testimonials: {}, faq: {}, pricing: { productSlugs: [] }, portfolio: {}, billboard_map: {}, campaign: { campaignSlug: "" }, embed: { provider: "youtube", src: "", title: "" },
  };
  const shape = (sectionSchemas[kind] as unknown as { shape?: Record<string, z.ZodType> }).shape ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, s] of Object.entries(shape)) { const r = s.safeParse(undefined); if (r.success && r.data !== undefined) out[k] = r.data; }
  return { ...out, ...seed[kind] };
}

export function validateSection(kind: SectionKind, props: unknown): { ok: true; props: Record<string, unknown> } | { ok: false; errors: Record<string, string> } {
  const r = sectionSchemas[kind].safeParse(props);
  if (r.success) return { ok: true, props: r.data as Record<string, unknown> };
  const errors: Record<string, string> = {};
  for (const i of r.error.issues) { const k = String(i.path[0] ?? "_"); errors[k] ??= i.message; }
  return { ok: false, errors };
}

/** One-line summary for the section list. */
export function describeSection(kind: SectionKind, props: Record<string, unknown>): string {
  const s = (k: string) => (typeof props[k] === "string" ? (props[k] as string) : "");
  const n = (k: string) => (Array.isArray(props[k]) ? (props[k] as unknown[]).length : 0);
  switch (kind) {
    case "hero": case "cta": return s("title") || "Untitled";
    case "text": return s("heading") || s("body").slice(0, 80) || "Empty text";
    case "image": case "video": return s("caption") || (s("mediaId") ? "File selected" : "No file chosen");
    case "gallery": return `${n("mediaIds")} images`;
    case "product_showcase": return props.mode === "featured" ? "Featured products" : `${n("productSlugs")} products`;
    case "pricing": return `${n("productSlugs")} products`;
    case "portfolio": return props.mode === "selected" ? `${n("slugs")} projects` : "Featured projects";
    case "faq": return n("topics") ? (props.topics as string[]).join(", ") : "All topics";
    case "campaign": return s("campaignSlug") || "No campaign chosen";
    case "embed": return s("title") || s("src") || "No link yet";
    default: return s("heading") || SECTION_META[kind].label;
  }
}

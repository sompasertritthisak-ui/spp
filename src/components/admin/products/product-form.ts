import { z } from "zod";
import type { GarmentKey, PrintArea, PrintMethod, ProductColour } from "@/content/types";
import { backend } from "@/lib/backend/client";
import type { Json, PricingMode, ProductsRow, PublishStatus } from "@/lib/backend/db-types";
import { GARMENTS } from "@/lib/garments";
import { adminError } from "../resource/errors";
import { HEX_RE } from "../resource/fields";
import type { Seo } from "../resource/seo";
import { SLUG_RE } from "../resource/status";

export const PRINT_METHODS: { value: PrintMethod; label: string }[] = [
  { value: "screen", label: "Screen print" }, { value: "dtf", label: "DTF transfer" }, { value: "sublimation", label: "Sublimation" }, { value: "embroidery", label: "Embroidery" },
  { value: "uv", label: "UV print" }, { value: "offset", label: "Offset" }, { value: "large-format", label: "Large format" }, { value: "vinyl-cut", label: "Vinyl cut" },
];
export const PRICING_MODES: { value: PricingMode; label: string; help: string }[] = [
  { value: "fixed", label: "Fixed", help: "FIXED — the exact price is shown; the pricing engine still applies your rules." },
  { value: "estimated", label: "Estimated", help: "ESTIMATED — customers see a ±8% band from the pricing engine, never the confidential unit price." },
  { value: "quote", label: "Quote required", help: "QUOTE REQUIRED — no figure online; every enquiry becomes a quote request." },
];
export const GARMENT_KEYS = Object.keys(GARMENTS) as GarmentKey[];
export const sidesOf = (g: GarmentKey) => GARMENTS[g].sides.map((s) => ({ key: s.key as PrintArea["key"], label: s.label }));

export type ProductForm = {
  name: string; slug: string; category_id: string; summary: string; description: string;
  moq: number | null; lead_min_days: number | null; lead_max_days: number | null;
  pricing_mode: PricingMode; price_from_lak: number | null; price_unit: string;
  featured: boolean; sort: number | null; status: PublishStatus; publish_at: string | null; cover_media_id: string | null;
  gallery: string[]; related: string[];
  materials: string[]; sizes: string[]; customisation: string[]; useCases: string[]; colours: ProductColour[]; printMethods: PrintMethod[]; seo: Seo;
  studioOn: boolean; garment: GarmentKey; areas: PrintArea[];
};
export type TabKey = "basics" | "details" | "media" | "variants" | "seo" | "studio";
export const FIELD_TAB: Record<string, TabKey> = { colours: "details", printMethods: "details", materials: "details", sizes: "details", areas: "studio", garment: "studio", seo: "seo" };

const asObj = (v: Json | undefined): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function toForm(row: ProductsRow | null, gallery: string[], related: string[]): ProductForm {
  const d = asObj(row?.data);
  const studio = d.studio && typeof d.studio === "object" ? (d.studio as { garment?: GarmentKey; areas?: PrintArea[] }) : null;
  const garment = studio?.garment && GARMENT_KEYS.includes(studio.garment) ? studio.garment : "tee";
  return {
    name: row?.name ?? "", slug: row?.slug ?? "", category_id: row?.category_id ?? "", summary: row?.summary ?? "", description: row?.description ?? "",
    moq: row?.moq ?? 1, lead_min_days: row?.lead_min_days ?? null, lead_max_days: row?.lead_max_days ?? null,
    pricing_mode: row?.pricing_mode ?? "quote", price_from_lak: row?.price_from_lak == null ? null : Number(row.price_from_lak), price_unit: row?.price_unit ?? "per piece",
    featured: row?.featured ?? false, sort: row?.sort ?? 0, status: row?.status ?? "draft", publish_at: row?.publish_at ?? null, cover_media_id: row?.cover_media_id ?? null,
    gallery, related,
    materials: strs(d.materials), sizes: strs(d.sizes), customisation: strs(d.customisation), useCases: strs(d.useCases),
    colours: Array.isArray(d.colours) ? (d.colours as ProductColour[]).map((c) => ({ name: String(c?.name ?? ""), hex: String(c?.hex ?? "") })) : [],
    printMethods: strs(d.printMethods).filter((m): m is PrintMethod => PRINT_METHODS.some((p) => p.value === m)),
    seo: asObj(d.seo as Json) as Seo,
    studioOn: Boolean(studio), garment, areas: Array.isArray(studio?.areas) ? studio.areas.map((a) => ({ key: a.key, label: String(a.label ?? ""), widthMm: Number(a.widthMm) || 0, heightMm: Number(a.heightMm) || 0 })) : [],
  };
}

export const productSchema = z.object({
  name: z.string().trim().min(2, "Give the product a name.").max(120),
  slug: z.string().regex(SLUG_RE, "Lowercase letters, numbers and single hyphens only.").max(80),
  category_id: z.string().min(1, "Choose a category."),
  summary: z.string().max(300, "Keep the summary under 300 characters."),
  description: z.string().max(6000),
  moq: z.number({ error: "Enter the minimum order quantity." }).int("Use a whole number.").min(1, "The minimum order is at least 1."),
  lead_min_days: z.number().int("Use whole days.").min(0).max(365).nullable(),
  lead_max_days: z.number().int("Use whole days.").min(0).max(365).nullable(),
  price_from_lak: z.number().min(0, "A price cannot be negative.").max(1e11).nullable(),
  price_unit: z.string().trim().min(1, "Say what the price is per, e.g. “per piece”.").max(40),
  sort: z.number().int().min(0).nullable(),
  colours: z.array(z.object({ name: z.string().trim().min(1, "Every colour needs a name."), hex: z.string().regex(HEX_RE, "Every colour needs a 6-digit hex value.") })).max(40),
  areas: z.array(z.object({ key: z.string(), label: z.string().trim().min(1, "Every print area needs a label."), widthMm: z.number().min(10, "Print areas are at least 10 mm wide.").max(5000), heightMm: z.number().min(10, "Print areas are at least 10 mm tall.").max(5000) })),
});

export function validateProduct(f: ProductForm): Record<string, string> {
  const e: Record<string, string> = {};
  const r = productSchema.safeParse(f);
  if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
  if ((f.lead_min_days === null) !== (f.lead_max_days === null)) e.lead_max_days = "Give both lead-time values, or leave both empty.";
  else if (f.lead_min_days !== null && f.lead_max_days !== null && f.lead_min_days > f.lead_max_days) e.lead_max_days = "The longest lead time cannot be shorter than the shortest.";
  if (new Set(f.colours.map((c) => c.name.trim().toLowerCase())).size !== f.colours.length) e.colours ??= "Two colours share the same name.";
  if (f.studioOn) {
    const valid = new Set(sidesOf(f.garment).map((s) => s.key));
    if (!f.areas.length) e.areas ??= "Add at least one print area, or switch Studio off for this product.";
    else if (f.areas.some((a) => !valid.has(a.key))) e.areas ??= `A print area does not exist on the ${GARMENTS[f.garment].name.toLowerCase()}.`;
    else if (new Set(f.areas.map((a) => a.key)).size !== f.areas.length) e.areas ??= "Each side can only be listed once.";
  }
  if (f.seo.title && f.seo.title.length > 80) e.seo = "Keep the SEO title under 80 characters.";
  return e;
}

/** Row payload. Unknown keys already in `data` are preserved. */
export function toRow(f: ProductForm, original: ProductsRow | null) {
  const data = { ...asObj(original?.data), materials: f.materials, sizes: f.sizes, colours: f.colours.map((c) => ({ name: c.name.trim(), hex: c.hex.toLowerCase() })), printMethods: f.printMethods, customisation: f.customisation, useCases: f.useCases, seo: f.seo, studio: f.studioOn ? { garment: f.garment, areas: f.areas } : null };
  return {
    name: f.name.trim(), slug: f.slug, category_id: f.category_id, summary: f.summary.trim(), description: f.description.trim(), data, moq: f.moq ?? 1,
    lead_min_days: f.lead_min_days, lead_max_days: f.lead_max_days, pricing_mode: f.pricing_mode, price_from_lak: f.price_from_lak, price_unit: f.price_unit.trim(),
    featured: f.featured, sort: f.sort ?? 0, status: f.status, publish_at: f.status === "published" ? f.publish_at : null, cover_media_id: f.cover_media_id,
  };
}

/** Replace a product's ordered links (gallery / related) by diff: remove what is gone, upsert the rest with fresh sort values. */
export async function saveLinks(table: "product_media" | "product_relations", productId: string, column: "media_id" | "related_id", before: string[], after: string[]): Promise<string | null> {
  const b = backend()!;
  const removed = before.filter((x) => !after.includes(x));
  if (removed.length) { const r = await b.from(table).delete().eq("product_id", productId).in(column, removed); if (r.error) return adminError(r.error); }
  if (after.length) { const r = await b.from(table).upsert(after.map((id, i) => ({ product_id: productId, [column]: id, sort: i })), { onConflict: `product_id,${column}` }); if (r.error) return adminError(r.error); }
  return null;
}

export async function loadLinks(productId: string): Promise<{ gallery: string[]; related: string[] }> {
  const b = backend()!;
  const [g, r] = await Promise.all([b.from("product_media").select("media_id,sort").eq("product_id", productId).order("sort"), b.from("product_relations").select("related_id,sort").eq("product_id", productId).order("sort")]);
  if (g.error || r.error) throw new Error(adminError(g.error ?? r.error));
  return { gallery: (g.data ?? []).map((x) => x.media_id as string), related: (r.data ?? []).map((x) => x.related_id as string) };
}

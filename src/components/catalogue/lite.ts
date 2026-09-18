import type { Bundle, GarmentKey, MediaRef, PrintArea, PrintMethod, PricingMode, Product, ProductColour } from "@/content/types";
import { formatLak } from "@/lib/format";

/** The slice of a Product the client islands need. Keeps long copy out of the JS payload. */
export type ProductLite = {
  slug: string; name: string; category: string; summary: string;
  moq: number; leadTimeDays: [number, number] | null;
  pricingMode: PricingMode; priceFromLak: number | null; priceUnit: string;
  printMethods: PrintMethod[]; colours: ProductColour[]; sizes: string[];
  garment: GarmentKey | null; areas: Pick<PrintArea, "key" | "label">[];
  cover: MediaRef | null; gallery: MediaRef[];
};

export const toLite = (p: Product): ProductLite => ({
  slug: p.slug, name: p.name, category: p.category, summary: p.summary, moq: p.moq, leadTimeDays: p.leadTimeDays,
  pricingMode: p.pricingMode, priceFromLak: p.priceFromLak, priceUnit: p.priceUnit, printMethods: p.printMethods,
  colours: p.colours, sizes: p.sizes, garment: p.studio?.garment ?? null, areas: (p.studio?.areas ?? []).map((a) => ({ key: a.key, label: a.label })),
  cover: p.cover ?? null, gallery: p.gallery ?? [],
});

export type BundleLite = Pick<Bundle, "slug" | "name" | "summary" | "discountPct" | "items">;

/** Public price line. A figure appears only when online pricing is on AND content carries a hint. */
export function priceLabel(p: Pick<ProductLite, "pricingMode" | "priceFromLak" | "priceUnit">, onlinePricing: boolean): string {
  if (!onlinePricing || p.pricingMode === "quote" || p.priceFromLak == null) return "Quote on request";
  return `From ${formatLak(p.priceFromLak)} ${p.priceUnit}`;
}

export const leadLabel = (d: [number, number] | null) => (d ? `${d[0]}–${d[1]} working days` : "Scheduled with your quote");
export const hasPriceHint = (p: Pick<ProductLite, "pricingMode" | "priceFromLak">, onlinePricing: boolean) => onlinePricing && p.pricingMode !== "quote" && p.priceFromLak != null;

import type { PrintMethod } from "@/content/types";

/**
 * The hand-off contract between every "start" surface (product page estimate,
 * project builder, campaign builder, bundles) and the quote builder.
 * Stored in sessionStorage under QUOTE_DRAFT_KEY so a customer never retypes
 * what they already told us. The quote builder also autosaves back to it.
 */
export const QUOTE_DRAFT_KEY = "spp.quoteDraft";

export type QuoteKind = "product" | "project" | "bundle" | "campaign";

export type QuoteDraftItem = {
  product: string;                    // product slug
  qty: number;
  colour?: string;                    // colour NAME from product.colours
  sizes?: Record<string, number>;     // optional size breakdown
  method?: PrintMethod;
  locations?: string[];               // print-area keys, or "location-N" for products without areas
  delivery?: boolean;
  note?: string;
  designRef?: string;                 // SPP-DESIGN-YYYY-NNNNN
};

export type ProjectBrief = {
  name: string;
  goal: string;                       // solution goal, or the customer's own words
  goalSlug?: string;
  audience: string;
  headcount: number;
  materials: string[];                // what artwork the customer already has
  needsDesignHelp: "yes" | "no" | "unsure";
  services: string[];                 // recommended service slugs
  artworkChecklist: string[];
  complexity: "simple" | "moderate" | "complex";
  complexityReasons: string[];
  timelineDays: [number, number] | null;
  suggestedBundle?: string;
};

export type QuoteDraft = {
  v: 1;
  kind: QuoteKind;
  /** attribution, e.g. "product:custom-t-shirt", "bundle:event-package", "project_builder", "campaign:promote-an-event" */
  source: string;
  items: QuoteDraftItem[];
  neededBy?: string;                  // YYYY-MM-DD
  needsDesignHelp?: boolean;
  notes?: string;
  bundle?: string;                    // bundle slug when the items came from (or match) a bundle
  project?: ProjectBrief;             // only for kind "project"
};

const isItem = (v: unknown): v is QuoteDraftItem =>
  typeof v === "object" && v !== null && typeof (v as QuoteDraftItem).product === "string" && Number.isFinite((v as QuoteDraftItem).qty);

export function readQuoteDraft(): QuoteDraft | null {
  try {
    const raw = sessionStorage.getItem(QUOTE_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<QuoteDraft>;
    if (d.v !== 1 || !Array.isArray(d.items)) return null;
    const kind: QuoteKind = d.kind === "project" || d.kind === "bundle" || d.kind === "campaign" ? d.kind : "product";
    return { ...d, v: 1, kind, source: typeof d.source === "string" ? d.source : "", items: d.items.filter(isItem).slice(0, 30) };
  } catch {
    return null;
  }
}

export function writeQuoteDraft(d: QuoteDraft) {
  try { sessionStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(d)); } catch {}
}

export function clearQuoteDraft() {
  try { sessionStorage.removeItem(QUOTE_DRAFT_KEY); } catch {}
}

/** Options object understood by the estimate_price / submit_quote pricing engine. */
export function pricingOptions(i: Pick<QuoteDraftItem, "method" | "locations" | "delivery">, neededBy?: string): Record<string, unknown> {
  return {
    ...(i.method ? { method: i.method } : {}),
    locations: i.locations?.length ? i.locations : ["front"],   // the engine counts this array; it must always be one
    ...(i.delivery ? { delivery: true } : {}),
    ...(neededBy ? { neededBy } : {}),
  };
}

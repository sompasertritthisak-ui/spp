import type { PricingRulesRow, ProductsRow } from "@/lib/backend/db-types";
import { formatDate, formatLak } from "@/lib/format";

/* Mirrors _price() in supabase/migrations/0004_rpc.sql. Read that function
   before changing anything here: the forms promise exactly what it does. */

export const RULE_KINDS = ["base", "qty_tier", "method", "location", "material", "size", "finishing", "rush", "delivery", "installation", "seasonal"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];
export type AmountType = "flat" | "per_unit" | "percent";
export const MATCH_KINDS = ["method", "material", "size", "finishing"] as const;
export const isMatchKind = (k: string): k is (typeof MATCH_KINDS)[number] => (MATCH_KINDS as readonly string[]).includes(k);
/** Kinds the public quote flow currently sends an option for (src/components/quote/draft.ts → pricingOptions). */
export const SENT_BY_SITE: readonly RuleKind[] = ["base", "qty_tier", "method", "location", "rush", "delivery", "seasonal"];

export const KIND_META: Record<RuleKind, { label: string; blurb: string; types: AmountType[]; customerLabel: boolean }> = {
  base: { label: "Base price", blurb: "Unit price in LAK at the minimum order quantity. One active base per priced product; if there are several, the newest wins. No base → customers see “quote required”.", types: ["per_unit"], customerLabel: false },
  qty_tier: { label: "Quantity tiers", blurb: "Percent change on the unit price when the quantity falls inside a range. Discounts are negative. Customers see “Volume pricing applied”.", types: ["percent"], customerLabel: false },
  method: { label: "Print method", blurb: "Applies when the customer picks this print method.", types: ["percent", "per_unit"], customerLabel: true },
  location: { label: "Extra print locations", blurb: "Applies when more than one print location is chosen. A per-unit amount is charged for EACH extra location; a percent applies once.", types: ["per_unit", "percent"], customerLabel: false },
  material: { label: "Material", blurb: "Applies when this material option is passed to the engine.", types: ["percent", "per_unit"], customerLabel: true },
  size: { label: "Size", blurb: "Applies when this size option is passed to the engine (e.g. 2XL and above).", types: ["percent", "per_unit"], customerLabel: true },
  finishing: { label: "Finishing", blurb: "Applies when this finishing option is passed to the engine (lamination, neck label…).", types: ["percent", "per_unit", "flat"], customerLabel: true },
  rush: { label: "Rush", blurb: "Applies when the needed-by date is sooner than today + the product's shortest lead time. Customers see “Rush production”.", types: ["percent"], customerLabel: false },
  delivery: { label: "Delivery", blurb: "Added once per order when the customer asks for delivery.", types: ["flat", "per_unit"], customerLabel: false },
  installation: { label: "Installation", blurb: "Added once per order when installation is requested.", types: ["flat", "per_unit"], customerLabel: false },
  seasonal: { label: "Seasonal", blurb: "A percent change inside a date window (promotion or peak-season uplift). Its label IS shown to customers.", types: ["percent"], customerLabel: true },
};

export const matchValue = (r: Pick<PricingRulesRow, "kind" | "match">): string => { const m = r.match && typeof r.match === "object" && !Array.isArray(r.match) ? (r.match as Record<string, unknown>) : {}; const v = m[r.kind]; return typeof v === "string" ? v : ""; };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
export function amountText(r: Pick<PricingRulesRow, "amount" | "amount_type">): string {
  const a = Number(r.amount);
  if (r.amount_type === "percent") return `${signed(a)}%`;
  const money = `${a < 0 ? "−" : "+"}${formatLak(Math.abs(a))}`;
  return r.amount_type === "per_unit" ? `${money} per piece` : `${money} flat`;
}
export function ruleSummary(r: PricingRulesRow): string {
  const a = Number(r.amount);
  switch (r.kind as RuleKind) {
    case "base": return `${formatLak(a)} per piece at MOQ`;
    case "qty_tier": return `${amountText(r)} for ${r.min_qty ?? 1}${r.max_qty == null ? "+" : `–${r.max_qty}`} pcs`;
    case "location": return r.amount_type === "per_unit" ? `${amountText(r)} for each extra print location` : `${amountText(r)} when there is more than one print location`;
    case "rush": return `${amountText(r)} when needed inside the normal lead time`;
    case "seasonal": return `${amountText(r)} · ${r.starts_at ? formatDate(r.starts_at) : "now"} → ${r.ends_at ? formatDate(r.ends_at) : "no end"}`;
    case "delivery": case "installation": return amountText(r);
    default: return `${amountText(r)} · ${matchValue(r) || "no option set"}`;
  }
}

const hi = (n: number | null) => n ?? Number.MAX_SAFE_INTEGER;
export const tiersOverlap = (a: Pick<PricingRulesRow, "min_qty" | "max_qty">, b: Pick<PricingRulesRow, "min_qty" | "max_qty">) => (a.min_qty ?? 0) <= hi(b.max_qty) && (b.min_qty ?? 0) <= hi(a.max_qty);
export const seasonalLive = (r: PricingRulesRow, now: number) => (!r.starts_at || new Date(r.starts_at).getTime() <= now) && (!r.ends_at || new Date(r.ends_at).getTime() >= now);

export type Problem = { level: "danger" | "warn"; text: string };
/** Everything that would surprise an admin about how a product is priced online. */
export function productProblems(p: Pick<ProductsRow, "pricing_mode" | "status" | "name">, own: PricingRulesRow[], onlinePricing: boolean): Problem[] {
  const out: Problem[] = [];
  const active = own.filter((r) => r.active);
  const bases = active.filter((r) => r.kind === "base");
  if (p.pricing_mode === "quote") { if (active.length) out.push({ level: "warn", text: "This product is in QUOTE REQUIRED mode, so its rules are ignored. Switch the product to Fixed or Estimated to use them." }); return out; }
  if (bases.length === 0) out.push({ level: "danger", text: "No active base price — customers see “quote required” instead of an estimate." });
  if (bases.length > 1) out.push({ level: "warn", text: `${bases.length} active base prices — only the newest is used. Switch the others off.` });
  const tiers = active.filter((r) => r.kind === "qty_tier");
  if (tiers.some((a, i) => tiers.some((b, j) => j > i && tiersOverlap(a, b)))) out.push({ level: "danger", text: "Quantity tiers overlap — both discounts would stack for the same quantity." });
  if (p.status !== "published") out.push({ level: "warn", text: "The product is not published, so the estimate engine will not price it yet." });
  if (!onlinePricing) out.push({ level: "warn", text: "ONLINE_PRICING is switched off — no estimates are shown for any product." });
  return out;
}

import type { BundleLite, ProductLite } from "@/components/catalogue/lite";
import type { PrintMethod, Solution } from "@/content/types";
import type { ProjectBrief, QuoteDraftItem } from "./draft";
import { defaultLocations } from "./LocationsPicker";

export type Answers = {
  name: string; goalSlug: string; goalText: string; audience: string[]; headcount: number;
  neededBy: string; noDate: boolean; materials: string[]; designHelp: "yes" | "no" | "unsure" | "";
  products: string[]; productsTouched: boolean;
};
export const EMPTY_ANSWERS: Answers = { name: "", goalSlug: "", goalText: "", audience: [], headcount: 25, neededBy: "", noDate: false, materials: [], designHelp: "", products: [], productsTouched: false };

export const OTHER_GOAL = "something-else";
export const MATERIALS = [
  { key: "logo", label: "A logo" },
  { key: "artwork", label: "Finished artwork" },
  { key: "guidelines", label: "Brand guidelines" },
  { key: "nothing", label: "Nothing yet" },
] as const;
export const AUDIENCES = ["Staff", "Customers", "Event guests", "Students", "Team & players", "The general public"] as const;

/** One per person for wearable / hand-out categories; everything else starts at its minimum. */
const PER_PERSON = new Set(["apparel", "accessories", "promotional"]);
/** Built, surveyed or installed — work that needs a site visit or fabrication drawing. */
const isFabrication = (p: ProductLite) => p.category === "outdoor" || (p.pricingMode === "quote" && ["signage", "vehicle", "display"].includes(p.category));

export const recommendedProducts = (s: Solution | undefined) => [...new Set((s?.recommend ?? []).flatMap((g) => g.items.flatMap((i) => (i.product ? [i.product] : []))))];

const ARTWORK_BY_METHOD: Partial<Record<PrintMethod, string>> = {
  screen: "Spot colours identified (Pantone references if you have them)",
  embroidery: "A simplified logo for stitching — we can digitise yours",
  dtf: "Full-colour artwork at 300 dpi at print size",
  sublimation: "Full-colour artwork at 300 dpi at print size",
  "large-format": "Large-format artwork at final proportions (we advise on resolution for the viewing distance)",
  "vinyl-cut": "Vector outlines for any cut lettering or shapes",
  offset: "Print-ready PDF with 3 mm bleed — or let us prepare it",
  uv: "Vector artwork for rigid panels and sign faces",
};

export function daysUntil(iso: string) {
  return Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86_400_000);
}

export type Plan = { brief: ProjectBrief; items: QuoteDraftItem[]; chosen: ProductLite[]; bundle?: BundleLite; bundleComplete: boolean; deadlineNote?: string; requirements: string[] };

export function buildPlan(a: Answers, ctx: { products: ProductLite[]; solutions: Solution[]; bundles: BundleLite[]; services: { slug: string; name: string; products: string[] }[] }): Plan {
  const chosen = ctx.products.filter((p) => a.products.includes(p.slug));
  const solution = ctx.solutions.find((s) => s.slug === a.goalSlug);
  const needsDesign = a.designHelp !== "no" || a.materials.includes("nothing");

  const items: QuoteDraftItem[] = chosen.map((p) => ({ product: p.slug, qty: PER_PERSON.has(p.category) ? Math.max(p.moq, a.headcount) : p.moq, method: p.printMethods[0], locations: defaultLocations(p.areas) }));

  const services = ctx.services.filter((s) => s.products.some((slug) => a.products.includes(slug))).map((s) => s.slug);
  if (needsDesign && !services.includes("graphic-design") && ctx.services.some((s) => s.slug === "graphic-design")) services.unshift("graphic-design");

  // Artwork checklist: what the chosen print methods actually need.
  const methods = new Set(chosen.map((p) => p.printMethods[0]).filter((m) => m !== undefined));
  const artworkChecklist = [
    a.materials.includes("nothing") ? "No artwork yet — SPP's design team prepares it (quoted with the project)" : "Your logo as a vector file (AI, EPS, SVG or PDF)",
    ...[...methods].flatMap((m) => (ARTWORK_BY_METHOD[m] ? [ARTWORK_BY_METHOD[m]] : [])),
    ...(chosen.some((p) => p.sizes.length > 2 && p.category === "apparel") ? ["A size breakdown — and a names / numbers list if pieces are personalised"] : []),
    ...(a.materials.includes("guidelines") ? ["Your brand guidelines, so colour and spacing are right first time"] : []),
  ];

  // Timeline: the slowest product sets the pace.
  const leads = chosen.map((p) => p.leadTimeDays).filter((d) => d !== null);
  const timelineDays: [number, number] | null = leads.length ? [Math.max(...leads.map((d) => d[0])), Math.max(...leads.map((d) => d[1]))] : null;

  // Complexity: a transparent points tally — shown to the customer, not hidden.
  let score = 0;
  const complexityReasons: string[] = [];
  if (chosen.length >= 5) { score += 2; complexityReasons.push(`${chosen.length} different products to coordinate`); }
  else if (chosen.length >= 3) { score += 1; complexityReasons.push(`${chosen.length} different products`); }
  const fab = chosen.filter(isFabrication);
  if (fab.length) { score += 2; complexityReasons.push(`Custom fabrication or installation: ${fab.map((p) => p.name).join(", ")}`); }
  if (needsDesign) { score += 1; complexityReasons.push("Design work is part of the project"); }
  let deadlineNote: string | undefined;
  if (!a.noDate && a.neededBy && timelineDays) {
    const left = daysUntil(a.neededBy);
    const [minCal, maxCal] = [Math.ceil(timelineDays[0] * 1.4), Math.ceil(timelineDays[1] * 1.4)]; // working → calendar days
    if (left < minCal) { score += 2; complexityReasons.push("The deadline is inside standard production time"); deadlineNote = "Your date is tighter than standard production. Rush production may be possible — we will tell you honestly in the quote."; }
    else if (left < maxCal + 5) { score += 1; complexityReasons.push("The deadline leaves little slack"); deadlineNote = "Your date is achievable with prompt artwork approval."; }
    else deadlineNote = "Your date leaves comfortable room for proofs and production.";
  }
  if (complexityReasons.length === 0) complexityReasons.push("A small number of standard products with no fabrication");
  const complexity: ProjectBrief["complexity"] = score >= 4 ? "complex" : score >= 2 ? "moderate" : "simple";

  // Bundle: the goal's own bundle, else whichever shares the most products (at least two).
  const overlap = (b: BundleLite) => b.items.filter((i) => a.products.includes(i.product)).length;
  const bundle = ctx.bundles.find((b) => b.slug === solution?.bundle && overlap(b) >= 1) ?? [...ctx.bundles].sort((x, y) => overlap(y) - overlap(x)).find((b) => overlap(b) >= 2);
  const bundleComplete = Boolean(bundle && bundle.items.every((i) => a.products.includes(i.product)));

  const requirements = [
    "Quantities for each item (a first guess is filled in for you)",
    ...(chosen.some((p) => p.colours.length > 0) ? ["Garment and product colours"] : []),
    ...(fab.length ? ["Site address and photos for anything installed — we arrange a survey"] : []),
    "Delivery location",
    a.noDate || !a.neededBy ? "A target date, when you have one" : "Your deadline (already noted)",
  ];

  const brief: ProjectBrief = {
    name: a.name.trim(), goal: solution?.goal ?? a.goalText.trim(), goalSlug: solution?.slug, audience: a.audience.join(", "), headcount: a.headcount,
    materials: a.materials, needsDesignHelp: a.designHelp || "unsure", services, artworkChecklist, complexity, complexityReasons, timelineDays, suggestedBundle: bundle?.slug,
  };
  return { brief, items, chosen, bundle, bundleComplete, deadlineNote, requirements };
}

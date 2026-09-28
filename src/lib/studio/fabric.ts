import type { Fabric, PrintArea, Product } from "@/content/types";

/**
 * SPP's fabric groups and the print-size rules that come with them. One source
 * for the Studio product panel, the catalogue and product pages, so the rule a
 * customer reads is the rule preflight enforces.
 *
 *  · Cotton (tees, round-collar shirts, polos): front logo up to 8 × 8 cm on the
 *    left or right chest; back up to 10 × 25 cm.
 *  · Sports fabric (polyester, sublimated): free-flow — the whole garment is
 *    the canvas, no rectangle cap.
 *  · Canvas / other: the item's own panel.
 */
export const FABRIC_ORDER: Fabric[] = ["cotton", "sports", "canvas", "other"];

export const FABRIC_META: Record<Fabric, { label: string; heading: string; rule: string; short: string }> = {
  cotton: { label: "Cotton", heading: "Cotton", rule: "Front logo up to 8 × 8 cm on the left or right chest · back up to 10 × 25 cm", short: "Capped print sizes" },
  sports: { label: "Sports fabric", heading: "Sports fabric", rule: "Free-flow all-over print — the whole garment is the canvas", short: "Free-flow all-over print" },
  canvas: { label: "Canvas", heading: "Bags & caps", rule: "Print covers the full face of the bag · handles in your colour", short: "Full-face print" },
  other: { label: "Other", heading: "Bags & caps", rule: "Printed or embroidered on the item's own panel", short: "Panel print" },
};

/** Studio groups bags and caps together; everything else groups by its fabric. */
export const fabricGroup = (p: Pick<Product, "fabric">): Fabric => (p.fabric === "canvas" ? "other" : p.fabric);

export const cm = (mm: number) => (mm % 10 === 0 ? String(mm / 10) : (mm / 10).toFixed(1));

/** One line per print area, in centimetres: "Left chest — up to 8 × 8 cm" or "Front — free-flow, whole garment". */
export function areaRule(a: PrintArea): string {
  if (a.freeFlow) return `${a.label} — free-flow, the whole garment (about ${cm(a.widthMm)} × ${cm(a.heightMm)} cm)`;
  return `${a.label} — up to ${cm(a.widthMm)} × ${cm(a.heightMm)} cm`;
}

/** Is a product's studio set-up all-over print? (Every area free-flow.) */
export const isFreeFlow = (areas: PrintArea[]) => areas.length > 0 && areas.every((a) => a.freeFlow);

import type { PrintArea } from "@/content/types";
import { AREA_W, type Layer, type Sides } from "./schema";
import { layerBounds, layerSize } from "./metrics";
import type { ArtMeta } from "./uploads";

/**
 * ARTWORK PREFLIGHT — automated, advisory checks run before a design goes to
 * SPP. It can catch the common problems early; it cannot approve anything.
 * The UI must always show PREFLIGHT_DISCLAIMER next to these results.
 */
export const PREFLIGHT_DISCLAIMER = "Automated preflight checks are advisory. Final production approval is subject to SPP review.";

export type CheckLevel = "ok" | "attention" | "blocked" | "info";
export type Check = { id: string; level: CheckLevel; title: string; detail: string; side?: string; layerId?: string };
export type Verdict = "ready" | "attention" | "blocked";
export const VERDICT_LABEL: Record<Verdict, string> = { ready: "Ready for review", attention: "Needs attention", blocked: "Not production ready" };

export type PreflightInput = { sides: Sides; colour: string; areas: PrintArea[]; assetMeta: (layer: Extract<Layer, { type: "image" }>) => ArtMeta | undefined };

const SAFE_INSET = 0.04; // 4% of the area width on every edge
const MM_PER_IN = 25.4;

function luminance(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((v >> 16) & 255) + 0.7152 * f((v >> 8) & 255) + 0.0722 * f(v & 255);
}
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };

export function runPreflight({ sides, colour, areas, assetMeta }: PreflightInput): { verdict: Verdict; checks: Check[] } {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  let anyArt = false;
  const fills = new Set<string>();

  for (const area of areas) {
    const layers = (sides[area.key] ?? []).filter((l) => !l.hidden);
    if (!layers.length) continue;
    anyArt = true;
    const mmPerUnit = area.widthMm / AREA_W;
    const areaH = AREA_W * (area.heightMm / area.widthMm);
    const inset = AREA_W * SAFE_INSET;

    for (const l of layers) {
      const b = layerBounds(l);
      const where = { side: area.key, layerId: l.id };
      const label = l.type === "text" ? `“${l.text.split("\n")[0]!.slice(0, 24)}”` : l.type === "image" ? l.name : l.type === "graphic" ? "Graphic" : "Shape";

      // ── print-area compatibility & safe zone
      if (b.x1 < 0 || b.y1 < 0 || b.x0 > AREA_W || b.y0 > areaH) add({ ...where, id: `out-${l.id}`, level: "blocked", title: `${label} is outside the print area`, detail: `It will not be printed. Move it back inside the dashed ${area.label.toLowerCase()} area or delete it.` });
      else if (b.x0 < -1 || b.y0 < -1 || b.x1 > AREA_W + 1 || b.y1 > areaH + 1) add({ ...where, id: `crop-${l.id}`, level: "attention", title: `${label} runs past the print area`, detail: "The part outside the dashed line will be cut off. Resize or reposition it if that is not intended." });
      else if (b.x0 < inset || b.y0 < inset || b.x1 > AREA_W - inset || b.y1 > areaH - inset) add({ ...where, id: `safe-${l.id}`, level: "attention", title: `${label} is inside the safe margin`, detail: "Garments shift slightly on press. Keep important content within the dotted safe zone." });

      // ── visibility against the fabric
      if (l.type !== "image") {
        fills.add(l.fill.toLowerCase());
        if (contrast(l.fill, colour) < 1.35) add({ ...where, id: `contrast-${l.id}`, level: "attention", title: `${label} may be hard to see`, detail: `Its colour (${l.fill.toUpperCase()}) is very close to the garment colour. Choose a lighter or darker ink.` });
      }

      if (l.type === "text") {
        const capMm = l.size * 0.7 * mmPerUnit;
        if (capMm < 2) add({ ...where, id: `tiny-${l.id}`, level: "blocked", title: `${label} is too small to print`, detail: `Letters would be about ${capMm.toFixed(1)} mm tall. Below 2 mm, text fills in or disappears in print and embroidery.` });
        else if (capMm < 3.2) add({ ...where, id: `small-${l.id}`, level: "attention", title: `${label} is very small`, detail: `Letters would be about ${capMm.toFixed(1)} mm tall. We recommend at least 3 mm (6 mm for embroidery).` });
        if (l.weight <= 300 && capMm < 8) add({ ...where, id: `thin-${l.id}`, level: "attention", title: `${label} uses a thin weight`, detail: "Hairline strokes can break up on fabric. A heavier weight prints more reliably at this size." });
      }

      if (l.type === "shape") {
        const { w, h } = layerSize(l);
        const thinMm = Math.min(w, h) * mmPerUnit * (l.shape === "ring" ? 0.07 : 1);
        if (thinMm < 0.35) add({ ...where, id: `line-${l.id}`, level: "attention", title: "A line is extremely thin", detail: `About ${thinMm.toFixed(2)} mm. Lines under 0.35 mm (1 pt) may not hold in print.` });
      }

      if (l.type === "image") {
        const meta = assetMeta(l);
        const widthIn = (l.w * mmPerUnit) / MM_PER_IN;
        if (l.vector) add({ ...where, id: `vec-${l.id}`, level: "ok", title: `${label}: vector artwork`, detail: "Scales to any size without losing quality." });
        else {
          const ppi = Math.round(l.naturalW / widthIn);
          const sizeTxt = `${Math.round(l.w * mmPerUnit)} mm wide → ${ppi} px/inch`;
          if (ppi < 72) add({ ...where, id: `res-${l.id}`, level: "blocked", title: `${label}: resolution far too low`, detail: `${l.naturalW} × ${l.naturalH} px printed ${sizeTxt}. It will look blurred and blocky. Upload a larger file, a vector, or make it smaller.` });
          else if (ppi < 150) add({ ...where, id: `res-${l.id}`, level: "attention", title: `${label}: potentially low resolution`, detail: `${l.naturalW} × ${l.naturalH} px printed ${sizeTxt}. 150 px/inch or more is recommended for apparel.` });
          else add({ ...where, id: `res-${l.id}`, level: "ok", title: `${label}: resolution looks good`, detail: `${l.naturalW} × ${l.naturalH} px printed ${sizeTxt}.` });
        }
        if (meta) {
          if (meta.colourSpace === "CMYK") add({ ...where, id: `cmyk-${l.id}`, level: "attention", title: `${label} is a CMYK file`, detail: "Browsers show CMYK images inaccurately, so the colours on screen are not reliable. Our team will check the original." });
          if (!meta.vector && meta.solidBackground && contrast("#ffffff", colour) > 1.15) add({ ...where, id: `bg-${l.id}`, level: "attention", title: `${label} has a solid background`, detail: "There is no transparency, so it will print as a rectangle. Upload a transparent PNG or a vector, or ask SPP to remove the background." });
          if (meta.dpi && !meta.vector && meta.dpi < 100) add({ ...where, id: `dpi-${l.id}`, level: "info", title: `${label}: file is tagged ${meta.dpi} dpi`, detail: "That tag suggests it was made for screens. What matters is the pixel count at print size, shown above." });
          if (Math.abs(l.w / l.h - meta.naturalW / meta.naturalH) > 0.02) add({ ...where, id: `aspect-${l.id}`, level: "attention", title: `${label} has been stretched`, detail: "Its proportions no longer match the original file." });
        }
      }
    }
  }

  if (!anyArt) add({ id: "empty", level: "info", title: "No artwork yet", detail: "Add text, an element or upload a logo to begin." });
  if (fills.size > 4) add({ id: "colours", level: "info", title: `${fills.size} ink colours in use`, detail: "Screen printing is priced per colour. For multi-colour artwork, DTF or sublimation is usually better value — we will advise in your quote." });

  const verdict: Verdict = checks.some((c) => c.level === "blocked") ? "blocked" : checks.some((c) => c.level === "attention") ? "attention" : "ready";
  return { verdict, checks: checks.sort((a, b) => rank(a.level) - rank(b.level)) };
}
const rank = (l: CheckLevel) => ({ blocked: 0, attention: 1, info: 2, ok: 3 })[l];

/**
 * BRAND CONSISTENCY — compares ink colours with the customer's saved palette.
 * Advisory only: this can notice a colour that is not in the palette; it cannot
 * and does not claim to validate brand compliance.
 */
export function brandHints(sides: Sides, palette: { name: string; hex: string }[]): Check[] {
  if (!palette.length) return [];
  const rgb = (h: string) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const; };
  const dist = (a: string, b: string) => { const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b); const rm = (r1 + r2) / 2; return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2); };
  const neutral = (h: string) => { const [r, g, b] = rgb(h); return Math.max(r, g, b) - Math.min(r, g, b) < 18; };
  const seen = new Set<string>(), out: Check[] = [];
  for (const [side, layers] of Object.entries(sides)) for (const l of layers) {
    if (l.type === "image" || l.hidden || neutral(l.fill) || seen.has(l.fill.toLowerCase())) continue;
    seen.add(l.fill.toLowerCase());
    const nearest = palette.map((p) => ({ p, d: dist(l.fill, p.hex) })).sort((a, b) => a.d - b.d)[0]!;
    if (nearest.d > 60) out.push({ id: `brand-${l.id}`, level: "attention", side, layerId: l.id, title: `${l.fill.toUpperCase()} differs from your saved brand palette`, detail: `Closest saved colour: ${nearest.p.name || "Unnamed"} ${nearest.p.hex.toUpperCase()}. This is a hint only — it does not check brand compliance.` });
  }
  return out;
}

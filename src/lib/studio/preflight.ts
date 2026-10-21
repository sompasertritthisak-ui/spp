import type { Fabric, PrintArea } from "@/content/types";
import { translate, type Key, type Vars } from "@/lib/i18n/core";
import { cm } from "./fabric";
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
/**
 * A message is a dictionary key plus its values, so the Studio can show it in
 * the visitor's language; `title` / `detail` are the English rendering, which
 * is what gets stored with a design and what the Command Center reads.
 * Values named `area` and `fabric` are keys (print-area key, fabric key) that
 * the renderer translates through `pf.area.*` / `pf.fabric.*`.
 */
export type Msg = { key: Key; vars?: Vars };
export type Check = { id: string; level: CheckLevel; title: string; detail: string; side?: string; layerId?: string; msg?: { title: Msg; detail: Msg } };
export type Verdict = "ready" | "attention" | "blocked";
export const VERDICT_LABEL: Record<Verdict, string> = { ready: "Ready for review", attention: "Needs attention", blocked: "Not production ready" };
export const VERDICT_KEY: Record<Verdict, Key> = { ready: "pf.verdict.ready", attention: "pf.verdict.attention", blocked: "pf.verdict.blocked" };

/** Fills a message in a language; `area` and `fabric` values are looked up as keys. */
export function renderMsg(lang: "en" | "lo", m: Msg): string {
  const vars: Vars = { ...m.vars };
  if (typeof vars.area === "string") vars.area = translate(lang, `pf.area.${vars.area}` as Key);
  if (typeof vars.fabric === "string") vars.fabric = translate(lang, `pf.fabric.${vars.fabric}` as Key);
  if (vars.label === "{graphic}") vars.label = translate(lang, "pf.label.graphic");
  if (vars.label === "{shape}") vars.label = translate(lang, "pf.label.shape");
  if (vars.name === "{unnamed}") vars.name = translate(lang, "pf.brand.unnamed");
  return translate(lang, m.key, vars);
}

export type PreflightInput = {
  sides: Sides; colour: string; areas: PrintArea[];
  /** names the rule in size warnings ("…maximum for cotton"); free-flow areas are read from `areas` */
  fabric?: Fabric;
  assetMeta: (layer: Extract<Layer, { type: "image" }>) => ArtMeta | undefined;
};

const SAFE_INSET = 0.04; // 4% of the area width on every edge
const MM_PER_IN = 25.4;

function luminance(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((v >> 16) & 255) + 0.7152 * f((v >> 8) & 255) + 0.0722 * f(v & 255);
}
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };

export function runPreflight({ sides, colour, areas, fabric, assetMeta }: PreflightInput): { verdict: Verdict; checks: Check[] } {
  const checks: Check[] = [];
  const add = (c: Omit<Check, "title" | "detail" | "msg"> & { t: Key; tv?: Vars; d: Key; dv?: Vars }) => {
    const title = { key: c.t, vars: c.tv }, detail = { key: c.d, vars: c.dv };
    checks.push({ id: c.id, level: c.level, side: c.side, layerId: c.layerId, title: renderMsg("en", title), detail: renderMsg("en", detail), msg: { title, detail } });
  };
  let anyArt = false;
  const fills = new Set<string>();

  for (const area of areas) {
    const layers = (sides[area.key] ?? []).filter((l) => !l.hidden);
    if (!layers.length) continue;
    anyArt = true;
    const mmPerUnit = area.widthMm / AREA_W;
    const areaH = AREA_W * (area.heightMm / area.widthMm);
    const inset = AREA_W * SAFE_INSET;
    const size = { w: cm(area.widthMm), h: cm(area.heightMm) };
    if (area.freeFlow) add({ side: area.key, id: `flow-${area.key}`, level: "info", t: "pf.flow.t", tv: { area: area.key }, d: "pf.flow.d" });

    for (const l of layers) {
      const b = layerBounds(l);
      const where = { side: area.key, layerId: l.id };
      const label = l.type === "text" ? `“${l.text.split("\n")[0]!.slice(0, 24)}”` : l.type === "image" ? l.name : l.type === "graphic" ? "{graphic}" : "{shape}";
      const L = { label };

      // ── print-area compatibility, size cap & safe zone
      if (b.x1 < 0 || b.y1 < 0 || b.x0 > AREA_W || b.y0 > areaH) add({ ...where, id: `out-${l.id}`, level: "blocked", t: "pf.out.t", tv: L, d: area.freeFlow ? "pf.out.garment" : "pf.out.area", dv: { area: area.key } });
      else if (area.freeFlow) { /* all-over print bleeds by design: no crop or safe-margin warnings */ }
      else if (b.w > AREA_W + 1 || b.h > areaH + 1) add({ ...where, id: `cap-${l.id}`, level: "attention", t: fabric && fabric !== "other" ? "pf.cap.tFor" : "pf.cap.t", tv: { ...L, ...size, fabric: fabric ?? "" }, d: "pf.cap.d", dv: { pw: Math.round(b.w * mmPerUnit), ph: Math.round(b.h * mmPerUnit), area: area.key } });
      else if (b.x0 < -1 || b.y0 < -1 || b.x1 > AREA_W + 1 || b.y1 > areaH + 1) add({ ...where, id: `crop-${l.id}`, level: "attention", t: "pf.crop.t", tv: L, d: "pf.crop.d", dv: { area: area.key, ...size } });
      else if (b.x0 < inset || b.y0 < inset || b.x1 > AREA_W - inset || b.y1 > areaH - inset) add({ ...where, id: `safe-${l.id}`, level: "attention", t: "pf.safe.t", tv: L, d: "pf.safe.d" });

      // ── visibility against the fabric
      if (l.type !== "image") {
        fills.add(l.fill.toLowerCase());
        if (contrast(l.fill, colour) < 1.35) add({ ...where, id: `contrast-${l.id}`, level: "attention", t: "pf.contrast.t", tv: L, d: "pf.contrast.d", dv: { hex: l.fill.toUpperCase() } });
      }

      if (l.type === "text") {
        const capMm = l.size * 0.7 * mmPerUnit;
        if (capMm < 2) add({ ...where, id: `tiny-${l.id}`, level: "blocked", t: "pf.tiny.t", tv: L, d: "pf.tiny.d", dv: { mm: capMm.toFixed(1) } });
        else if (capMm < 3.2) add({ ...where, id: `small-${l.id}`, level: "attention", t: "pf.small.t", tv: L, d: "pf.small.d", dv: { mm: capMm.toFixed(1) } });
        if (l.weight <= 300 && capMm < 8) add({ ...where, id: `thin-${l.id}`, level: "attention", t: "pf.thin.t", tv: L, d: "pf.thin.d" });
      }

      if (l.type === "shape") {
        const { w, h } = layerSize(l);
        const thinMm = Math.min(w, h) * mmPerUnit * (l.shape === "ring" ? 0.07 : 1);
        if (thinMm < 0.35) add({ ...where, id: `line-${l.id}`, level: "attention", t: "pf.line.t", d: "pf.line.d", dv: { mm: thinMm.toFixed(2) } });
      }

      if (l.type === "image") {
        const meta = assetMeta(l);
        const widthIn = (l.w * mmPerUnit) / MM_PER_IN;
        if (l.vector) add({ ...where, id: `vec-${l.id}`, level: "ok", t: "pf.vec.t", tv: L, d: "pf.vec.d" });
        else {
          const ppi = Math.round(l.naturalW / widthIn);
          const px = { w: l.naturalW, h: l.naturalH, mm: Math.round(l.w * mmPerUnit), ppi };
          if (ppi < 72) add({ ...where, id: `res-${l.id}`, level: "blocked", t: "pf.resLow.t", tv: L, d: "pf.resLow.d", dv: px });
          else if (ppi < 150) add({ ...where, id: `res-${l.id}`, level: "attention", t: "pf.resMid.t", tv: L, d: "pf.resMid.d", dv: px });
          else add({ ...where, id: `res-${l.id}`, level: "ok", t: "pf.resOk.t", tv: L, d: "pf.resOk.d", dv: px });
        }
        if (meta) {
          if (meta.colourSpace === "CMYK") add({ ...where, id: `cmyk-${l.id}`, level: "attention", t: "pf.cmyk.t", tv: L, d: "pf.cmyk.d" });
          if (!meta.vector && meta.solidBackground && contrast("#ffffff", colour) > 1.15) add({ ...where, id: `bg-${l.id}`, level: "attention", t: "pf.bg.t", tv: L, d: "pf.bg.d" });
          if (meta.dpi && !meta.vector && meta.dpi < 100) add({ ...where, id: `dpi-${l.id}`, level: "info", t: "pf.dpi.t", tv: { ...L, dpi: meta.dpi }, d: "pf.dpi.d" });
          if (Math.abs(l.w / l.h - meta.naturalW / meta.naturalH) > 0.02) add({ ...where, id: `aspect-${l.id}`, level: "attention", t: "pf.aspect.t", tv: L, d: "pf.aspect.d" });
        }
      }
    }
  }

  if (!anyArt) add({ id: "empty", level: "info", t: "pf.empty.t", d: "pf.empty.d" });
  if (fills.size > 4) add({ id: "colours", level: "info", t: "pf.colours.t", tv: { n: fills.size }, d: "pf.colours.d" });

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
    if (nearest.d > 60) {
      const title = { key: "pf.brand.t" as Key, vars: { hex: l.fill.toUpperCase() } }, detail = { key: "pf.brand.d" as Key, vars: { name: nearest.p.name || "{unnamed}", hex: nearest.p.hex.toUpperCase() } };
      out.push({ id: `brand-${l.id}`, level: "attention", side, layerId: l.id, title: renderMsg("en", title), detail: renderMsg("en", detail), msg: { title, detail } });
    }
  }
  return out;
}

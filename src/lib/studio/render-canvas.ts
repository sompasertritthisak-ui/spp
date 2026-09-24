import type { GarmentKey } from "@/content/types";
import { GARMENT_BOX, getSide, isDark, shade, toSvgPath } from "@/lib/garments";
import { AREA_W, FONT_META, FONT_VAR, type ImageLayer, type Layer, type TextLayer } from "./schema";
import { GRAPHICS, shapePath } from "./shapes";

/**
 * Canvas renderer for a garment side. Mirrors <DesignThumb>'s SVG output but
 * draws with the 2D API, because exports and 3D textures need real pixels and
 * a canvas can use the page's already-loaded webfonts (an <img>-rasterised SVG
 * cannot).
 */
export type ImageSource = (layer: ImageLayer) => CanvasImageSource | undefined;

export function fontFamily(key: TextLayer["font"]) {
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(FONT_VAR[key]).trim();
  const g = FONT_META[key].generic;
  const fallback = g === "serif" ? "Georgia, serif" : g === "monospace" ? "ui-monospace, monospace" : g === "cursive" ? "'Brush Script MT', cursive" : "Arial, sans-serif";
  return v ? `${v}, ${fallback}` : fallback;
}

export function drawLayer(ctx: CanvasRenderingContext2D, l: Layer, images: ImageSource) {
  if (l.hidden) return;
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(((l.angle ?? 0) * Math.PI) / 180);
  ctx.globalAlpha *= l.opacity ?? 1;

  if (l.type === "text") {
    ctx.font = `${l.italic ? "italic " : ""}${l.weight} ${l.size}px ${fontFamily(l.font)}`;
    ctx.fillStyle = l.fill;
    ctx.textBaseline = "middle";
    const lines = l.text.split("\n");
    const lh = l.size * 1.08;
    const track = ((l.tracking ?? 0) / 1000) * l.size;
    lines.forEach((line, i) => drawTrackedLine(ctx, line, (i - (lines.length - 1) / 2) * lh, track, l.align ?? "center"));
  } else if (l.type === "shape") {
    ctx.fillStyle = l.fill;
    ctx.fill(new Path2D(shapePath(l.shape, l.w, l.h)), "evenodd");
  } else if (l.type === "graphic") {
    const g = GRAPHICS[l.graphic];
    if (g) {
      ctx.scale(l.w / 100, l.h / 100);
      ctx.fillStyle = l.fill;
      ctx.fill(new Path2D(g.d), "evenodd");
    }
  } else {
    const src = images(l);
    if (src) ctx.drawImage(src, -l.w / 2, -l.h / 2, l.w, l.h);
    else {
      ctx.strokeStyle = "#888";
      ctx.setLineDash([12, 8]);
      ctx.lineWidth = 3;
      ctx.strokeRect(-l.w / 2, -l.h / 2, l.w, l.h);
    }
  }
  ctx.restore();
}

/** Letter-spacing that works everywhere: native where supported (keeps kerning), per-glyph otherwise. */
function drawTrackedLine(ctx: CanvasRenderingContext2D, line: string, y: number, track: number, align: "left" | "center" | "right") {
  // (older Safari lacks canvas letterSpacing; ask at runtime without letting TS narrow ctx away)
  const native = "letterSpacing" in (ctx as object);
  if (!track || native) {
    if (native) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${track}px`;
    // Like SVG, native canvas letter-spacing keeps the trailing advance, so both renderers centre identically.
    ctx.textAlign = align;
    ctx.fillText(line, 0, y);
    return;
  }
  const chars = [...line];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * chars.length;
  let x = align === "center" ? -total / 2 : align === "right" ? -total : 0;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i]! + track;
  });
}

export type RenderSideOpts = {
  garment: GarmentKey;
  side: string;
  colour: string;
  layers: Layer[];
  images: ImageSource;
  /** output pixels per garment-box unit */
  scale: number;
  shading?: boolean;
  guides?: boolean;
};

/** Draws the garment + artwork into ctx at the origin, occupying GARMENT_BOX × scale pixels. */
export function renderSide(ctx: CanvasRenderingContext2D, o: RenderSideOpts) {
  const g = getSide(o.garment, o.side);
  const dark = isDark(o.colour);
  const seam = dark ? shade(o.colour, 0.22) : shade(o.colour, -0.2);
  const trim = dark ? shade(o.colour, 0.08) : shade(o.colour, -0.09);
  const body = new Path2D(toSvgPath(g.body));

  ctx.save();
  ctx.scale(o.scale, o.scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.fillStyle = o.colour;
  ctx.fill(body);

  if (o.shading !== false) {
    // soft volume: darker flanks, a light ridge down the centre, a touch of shadow under the collar
    ctx.save();
    ctx.clip(body);
    const flank = ctx.createLinearGradient(0, 0, GARMENT_BOX.w, 0);
    const d = dark ? "0,0,0" : "20,16,8";
    flank.addColorStop(0, `rgba(${d},.28)`);
    flank.addColorStop(0.22, `rgba(${d},.05)`);
    flank.addColorStop(0.5, "rgba(255,255,255,.07)");
    flank.addColorStop(0.78, `rgba(${d},.05)`);
    flank.addColorStop(1, `rgba(${d},.28)`);
    ctx.fillStyle = flank;
    ctx.fillRect(0, 0, GARMENT_BOX.w, GARMENT_BOX.h);
    const fall = ctx.createLinearGradient(0, 0, 0, GARMENT_BOX.h);
    fall.addColorStop(0, "rgba(255,255,255,.06)");
    fall.addColorStop(1, `rgba(${d},.2)`);
    ctx.fillStyle = fall;
    ctx.fillRect(0, 0, GARMENT_BOX.w, GARMENT_BOX.h);
    ctx.restore();
  }

  ctx.strokeStyle = seam;
  ctx.lineWidth = 3;
  ctx.stroke(body);
  for (const t of g.trims) {
    const p = new Path2D(t);
    ctx.fillStyle = trim;
    ctx.fill(p);
    ctx.lineWidth = 2.5;
    ctx.stroke(p);
  }
  ctx.lineWidth = 2.5;
  for (const s of g.seams) ctx.stroke(new Path2D(s));

  ctx.save();
  ctx.beginPath();
  ctx.rect(g.area.x, g.area.y, g.area.w, g.area.h);
  ctx.clip();
  ctx.translate(g.area.x, g.area.y);
  ctx.scale(g.area.w / AREA_W, g.area.w / AREA_W);
  for (const l of o.layers) drawLayer(ctx, l, o.images);
  ctx.restore();

  if (o.guides) {
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.3)";
    ctx.strokeRect(g.area.x, g.area.y, g.area.w, g.area.h);
  }
  ctx.restore();
}

/** Artwork only, on a transparent canvas — used for 3D decals. Returns the canvas sized to the print area. */
export function renderArtwork(layers: Layer[], images: ImageSource, areaAspect: number, px = 1024): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = px;
  c.height = Math.round(px * areaAspect);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.scale(px / AREA_W, px / AREA_W);
    for (const l of layers) drawLayer(ctx, l, images);
  }
  return c;
}

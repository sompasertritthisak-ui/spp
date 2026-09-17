import { fontFamily } from "./render-canvas";
import type { Layer } from "./schema";

let ctx: CanvasRenderingContext2D | null = null;
const measurer = () => (ctx ??= document.createElement("canvas").getContext("2d"));

/** Unrotated size of a layer in area units. Text is measured with the real webfont. */
export function layerSize(l: Layer): { w: number; h: number } {
  if (l.type !== "text") return { w: l.w, h: l.h };
  const lines = l.text.split("\n");
  const h = lines.length * l.size * 1.08;
  const c = typeof document === "undefined" ? null : measurer();
  if (!c) return { w: l.size * 0.55 * Math.max(...lines.map((x) => x.length), 1), h };
  c.font = `${l.italic ? "italic " : ""}${l.weight} ${l.size}px ${fontFamily(l.font)}`;
  const track = ((l.tracking ?? 0) / 1000) * l.size;
  const w = Math.max(...lines.map((line) => c.measureText(line).width + track * [...line].length), l.size * 0.3);
  return { w, h };
}

/** Axis-aligned bounds of the rotated layer, in area units. */
export function layerBounds(l: Layer) {
  const { w, h } = layerSize(l);
  const a = ((l.angle ?? 0) * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const bw = w * c + h * s, bh = w * s + h * c;
  return { x0: l.x - bw / 2, y0: l.y - bh / 2, x1: l.x + bw / 2, y1: l.y + bh / 2, w: bw, h: bh };
}

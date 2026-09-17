import { GARMENT_BOX, GARMENTS } from "@/lib/garments";
import { LOGO_DOT, LOGO_PATHS } from "@/components/brand/Logo";
import { renderSide, type ImageSource } from "./render-canvas";
import { usedSides, type DesignDoc } from "./schema";

/**
 * Watermarked mockup export.
 *  · PREVIEW resolution only (≈1600px wide) — never production artwork.
 *  · Tiled diagonal watermark across the garments, so cropping it out is not practical.
 *  · Stamped with the Design ID and export date so SPP can find the exact design.
 * The customer's original uploads are never embedded at full resolution: image
 * layers are drawn from the already-downscaled editor bitmaps.
 */
export type ExportOpts = { doc: DesignDoc; name: string; designRef: string | null; productName: string; images: ImageSource; branding?: boolean };

const INK = "#0b0b0c", PAPER = "#f3f0e8", YELLOW = "#ffd60a", FOG = "#a19e97";

export function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, stroke: string) {
  const k = h / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 20;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  for (const d of Object.values(LOGO_PATHS)) ctx.stroke(new Path2D(d));
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.arc(LOGO_DOT.cx, LOGO_DOT.cy, LOGO_DOT.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Tiled diagonal watermark — dense enough that it cannot be cropped or cloned out in a minute. */
export function stampWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, designRef: string | null) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 30px ui-monospace, Menlo, monospace`;
  const mark = `SPP PREVIEW   ·   ${designRef ?? "NOT SAVED"}   ·   `;
  const step = ctx.measureText(mark).width;
  for (let y = -H; y < H; y += 150) {
    for (let x = -W * 1.2 + (Math.round(y / 150) % 2 ? step / 2 : 0); x < W * 1.2; x += step) {
      ctx.fillStyle = "rgba(255,255,255,.11)";
      ctx.fillText(mark, x, y);
      ctx.fillStyle = "rgba(0,0,0,.11)";
      ctx.fillText(mark, x + 1.5, y + 1.5);
    }
  }
  ctx.restore();
}

export const toPngBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Export failed."))), "image/png"));

export async function exportMockup(o: ExportOpts): Promise<Blob> {
  await document.fonts?.ready;
  const garment = GARMENTS[o.doc.garment];
  const withArt = usedSides(o.doc.sides);
  // Always show front + back when the garment has both — a buyer wants to see the whole piece.
  const main = garment.sides.filter((s) => s.key === "front" || s.key === "back" || s.key === "panel").map((s) => s.key);
  const extras = garment.sides.filter((s) => s.key.includes("sleeve") && withArt.includes(s.key)).map((s) => s.key);

  const W = 1600, pad = 72, head = 150, foot = 132;
  const colW = (W - pad * 2 - (main.length - 1) * 40) / main.length;
  const scale = Math.min(colW / GARMENT_BOX.w, 0.78);
  const gH = GARMENT_BOX.h * scale;
  const extraH = extras.length ? 330 : 0;
  const H = Math.round(head + gH + 70 + extraH + foot);

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  // ground
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, head + gH / 2, 40, W / 2, head + gH / 2, W * 0.62);
  glow.addColorStop(0, "rgba(255,255,255,.085)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // header
  if (o.branding !== false) drawLogo(ctx, pad, 52, 40, PAPER);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = FOG;
  ctx.font = `500 17px ui-monospace, Menlo, monospace`;
  ctx.textAlign = "right";
  ctx.fillText("SPP STUDIO  ·  MOCKUP PREVIEW", W - pad, 66);
  ctx.fillStyle = PAPER;
  ctx.fillText(o.designRef ?? "UNSAVED DESIGN", W - pad, 92);

  // garments
  main.forEach((key, i) => {
    const x = pad + i * (colW + 40) + (colW - GARMENT_BOX.w * scale) / 2;
    ctx.save();
    ctx.translate(x, head);
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 26;
    renderSide(ctx, { garment: o.doc.garment, side: key, colour: o.doc.colour, layers: o.doc.sides[key] ?? [], images: o.images, scale });
    ctx.restore();
    ctx.fillStyle = FOG;
    ctx.font = `500 16px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.fillText((garment.sides.find((s) => s.key === key)?.label ?? key).toUpperCase(), x + (GARMENT_BOX.w * scale) / 2, head + gH + 40);
  });

  extras.forEach((key, i) => {
    const s = 0.27, x = W / 2 + (i - (extras.length - 1) / 2) * 340 - (GARMENT_BOX.w * s) / 2, y = head + gH + 60;
    ctx.save();
    ctx.translate(x, y);
    renderSide(ctx, { garment: o.doc.garment, side: key, colour: o.doc.colour, layers: o.doc.sides[key] ?? [], images: o.images, scale: s });
    ctx.restore();
    ctx.fillStyle = FOG;
    ctx.textAlign = "center";
    ctx.fillText(key.replace("-", " ").toUpperCase(), x + (GARMENT_BOX.w * s) / 2, y + GARMENT_BOX.h * s + 4);
  });

  stampWatermark(ctx, W, H, o.designRef);

  // footer
  const fy = H - foot + 30;
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, fy - 22);
  ctx.lineTo(W - pad, fy - 22);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = PAPER;
  ctx.font = `600 24px ${getComputedStyle(document.documentElement).getPropertyValue("--font-bricolage") || "Arial"}, Arial, sans-serif`;
  ctx.fillText(o.name.slice(0, 60), pad, fy + 14);
  ctx.fillStyle = FOG;
  ctx.font = `500 15px ui-monospace, Menlo, monospace`;
  ctx.fillText(`${o.productName.toUpperCase()}  ·  ${o.doc.colour.toUpperCase()}${o.doc.size ? `  ·  SIZE ${o.doc.size}` : ""}  ·  ${withArt.length ? withArt.map((k) => k.replace("-", " ").toUpperCase()).join(" + ") : "NO ARTWORK"}`, pad, fy + 44);
  ctx.textAlign = "right";
  ctx.fillText(`EXPORTED ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()).toUpperCase()}`, W - pad, fy + 14);
  ctx.fillText("PREVIEW ONLY · COLOURS ARE INDICATIVE · NOT FOR PRODUCTION", W - pad, fy + 44);
  // CMYK bar
  ["#00aeef", "#ec008c", YELLOW, "#2b2b2b"].forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(i * (W / 4), H - 8, W / 4, 8); });

  return toPngBlob(c);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

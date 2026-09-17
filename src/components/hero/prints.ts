/**
 * Canvas "plates" for the hero objects. Each function paints one print with
 * the visitor's brand name; the scene uploads them as textures. Keeping this
 * free of three.js means the 2D fallback can reuse exactly the same artwork.
 */
export type PrintKind = "tee" | "billboard" | "poster" | "cup" | "tote";

const INK = "#0b0b0c";
const YELLOW = "#ffd60a";
const PAPER = "#f3f0e8";

export function fontStack(varName: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

/** Largest font size (px) at which `text` fits `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxWidth: number, maxPx: number, minPx = 18) {
  let px = maxPx;
  ctx.font = font(px);
  const w = ctx.measureText(text).width;
  if (w > maxWidth) px = Math.max(minPx, Math.floor((px * maxWidth) / w));
  ctx.font = font(px);
  return px;
}

function cropMarks(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const L = 22;
  for (const [x, y, dx, dy] of [[inset, inset, 1, 1], [w - inset, inset, -1, 1], [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y);
    ctx.stroke();
  }
}

export const PRINT_SIZE: Record<PrintKind, [number, number]> = {
  tee: [1024, 1024],
  billboard: [1536, 768],
  poster: [768, 1088],
  cup: [1536, 512],
  tote: [896, 1024],
};

export function paintPrint(canvas: HTMLCanvasElement, kind: PrintKind, raw: string) {
  const [w, h] = PRINT_SIZE[kind];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const text = (raw.trim() || "Your brand").slice(0, 22);
  const upper = text.toUpperCase();
  const display = fontStack("--font-bricolage", "Arial Black, sans-serif");
  const serif = fontStack("--font-instrument", "Georgia, serif");
  const mono = fontStack("--font-jetbrains", "monospace");
  const D = (px: number) => `800 ${px}px ${display}`;
  const S = (px: number) => `italic 400 ${px}px ${serif}`;
  const M = (px: number) => `500 ${px}px ${mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.clearRect(0, 0, w, h);

  if (kind === "tee") {
    // transparent plate: ink on a paper-white shirt, one yellow registration dot
    ctx.fillStyle = INK;
    const px = fit(ctx, upper, D, w * 0.86, 210);
    ctx.fillText(upper, w / 2, h * 0.4);
    ctx.font = S(Math.max(48, px * 0.46));
    ctx.fillText("made real", w / 2, h * 0.4 + px * 0.8);
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.4 + px * 0.8 + 96, 17, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (kind === "billboard") {
    ctx.fillStyle = YELLOW;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INK;
    fit(ctx, upper, D, w * 0.84, 300);
    ctx.fillText(upper, w / 2, h * 0.46);
    ctx.font = M(34);
    ctx.fillText("NOW OPEN  ·  SCAN TO VISIT", w / 2, h * 0.84);
    // a token QR block, bottom-right
    const q = 96, qx = w - q - 56, qy = h - q - 40;
    ctx.fillRect(qx, qy, q, q);
    ctx.fillStyle = YELLOW;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i * 7 + j * 3 + upper.length) % 3 === 0) ctx.fillRect(qx + 8 + i * 16, qy + 8 + j * 16, 14, 14);
    cropMarks(ctx, w, h, 28, INK);
    return;
  }

  if (kind === "poster") {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, w, h * 0.5);
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.5, w * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAPER;
    fit(ctx, upper, D, w * 0.82, 130);
    ctx.fillText(upper, w / 2, h * 0.17);
    ctx.fillStyle = INK;
    ctx.font = S(84);
    ctx.fillText("grand opening", w / 2, h * 0.74);
    ctx.font = M(24);
    ctx.fillText("15 · 11 · 2026", w / 2, h * 0.84);
    cropMarks(ctx, w, h, 24, "rgba(11,11,12,.45)");
    return;
  }

  if (kind === "cup") {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INK;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    // the cup's seam is rotated to the back, so the front is the canvas centre
    fit(ctx, upper, D, w * 0.3, 120);
    ctx.fillText(upper, w / 2, h * 0.42);
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.89, 14, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // tote — natural canvas
  ctx.fillStyle = "#e6dcc5";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  const px = fit(ctx, upper, D, w * 0.78, 150);
  ctx.fillText(upper, w / 2, h * 0.44);
  ctx.fillRect(w * 0.11, h * 0.44 + px * 0.62, w * 0.78, 5);
  ctx.font = S(64);
  ctx.fillText("carry it everywhere", w / 2, h * 0.44 + px * 0.62 + 66);
}

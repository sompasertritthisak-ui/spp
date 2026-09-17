import { GARMENT_BOX, GARMENTS } from "@/lib/garments";
import { drawLogo, stampWatermark, toPngBlob } from "./export";
import { renderSide, type ImageSource } from "./render-canvas";
import type { DesignDoc } from "./schema";

/**
 * SEE IT IN THE REAL WORLD — composed scenes built from the same renderer as
 * the editor, so what the customer sees is exactly their design. Every scene is
 * watermarked and preview-resolution, like the flat mockup.
 */
export type SceneKey = "lineup" | "rail";
export const SCENES: { key: SceneKey; label: string; blurb: string }[] = [
  { key: "lineup", label: "Team line-up", blurb: "How it reads when the whole team wears it." },
  { key: "rail", label: "On the rail", blurb: "Front and back, hanging in a shop." },
];

type In = { doc: DesignDoc; designRef: string | null; images: ImageSource };

function garmentCanvas(i: In, side: string, px: number) {
  const c = document.createElement("canvas");
  const scale = px / GARMENT_BOX.w;
  c.width = px;
  c.height = Math.ceil(GARMENT_BOX.h * scale);
  const ctx = c.getContext("2d");
  if (ctx) renderSide(ctx, { garment: i.doc.garment, side, colour: i.doc.colour, layers: i.doc.sides[side] ?? [], images: i.images, scale });
  return c;
}

/** Distance fog for back-row garments: tint only the garment's own pixels. */
function dimmed(src: HTMLCanvasElement, amount: number) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = `rgba(9,9,11,${amount})`;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

const sidesOf = (i: In) => {
  const keys = GARMENTS[i.doc.garment].sides.map((s) => s.key);
  const front = keys.find((k) => k === "front" || k === "panel") ?? keys[0]!;
  return { front, back: keys.includes("back") ? "back" : front };
};

function header(ctx: CanvasRenderingContext2D, W: number, label: string, ref: string | null, ink: string, mute: string) {
  drawLogo(ctx, 64, 48, 34, ink);
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = "500 16px ui-monospace, Menlo, monospace";
  ctx.fillStyle = mute;
  ctx.fillText(`SPP STUDIO  ·  ${label.toUpperCase()}`, W - 64, 62);
  ctx.fillStyle = ink;
  ctx.fillText(ref ?? "UNSAVED DESIGN", W - 64, 86);
}

export async function renderScene(kind: SceneKey, i: In): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const W = 1600, H = 1000;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  const { front, back } = sidesOf(i);

  if (kind === "lineup") {
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, "#16161a"); wall.addColorStop(0.72, "#0e0e11"); wall.addColorStop(0.72, "#09090b"); wall.addColorStop(1, "#050506");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    const spot = ctx.createRadialGradient(W / 2, 360, 60, W / 2, 360, 900);
    spot.addColorStop(0, "rgba(255,246,220,.16)"); spot.addColorStop(1, "rgba(255,246,220,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);

    const f = garmentCanvas(i, front, 620), b = garmentCanvas(i, back, 620);
    // back row first so the centre piece overlaps its neighbours
    const row: { x: number; s: number; img: HTMLCanvasElement; dim: number }[] = [
      { x: 0.1, s: 0.62, img: b, dim: 0.5 }, { x: 0.9, s: 0.62, img: b, dim: 0.5 },
      { x: 0.28, s: 0.78, img: f, dim: 0.25 }, { x: 0.72, s: 0.78, img: f, dim: 0.25 },
      { x: 0.5, s: 1, img: f, dim: 0 },
    ];
    for (const r of row) {
      const w = f.width * r.s, h = f.height * r.s, x = W * r.x - w / 2, y = 700 - h * 0.93;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.filter = "blur(18px)";
      ctx.beginPath(); ctx.ellipse(W * r.x, 712, w * 0.36, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.drawImage(r.dim ? dimmed(r.img, r.dim) : r.img, x, y, w, h);
    }
    header(ctx, W, "Team line-up", i.designRef, "#f3f0e8", "#a19e97");
  } else {
    ctx.fillStyle = "#e9e4d8";
    ctx.fillRect(0, 0, W, H);
    const light = ctx.createRadialGradient(W * 0.5, 120, 40, W * 0.5, 300, 1000);
    light.addColorStop(0, "rgba(255,255,255,.75)"); light.addColorStop(1, "rgba(120,110,90,.22)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#cfc8b8";
    ctx.fillRect(0, 860, W, 140);
    // rail
    ctx.fillStyle = "#1b1b1f";
    ctx.fillRect(90, 186, W - 180, 12);
    ctx.fillRect(130, 120, 10, 70); ctx.fillRect(W - 140, 120, 10, 70);
    const f = garmentCanvas(i, front, 470), b = garmentCanvas(i, back, 470);
    [f, b, f, b].forEach((img, n) => {
      const cx = 250 + n * 366, rot = [-0.035, 0.02, 0.03, -0.025][n]!;
      ctx.save();
      ctx.translate(cx, 192);
      ctx.rotate(rot);
      // hanger
      ctx.strokeStyle = "#2b2b30"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, -16, 13, Math.PI * 0.9, Math.PI * 2.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-150, 62); ctx.moveTo(0, 0); ctx.lineTo(150, 62); ctx.stroke();
      ctx.shadowColor = "rgba(60,50,30,.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 24;
      ctx.drawImage(img, -img.width / 2, 22);
      ctx.restore();
    });
    header(ctx, W, "On the rail", i.designRef, "#141414", "#5d5a53");
  }

  stampWatermark(ctx, W, H, i.designRef);
  ctx.textAlign = "center";
  ctx.font = "500 14px ui-monospace, Menlo, monospace";
  ctx.fillStyle = kind === "lineup" ? "#85827c" : "#5d5a53";
  ctx.fillText("ILLUSTRATIVE VISUALISATION · PREVIEW ONLY · COLOURS ARE INDICATIVE", W / 2, H - 34);
  return c;
}

export const sceneBlob = async (kind: SceneKey, i: In) => toPngBlob(await renderScene(kind, i));

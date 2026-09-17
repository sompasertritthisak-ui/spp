/**
 * Procedural roadside scene for the artwork visualiser.
 *
 * SPP has no site photography yet, so rather than fake one this draws an
 * honest technical illustration: a generic monopole structure built to the
 * billboard's real face size, seen through a pinhole camera standing beside
 * the road. Because it is real 3D → 2D projection (metres in, pixels out),
 * the distance slider shows true apparent size — which is the whole lesson.
 */
import { drawWarped, type Pt, type Quad } from "./warp";

export type SceneOptions = {
  widthM: number;
  heightM: number;
  faces: 1 | 2;
  lit: boolean;
  night: boolean;
  /** metres from the viewer to the structure */
  distance: number;
  face: HTMLCanvasElement;
  monoFont: string;
};
export type SceneResult = { quad: Quad; faceShare: number };

type V3 = readonly [number, number, number];
const FOV = (50 * Math.PI) / 180;
const EYE = 1.6;
const YAW = (8 * Math.PI) / 180; // the face is turned slightly toward the road, as real sites are

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export const clearanceOf = (heightM: number) => Math.max(4.5, Math.min(9, heightM * 1.1));

/** Closest sensible standpoint (whole structure in frame) → a long straight-road approach. */
export function distanceRange(widthM: number, heightM: number): [number, number] {
  const tall = clearanceOf(heightM) + heightM;
  return [Math.round(Math.max(18, tall * 2, widthM * 1.9)), 300];
}

const PALETTE = {
  day: { skyTop: "#d6d0c1", skyLow: "#f3f0e8", hills: "#c2bcac", ground: "#cfc9ba", verge: "#bdb6a5", road: "#3b3b41", line: "#e8e3d7", steel: "#17171a", steelLit: "#33333a", text: "#141414", mute: "#5d5a53" },
  night: { skyTop: "#060607", skyLow: "#16161a", hills: "#0d0d0f", ground: "#0f0f11", verge: "#121215", road: "#19191d", line: "#4a4a52", steel: "#0b0b0d", steelLit: "#242429", text: "#eceae4", mute: "#85827c" },
} as const;

export function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, o: SceneOptions): SceneResult {
  const c = o.night ? PALETTE.night : PALETTE.day;
  const clear = clearanceOf(o.heightM);
  const top = clear + o.heightM;
  const camPos: V3 = [o.widthM / 2 + 5, EYE, -o.distance];
  const target: V3 = [0, top * 0.55, 0];
  const fwd = norm(sub(target, camPos));
  const right = norm(cross([0, 1, 0], fwd));
  const up = cross(fwd, right);
  const f = W / 2 / Math.tan(FOV / 2);
  const P = (p: V3): Pt => {
    const r = sub(p, camPos);
    const z = Math.max(dot(r, fwd), 0.2);
    return [W / 2 + (f * dot(r, right)) / z, H * 0.54 - (f * dot(r, up)) / z];
  };
  const poly = (pts: V3[], fill: string) => { ctx.beginPath(); pts.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };

  // ── sky, horizon, ground ────────────────────────────────────────────────
  const horizon = P([camPos[0] + fwd[0] * 1e5, EYE, camPos[2] + fwd[2] * 1e5])[1];
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, c.skyTop); sky.addColorStop(1, c.skyLow);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon + 1);
  ctx.fillStyle = c.hills;
  ctx.beginPath(); ctx.moveTo(0, horizon + 1);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, horizon - (H * 0.018) * (1.4 + Math.sin(x * 0.006 + 1.3) + 0.5 * Math.sin(x * 0.019)));
  ctx.lineTo(W, horizon + 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.ground; ctx.fillRect(0, horizon, W, H - horizon);

  // ── road (runs past the structure toward the vanishing point) ───────────
  const rx0 = o.widthM / 2 + 2.5, rx1 = rx0 + 8, zNear = camPos[2] - 40, zFar = 4000;
  poly([[rx0 - 1.2, 0, zNear], [rx1 + 1.2, 0, zNear], [rx1 + 1.2, 0, zFar], [rx0 - 1.2, 0, zFar]], c.verge);
  poly([[rx0, 0, zNear], [rx1, 0, zNear], [rx1, 0, zFar], [rx0, 0, zFar]], c.road);
  const mid = (rx0 + rx1) / 2;
  for (let z = Math.ceil((camPos[2] + 3) / 12) * 12; z < 900; z += 12) poly([[mid - 0.09, 0.01, z], [mid + 0.09, 0.01, z], [mid + 0.09, 0.01, z + 4.5], [mid - 0.09, 0.01, z + 4.5]], c.line);

  // ── structure ────────────────────────────────────────────────────────────
  const t: V3 = [Math.cos(YAW), 0, -Math.sin(YAW)];   // along the face, viewer's left → right
  const n: V3 = [Math.sin(YAW), 0, Math.cos(YAW)];    // pointing AWAY from the viewer (into the box)
  const at = (along: number, y: number, back: number): V3 => [t[0] * along + n[0] * back, y, t[2] * along + n[2] * back];
  const hw = o.widthM / 2, depth = o.faces === 2 ? 1.1 : 0.7;

  // soft contact shadow so the column sits on the ground
  ctx.save(); ctx.globalAlpha = o.night ? 0.5 : 0.18;
  poly([at(-1.6, 0.01, 0.2), at(1.6, 0.01, 0.2), at(2.4, 0.01, 2.6), at(-0.8, 0.01, 2.6)], "#000"); ctx.restore();

  const colR = Math.max(0.45, o.widthM * 0.045);
  poly([at(-colR, 0, depth / 2), at(colR, 0, depth / 2), at(colR, clear + o.heightM * 0.4, depth / 2), at(-colR, clear + o.heightM * 0.4, depth / 2)], c.steel);
  poly([at(colR * 0.2, 0, depth / 2), at(colR, 0, depth / 2), at(colR, clear, depth / 2), at(colR * 0.2, clear, depth / 2)], c.steelLit);
  poly([at(-colR * 1.6, 0, depth / 2), at(colR * 1.6, 0, depth / 2), at(colR * 1.6, 0.35, depth / 2), at(-colR * 1.6, 0.35, depth / 2)], c.steel);

  // box returns (whichever side faces the camera survives; the face covers the other)
  poly([at(hw, clear, 0), at(hw, clear, depth), at(hw, top, depth), at(hw, top, 0)], c.steelLit);
  poly([at(-hw, clear, 0), at(-hw, clear, depth), at(-hw, top, depth), at(-hw, top, 0)], c.steelLit);
  poly([at(-hw, clear, 0), at(hw, clear, 0), at(hw, clear, depth), at(-hw, clear, depth)], c.steel);

  // frame, then the printed face inset within it
  const fr = 0.18;
  poly([at(-hw - fr, clear - fr, 0), at(hw + fr, clear - fr, 0), at(hw + fr, top + fr, 0), at(-hw - fr, top + fr, 0)], c.steel);
  const quad: Quad = [P(at(-hw, top, 0)), P(at(hw, top, 0)), P(at(hw, clear, 0)), P(at(-hw, clear, 0))];
  drawWarped(ctx, o.face, o.face.width, o.face.height, quad);

  const facePath = () => { ctx.beginPath(); quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  if (o.night && !o.lit) { facePath(); ctx.fillStyle = "rgba(6,6,7,0.88)"; ctx.fill(); }
  if (!o.night) { // daylight falls off slightly toward the far edge
    const g = ctx.createLinearGradient(quad[0][0], 0, quad[1][0], 0);
    g.addColorStop(0, "rgba(255,255,255,0.05)"); g.addColorStop(1, "rgba(0,0,0,0.10)");
    facePath(); ctx.fillStyle = g; ctx.fill();
  }

  // catwalk and lamp arms
  poly([at(-hw, clear - fr, -0.75), at(hw, clear - fr, -0.75), at(hw, clear - fr - 0.12, -0.75), at(-hw, clear - fr - 0.12, -0.75)], c.steel);
  poly([at(-hw, clear - fr, 0), at(hw, clear - fr, 0), at(hw, clear - fr, -0.75), at(-hw, clear - fr, -0.75)], c.steelLit);
  if (o.lit) {
    const lamps = Math.max(3, Math.round(o.widthM / 2.5));
    for (let i = 0; i < lamps; i++) {
      const a = -hw + (o.widthM * (i + 0.5)) / lamps;
      const [bx, by] = P(at(a, clear - fr, -0.75)), [hx, hy] = P(at(a, clear + 0.1, -1.7));
      ctx.strokeStyle = c.steel; ctx.lineWidth = Math.max(1, f * 0.06 / o.distance);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke();
      const r = Math.max(1.2, (f * 0.16) / o.distance);
      ctx.fillStyle = o.night ? "#fff6d6" : c.steel;
      ctx.fillRect(hx - r, hy - r * 0.6, r * 2, r * 1.2);
      if (o.night) { // the wash each lamp throws up the face
        const [tx, ty] = P(at(a, clear + o.heightM * 0.55, 0));
        const glow = ctx.createRadialGradient(hx, hy, 0, tx, ty, (f * o.heightM * 0.9) / o.distance);
        glow.addColorStop(0, "rgba(255,244,214,0.20)"); glow.addColorStop(1, "rgba(255,244,214,0)");
        ctx.save(); facePath(); ctx.clip(); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    }
    if (o.night) { // spill onto the ground beneath
      const [gx, gy] = P(at(0, 0, -2));
      const spill = ctx.createRadialGradient(gx, gy, 0, gx, gy, (f * o.widthM * 0.8) / o.distance);
      spill.addColorStop(0, "rgba(255,244,214,0.10)"); spill.addColorStop(1, "rgba(255,244,214,0)");
      ctx.fillStyle = spill; ctx.fillRect(0, horizon, W, H - horizon);
    }
  }

  // a 1.7 m figure at the base: the only honest way to show how big ten metres is
  const [px, feet] = P(at(-hw * 0.55, 0, -2.2)), headTop = P(at(-hw * 0.55, 1.7, -2.2))[1];
  const ph = feet - headTop;
  ctx.fillStyle = o.night ? "#2b2b31" : "#26262b";
  ctx.beginPath(); ctx.arc(px, headTop + ph * 0.075, ph * 0.075, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px - ph * 0.13, headTop + ph * 0.19); ctx.lineTo(px + ph * 0.13, headTop + ph * 0.19); ctx.lineTo(px + ph * 0.08, feet); ctx.lineTo(px - ph * 0.08, feet); ctx.closePath(); ctx.fill();

  // dimension callouts, drafting-style
  const fs = Math.max(10, Math.round(W / 95));
  ctx.font = `500 ${fs}px ${o.monoFont}`; ctx.fillStyle = c.mute; ctx.strokeStyle = c.mute; ctx.lineWidth = 1; ctx.textBaseline = "middle";
  const [ax, ay] = P(at(-hw, top + fr + 0.5, 0)), [bx2, by2] = P(at(hw, top + fr + 0.5, 0));
  if (bx2 - ax > fs * 9) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.moveTo(ax, ay - 4); ctx.lineTo(ax, ay + 4); ctx.moveTo(bx2, by2 - 4); ctx.lineTo(bx2, by2 + 4); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillText(`${o.widthM} M`, (ax + bx2) / 2, (ay + by2) / 2 - fs * 0.9);
    const [hx2, hy2] = P(at(hw + fr + 0.6, top, 0)), [hx3, hy3] = P(at(hw + fr + 0.6, clear, 0));
    ctx.beginPath(); ctx.moveTo(hx2, hy2); ctx.lineTo(hx3, hy3); ctx.moveTo(hx2 - 4, hy2); ctx.lineTo(hx2 + 4, hy2); ctx.moveTo(hx3 - 4, hy3); ctx.lineTo(hx3 + 4, hy3); ctx.stroke();
    ctx.textAlign = "left"; ctx.fillText(`${o.heightM} M`, hx2 + 8, (hy2 + hy3) / 2);
  }
  ctx.textAlign = "left"; ctx.fillStyle = c.mute;
  ctx.fillText(`VIEWED FROM ${Math.round(o.distance)} M · ${o.night ? "NIGHT" : "DAY"} · ILLUSTRATIVE STRUCTURE`, fs * 1.4, H - fs * 1.6);

  return { quad, faceShare: (Math.max(quad[1][0], quad[2][0]) - Math.min(quad[0][0], quad[3][0])) / W };
}

/** The flat print itself: artwork laid onto the face's true proportions, or a labelled blank. */
export function composeFace(art: { raster: HTMLCanvasElement } | null, widthM: number, heightM: number, mode: "fit" | "fill", monoFont: string): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = 1600; cv.height = Math.round((1600 * heightM) / widthM);
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  ctx.fillStyle = "#f3f0e8"; ctx.fillRect(0, 0, cv.width, cv.height);
  if (art) {
    const { width: aw, height: ah } = art.raster;
    const k = mode === "fill" ? Math.max(cv.width / aw, cv.height / ah) : Math.min(cv.width / aw, cv.height / ah);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(art.raster, (cv.width - aw * k) / 2, (cv.height - ah * k) / 2, aw * k, ah * k);
    return cv;
  }
  ctx.fillStyle = "rgba(20,20,20,0.16)";
  for (let y = 12; y < cv.height; y += 22) for (let x = 12 + ((y / 22) % 2) * 11; x < cv.width; x += 22) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#ffd60a"; ctx.fillRect(0, 0, cv.width * 0.035, cv.height);
  ctx.fillStyle = "#141414"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.round(cv.height * 0.2)}px ${monoFont}`; ctx.fillText("YOUR ARTWORK", cv.width / 2, cv.height * 0.45);
  ctx.font = `500 ${Math.round(cv.height * 0.075)}px ${monoFont}`; ctx.fillText(`${widthM} × ${heightM} M FACE`, cv.width / 2, cv.height * 0.68);
  return cv;
}

/** Diagonal "SPP PREVIEW" field plus a caption strip: unmistakably a preview, never a proof. */
export function watermark(ctx: CanvasRenderingContext2D, W: number, H: number, caption: string, monoFont: string) {
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 7);
  ctx.font = `700 ${Math.round(W / 26)}px ${monoFont}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const stepX = W / 2.6, stepY = H / 5;
  for (let j = -6; j <= 6; j++) for (let i = -4; i <= 4; i++) {
    const x = i * stepX + (j % 2 ? stepX / 2 : 0), y = j * stepY;
    ctx.fillStyle = "rgba(255,255,255,0.20)"; ctx.fillText("SPP PREVIEW", x + 1.5, y + 1.5);
    ctx.fillStyle = "rgba(9,9,10,0.22)"; ctx.fillText("SPP PREVIEW", x, y);
  }
  ctx.restore();
  const band = Math.round(H * 0.06);
  ctx.fillStyle = "#09090a"; ctx.fillRect(0, H - band, W, band);
  ctx.fillStyle = "#ffd60a"; ctx.fillRect(0, H - band, band * 0.18, band);
  ctx.fillStyle = "#f6f4ef"; ctx.font = `500 ${Math.round(band * 0.34)}px ${monoFont}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(caption, band * 0.6, H - band / 2);
}

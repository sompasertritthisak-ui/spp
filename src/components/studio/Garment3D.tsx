"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GARMENT_BOX, getSide, isDark, shade, sleeveWrapOf, type Cmd, type SleeveWrap } from "@/lib/garments";
import { art } from "@/lib/studio/persistence";
import { renderRegion, renderSide } from "@/lib/studio/render-canvas";
import { sideHasArt, type DesignDoc } from "@/lib/studio/schema";

/**
 * Realistic-ish 3D preview without a downloaded model: the garment outline is
 * inflated into a soft cushion (distance-to-edge profile), the whole side —
 * fabric colour, seams, trims and the live artwork — is baked into one texture
 * that wraps that surface, a procedural cotton weave drives a normal map, and
 * a room environment plus a contact shadow light it like a product shot.
 *
 * Sleeves are rounded into tubes and carry their own unwrapped texture: the
 * outside of the arm is the sleeve's upper edge, so a sleeve print is centred
 * on it, half on the front of the tube and half on the back, laid out along
 * the curved surface so it stays sharp and undistorted seen side-on.
 */
const S = 0.0042; // garment units → world
const PUFF = 0.36; // how far the fabric swells at the centre (world units)
const EDGE = 150; // units over which the edge rounds off
const GRID = { nx: 100, ny: 112 };
const SLEEVE_DEPTH = 64; // how far a sleeve swells at its centre line (garment units): nearly round
const ATLAS = { pad: 40, gap: 36, px: 3 }; // sleeve texture: margins in garment units, pixels per unit
const TEX_W = 1536;

type Pt = [number, number];

/** Flatten M/L/C/Z commands into a closed polygon (garment units). */
function outline(cmds: Cmd[]): Pt[] {
  const pts: Pt[] = [];
  let cur: Pt = [0, 0];
  for (const c of cmds) {
    if (c[0] === "M" || c[0] === "L") { cur = [c[1], c[2]]; pts.push(cur); }
    else if (c[0] === "C") {
      const [x0, y0] = cur;
      for (let i = 1; i <= 14; i++) {
        const t = i / 14, u = 1 - t;
        pts.push([u * u * u * x0 + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * y0 + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]]);
      }
      cur = [c[5], c[6]];
    }
  }
  return pts;
}

function inside(poly: Pt[], x: number, y: number) {
  let on = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) on = !on;
  }
  return on;
}

/** Nearest point on the polygon and its distance. */
function nearest(poly: Pt[], x: number, y: number): { d: number; p: Pt } {
  let best = Infinity, bp: Pt = [x, y];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j]!, [bx, by] = poly[i]!;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    const px = ax + t * dx, py = ay + t * dy, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) { best = d; bp = [px, py]; }
  }
  return { d: Math.sqrt(best), p: bp };
}

/** How far the soft body swells at a point, in garment units. */
function bodySwell(poly: Pt[], x: number, y: number) {
  if (!inside(poly, x, y)) return 0;
  const d = nearest(poly, x, y).d;
  return (PUFF * (1 - (1 - Math.min(d / EDGE, 1)) ** 2) + 0.07 * Math.min(d / 420, 1)) / S;
}

/* ── Sleeves ───────────────────────────────────────────────────────────────
   Everything here is worked out for the wearer's LEFT sleeve as drawn in the
   front view (the viewer's right) and mirrored for the other one. */
const round = (t: number) => Math.sqrt(Math.max(0, 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 2));
const smooth = (t: number) => { const c = Math.min(Math.max(t, 0), 1); return c * c * (3 - 2 * c); };
const mirror = (x: number) => GARMENT_BOX.w - x;

/** A sleeve's own coordinates: `a` down the fold from the shoulder, `p` across it towards the underarm. */
function sleeveFrame(w: SleeveWrap) {
  const len = Math.hypot(w.cuff[0] - w.shoulder[0], w.cuff[1] - w.shoulder[1]);
  const ax = (w.cuff[0] - w.shoulder[0]) / len, ay = (w.cuff[1] - w.shoulder[1]) / len;
  const at = (x: number, y: number) => { const dx = x - w.shoulder[0], dy = y - w.shoulder[1]; return { a: dx * ax + dy * ay, p: -dx * ay + dy * ax }; };
  const xy = (a: number, p: number): Pt => [w.shoulder[0] + a * ax - p * ay, w.shoulder[1] + a * ay + p * ax];
  const half = w.width / 2;
  // the armhole seam as "how far down the fold it lies" for each step across the sleeve
  const seam = outline(w.armhole).map(([x, y]) => at(x, y)).sort((m, n) => m.p - n.p);
  const arm = (p: number) => {
    if (p <= seam[0]!.p) return seam[0]!.a;
    for (let i = 1; i < seam.length; i++) if (p <= seam[i]!.p) { const m = seam[i - 1]!, n = seam[i]!; return m.a + ((n.a - m.a) * (p - m.p)) / (n.p - m.p || 1); }
    return seam[seam.length - 1]!.a;
  };
  const hem = at(w.underarm[0], w.underarm[1]).a;
  // distance along the tube's surface for each step across the flat sleeve
  const tube = (p: number) => SLEEVE_DEPTH * round(Math.min(p, w.width - p) / half);
  const steps = 480, table = [0];
  for (let i = 1; i <= steps; i++) table.push(table[i - 1]! + Math.hypot(w.width / steps, tube((i / steps) * w.width) - tube(((i - 1) / steps) * w.width)));
  const arc = (p: number) => {
    const f = (Math.min(Math.max(p, 0), w.width) / w.width) * steps, i = Math.min(Math.floor(f), steps - 1);
    return table[i]! + (table[i + 1]! - table[i]!) * (f - i);
  };
  return {
    len, half, width: w.width, at, xy, arm, arc, tube, girth: table[steps]!,
    /** where the sleeve ends at the cuff, for each step across it */
    end: (p: number) => len + (hem - len) * Math.min(Math.max(p / w.width, 0), 1),
    /** 0 on the body, 1 on the sleeve proper, easing across the armhole */
    weight: (a: number, p: number) => (p > w.width + 1 ? 0 : smooth((a - arm(p)) / 70)),
  };
}
type Frame = ReturnType<typeof sleeveFrame>;

/** Size of the sleeve texture in garment units: two unwrapped half-tubes side by side. */
const atlasSize = (f: Frame) => ({ w: f.girth * 2 + ATLAS.gap * 3, h: f.len + ATLAS.pad * 2 });
/** Where a half-tube sits: the one on the right of the face keeps its fold on the right, so nothing is mirrored. */
const atlasX = (f: Frame, onRight: boolean, arc: number) => (onRight ? ATLAS.gap + f.girth - arc : ATLAS.gap * 2 + f.girth + arc);

/** Height of the cloth at a point of the flat outline: soft body, easing into a round tube along the sleeve. */
function heightAt(poly: Pt[], f: Frame | null, x: number, y: number) {
  const z = bodySwell(poly, x, y);
  if (!f) return z;
  const { a, p } = f.at(x >= GARMENT_BOX.w / 2 ? x : mirror(x), y);
  const k = f.weight(a, p);
  return k ? z * (1 - k) + f.tube(Math.min(Math.max(p, 0), f.width)) * k : z;
}

/** One inflated side of the garment, without its sleeves. `back` mirrors the swell to −z and un-mirrors the texture. */
function inflate(cmds: Cmd[], back: boolean, wrap: SleeveWrap | null): THREE.BufferGeometry {
  const poly = outline(cmds);
  const f = wrap ? sleeveFrame(wrap) : null;
  const { nx, ny } = GRID;
  const W = GARMENT_BOX.w, H = GARMENT_BOX.h;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const keep: boolean[] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = (i / nx) * W, y = (j / ny) * H;
      const inn = inside(poly, x, y);
      if (!inn) [x, y] = nearest(poly, x, y).p; // snap outside corners onto the silhouette so the boundary cells close the shape
      const z = inn ? heightAt(poly, f, x, y) * S : 0;
      keep.push(inn);
      pos.push((x - W / 2) * S, (H / 2 - y) * S, back ? -z : z);
      uv.push(back ? 1 - x / W : x / W, 1 - y / H);
    }
  }
  // cells that belong to a sleeve are left out: the sleeve is its own, finer surface
  const onSleeve = (cx: number, cy: number) => {
    if (!f) return false;
    const [qx, qy] = inside(poly, cx, cy) ? [cx, cy] : nearest(poly, cx, cy).p;
    const { a, p } = f.at(qx >= W / 2 ? qx : mirror(qx), qy);
    return p > -2 && p < f.width + 2 && a > f.arm(p) + 6 && a < f.end(p) + 8;
  };
  const at = (i: number, j: number) => j * (nx + 1) + i;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      if (!keep[a] && !keep[b] && !keep[c] && !keep[d]) continue;
      if (onSleeve(((i + 0.5) / nx) * W, ((j + 0.5) / ny) * H)) continue;
      // +x runs with i, world y runs against j, so a→b→c winds clockwise seen from +z: reverse it for the front face.
      if (back) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Both sleeves of one face as half-tubes, meshed along the sleeve itself (round the arm × down the arm) so the
 * rounded outer edge is smooth, and mapped onto the sleeve texture. They start a little inside the armhole and
 * sit a hair above the body there, so the join is covered.
 */
function sleeveGeometry(cmds: Cmd[], back: boolean, wrap: SleeveWrap): THREE.BufferGeometry {
  const poly = outline(cmds), f = sleeveFrame(wrap), size = atlasSize(f);
  const W = GARMENT_BOX.w, H = GARMENT_BOX.h, NA = 44, NT = 30;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const left of [false, true]) {
    // a point of the surface in world units; `th` runs round the arm from the fold (0) to the underarm (π)
    const start = (p: number) => f.arm(p) - 16 * Math.min(1, p / 25, (f.width - p) / 25);
    const point = (u: number, th: number): [number, number, number] => {
      const p = f.half * (1 - Math.cos(th)), a = start(p) + (f.end(p) - start(p)) * u;
      const [x, y] = f.xy(a, p), k = f.weight(a, p);
      // a hair proud of the body where the two overlap at the armhole
      const z = bodySwell(poly, x, y) * (1 - k) + SLEEVE_DEPTH * Math.sin(th) * k + 0.8 * Math.sin(th);
      return [((left ? mirror(x) : x) - W / 2) * S, (H / 2 - y) * S, (back ? -z : z) * S];
    };
    const base = pos.length / 3;
    for (let i = 0; i <= NA; i++) {
      for (let j = 0; j <= NT; j++) {
        const u = i / NA, th = (j / NT) * Math.PI;
        const P = point(u, th);
        const p = f.half * (1 - Math.cos(th)), a = start(p) + (f.end(p) - start(p)) * u;
        // normal from the surface itself, so the round edge shades as a curve and meets the other face cleanly
        const du = 0.01, dt = 0.03;
        const A0 = point(Math.max(u - du, 0), th), A1 = point(Math.min(u + du, 1), th);
        const T0 = point(u, Math.max(th - dt, 0)), T1 = point(u, Math.min(th + dt, Math.PI));
        const n = new THREE.Vector3(A1[0] - A0[0], A1[1] - A0[1], A1[2] - A0[2]).cross(new THREE.Vector3(T1[0] - T0[0], T1[1] - T0[1], T1[2] - T0[2]));
        const [mx, my] = f.xy(a, f.half);
        const out = new THREE.Vector3(P[0] - ((left ? mirror(mx) : mx) - W / 2) * S, P[1] - (H / 2 - my) * S, P[2] + (back ? -1e-4 : 1e-4));
        if (n.lengthSq() < 1e-14) n.copy(out);
        if (n.dot(out) < 0) n.negate();
        n.normalize();
        pos.push(...P);
        nor.push(n.x, n.y, n.z);
        uv.push(atlasX(f, left === back, f.arc(p)) / size.w, 1 - (ATLAS.pad + a) / size.h);
      }
    }
    const at = (i: number, j: number) => base + i * (NT + 1) + j;
    const v = (k: number) => new THREE.Vector3(pos[k * 3]!, pos[k * 3 + 1]!, pos[k * 3 + 2]!);
    for (let i = 0; i < NA; i++) {
      for (let j = 0; j < NT; j++) {
        const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
        // wind every cell so it faces the way its normals point
        const face = v(b).sub(v(a)).cross(v(c).sub(v(a)));
        const m = new THREE.Vector3(nor[c * 3]! + nor[a * 3]!, nor[c * 3 + 1]! + nor[a * 3 + 1]!, nor[c * 3 + 2]! + nor[a * 3 + 2]!);
        if (face.dot(m) >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The dark inside of a sleeve, set just inside the cuff, so the opening reads as an opening. */
function cuffGeometry(wrap: SleeveWrap, left: boolean): THREE.BufferGeometry {
  const f = sleeveFrame(wrap), W = GARMENT_BOX.w, H = GARMENT_BOX.h, N = 40;
  const pos: number[] = [], idx: number[] = [];
  const put = (p: number, z: number) => { const [x, y] = f.xy(f.end(p) - 5, p); pos.push(((left ? mirror(x) : x) - W / 2) * S, (H / 2 - y) * S, z * S); };
  put(f.half, 0);
  for (let i = 0; i <= N; i++) { const t = (i / N) * Math.PI * 2; put(f.half - (f.half - 1.5) * Math.cos(t), (SLEEVE_DEPTH - 1.5) * Math.sin(t)); }
  for (let i = 1; i <= N; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Procedural cotton weave as a tangent-space normal map (tiles). */
function weaveNormalMap(): THREE.CanvasTexture {
  const n = 128, c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d")!;
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const wx = Math.sin((x / n) * Math.PI * 16), wy = Math.sin((y / n) * Math.PI * 16);
    h[y * n + x] = 0.5 + 0.22 * wx * wy + 0.06 * Math.sin((x + y) * 0.9) * Math.cos(x * 0.37 - y * 0.51);
  }
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = h[y * n + ((x + n - 1) % n)]!, r = h[y * n + ((x + 1) % n)]!, u = h[((y + n - 1) % n) * n + x]!, d = h[((y + 1) % n) * n + x]!;
    const nx = (l - r) * 2.2, ny = (u - d) * 2.2, nz = 1;
    const len = Math.hypot(nx, ny, nz), o = (y * n + x) * 4;
    img.data[o] = ((nx / len) * 0.5 + 0.5) * 255; img.data[o + 1] = ((ny / len) * 0.5 + 0.5) * 255; img.data[o + 2] = ((nz / len) * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18, 20);
  return t;
}

/** The unwrapped sleeves of one face: fabric, cuff hem and the sleeve prints, half of each print per face. */
function bakeSleeves(doc: DesignDoc, face: "front" | "back", wrap: SleeveWrap): THREE.CanvasTexture {
  const f = sleeveFrame(wrap), size = atlasSize(f), px = ATLAS.px;
  const c = document.createElement("canvas");
  c.width = Math.round(size.w * px);
  c.height = Math.round(size.h * px);
  const ctx = c.getContext("2d")!;
  const dark = isDark(doc.colour);
  ctx.fillStyle = doc.colour;
  ctx.fillRect(0, 0, c.width, c.height);
  // the sleeves sit in the darker flank of the baked body: match it so the armhole does not show a step in tone
  ctx.fillStyle = dark ? "rgba(0,0,0,.16)" : "rgba(20,16,8,.14)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(px, px);
  const view = wrap.view, span = view.bottom - view.top, k = f.len / span;
  for (const onRight of [true, false]) {
    // the wearer's left sleeve is on the right of the front view and on the left of the back view
    const which = onRight === (face === "front") ? "left" : "right";
    const x0 = Math.min(atlasX(f, onRight, 0), atlasX(f, onRight, f.girth));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - ATLAS.gap / 2, 0, f.girth + ATLAS.gap, size.h);
    ctx.clip();
    ctx.strokeStyle = dark ? shade(doc.colour, 0.22) : shade(doc.colour, -0.2);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    // cuff hem, then the armhole seam the sleeve hangs from
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const p = (i / 40) * f.width, x = atlasX(f, onRight, f.arc(p)), y = ATLAS.pad + f.end(p) - 22; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const p = (i / 40) * f.width, x = atlasX(f, onRight, f.arc(p)), y = ATLAS.pad + f.arm(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    const key = `${which}-sleeve`;
    if (sideHasArt(doc.sides, key)) {
      const centre = which === "left" ? view.centre : GARMENT_BOX.w - view.centre;
      const print = renderRegion({ garment: doc.garment, side: key, sides: doc.sides, images: (l) => art.bitmap(l), window: { x: centre - view.reach, y: view.top, w: view.reach * 2, h: span }, pxPerUnit: 5 });
      // the side view draws the sleeve a little longer than the flat outline: keep the print's place ON the sleeve
      if (print) ctx.drawImage(print, atlasX(f, onRight, 0) - view.reach * k, ATLAS.pad, view.reach * 2 * k, span * k);
    }
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function bakeSide(doc: DesignDoc, side: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = Math.round((TEX_W * GARMENT_BOX.h) / GARMENT_BOX.w);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = doc.colour; // solid ground so the snapped edge never samples a transparent pixel
  ctx.fillRect(0, 0, c.width, c.height);
  renderSide(ctx, { garment: doc.garment, side, colour: doc.colour, trimColour: doc.trimColour, sides: doc.sides, images: (l) => art.bitmap(l), scale: TEX_W / GARMENT_BOX.w });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const FABRIC = { roughness: 0.9, metalness: 0, sheen: 0.12, sheenRoughness: 0.85, envMapIntensity: 0.3 } as const;
const NORMAL_SCALE = new THREE.Vector2(0.45, 0.45);
const SHEEN = new THREE.Color("#ffffff");

function Side({ doc, side, back, normalMap }: { doc: DesignDoc; side: string; back: boolean; normalMap: THREE.Texture }) {
  const g = getSide(doc.garment, side);
  const wrap = sleeveWrapOf(doc.garment);
  const geo = useMemo(() => inflate(g.body, back, wrap), [g.body, back, wrap]);
  const sleeves = useMemo(() => (wrap ? sleeveGeometry(g.body, back, wrap) : null), [g.body, back, wrap]);
  const map = useMemo(() => bakeSide(doc, side), [doc, side]);
  const sleeveMap = useMemo(() => (wrap ? bakeSleeves(doc, back ? "back" : "front", wrap) : null), [doc, back, wrap]);
  // the same weave at the same scale on the sleeve texture, which covers fewer centimetres than the body's
  const sleeveNormal = useMemo(() => {
    if (!wrap) return null;
    const size = atlasSize(sleeveFrame(wrap)), t = normalMap.clone();
    t.repeat.set((18 * size.w) / GARMENT_BOX.w, (20 * size.h) / GARMENT_BOX.h);
    t.needsUpdate = true;
    return t;
  }, [wrap, normalMap]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => sleeves?.dispose(), [sleeves]);
  useEffect(() => () => map.dispose(), [map]);
  useEffect(() => () => sleeveMap?.dispose(), [sleeveMap]);
  useEffect(() => () => sleeveNormal?.dispose(), [sleeveNormal]);
  return (
    <>
      <mesh geometry={geo}>
        <meshPhysicalMaterial map={map} normalMap={normalMap} normalScale={NORMAL_SCALE} sheenColor={SHEEN} {...FABRIC} />
      </mesh>
      {sleeves && sleeveMap && sleeveNormal && (
        <mesh geometry={sleeves}>
          <meshPhysicalMaterial map={sleeveMap} normalMap={sleeveNormal} normalScale={NORMAL_SCALE} sheenColor={SHEEN} {...FABRIC} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      )}
    </>
  );
}

/** The openings at the end of both sleeves. */
function Cuffs({ doc }: { doc: DesignDoc }) {
  const wrap = sleeveWrapOf(doc.garment);
  const geos = useMemo(() => (wrap ? [cuffGeometry(wrap, false), cuffGeometry(wrap, true)] : []), [wrap]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  const inside = isDark(doc.colour) ? shade(doc.colour, -0.45) : shade(doc.colour, -0.62);
  return <>{geos.map((g, i) => <mesh key={i} geometry={g}><meshBasicMaterial color={inside} side={THREE.DoubleSide} /></mesh>)}</>;
}

/** A soft elliptical ground shadow painted on a canvas — no extra render pass, nothing to leak. */
function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 64, 4, 128, 64, 120);
  g.addColorStop(0, "rgba(3,4,20,0.55)");
  g.addColorStop(0.55, "rgba(3,4,20,0.22)");
  g.addColorStop(1, "rgba(3,4,20,0)");
  ctx.scale(1, 0.5); ctx.translate(0, 64);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function GroundShadow() {
  const tex = useMemo(() => shadowTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[7.5, 3.6]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    /* eslint-disable react-hooks/immutability -- the R3F scene is an imperative three.js object; assigning its environment here is the supported pattern */
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    return () => { scene.environment = null; env.dispose(); pmrem.dispose(); };
    /* eslint-enable react-hooks/immutability */
  }, [gl, scene]);
  return null;
}

function Model({ doc }: { doc: DesignDoc }) {
  const group = useRef<THREE.Group>(null);
  // Drag state is a local ref read every frame: it must never cause a React render.
  const drag = useRef({ rot: -0.45, vel: 0.28, held: false, x: 0 });
  const el = useThree((s) => s.gl.domElement);
  const frontKey = doc.garment === "cap" ? "panel" : "front";
  const hasBack = getSide(doc.garment, "back").key === "back";
  const normalMap = useMemo(() => weaveNormalMap(), []);
  useEffect(() => () => normalMap.dispose(), [normalMap]);

  useEffect(() => {
    const d = drag.current;
    const down = (e: PointerEvent) => { el.setPointerCapture(e.pointerId); d.held = true; d.x = e.clientX; d.vel = 0; };
    const move = (e: PointerEvent) => { if (!d.held) return; const dx = e.clientX - d.x; d.x = e.clientX; d.rot += dx * 0.011; d.vel = dx * 0.5; };
    const up = () => { d.held = false; };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    return () => { el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
  }, [el]);

  useFrame((_, dt) => {
    const d = drag.current, o = group.current;
    if (!o) return;
    if (!d.held) { d.rot += d.vel * dt; d.vel += ((Math.abs(d.vel) < 0.02 ? 0.28 : 0) - d.vel) * Math.min(1, dt * 1.6); }
    o.rotation.y = d.rot;
    o.position.y = Math.sin(performance.now() / 1400) * 0.03; // the faintest sway, like a shirt on a hanger
  });

  return (
    <group ref={group}>
      <Side doc={doc} side={frontKey} back={false} normalMap={normalMap} />
      {hasBack ? <Side doc={doc} side="back" back normalMap={normalMap} /> : <Side doc={doc} side={frontKey} back normalMap={normalMap} />}
      <Cuffs doc={doc} />
    </group>
  );
}

/** Drag-to-rotate 3D preview. Front, back and sleeve artwork are live textures from the same renderer as the editor. */
export default function Garment3D({ doc }: { doc: DesignDoc }) {
  return (
    <div className="h-full w-full cursor-grab touch-none active:cursor-grabbing" role="img" aria-label="Rotating 3D preview of your design. Drag to turn it.">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.25, 7.8], fov: 30 }} gl={{ antialias: true, alpha: true, toneMappingExposure: 0.92 }}>
        <Studio />
        <directionalLight position={[3.5, 5, 6]} intensity={1.35} color="#fff4e0" />
        <directionalLight position={[-5, 2, -4]} intensity={0.4} color="#9ad4ff" />
        <spotLight position={[4, 4, -5]} intensity={14} color="#f5b81f" angle={0.6} penumbra={0.9} distance={18} decay={2} />
        <Model doc={doc} />
        <GroundShadow />
      </Canvas>
    </div>
  );
}

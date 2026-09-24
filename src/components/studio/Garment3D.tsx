"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GARMENT_BOX, getSide, type Cmd } from "@/lib/garments";
import { art } from "@/lib/studio/persistence";
import { renderSide } from "@/lib/studio/render-canvas";
import type { DesignDoc } from "@/lib/studio/schema";

/**
 * Realistic-ish 3D preview without a downloaded model: the garment outline is
 * inflated into a soft cushion (distance-to-edge profile), the whole side —
 * fabric colour, seams, trims and the live artwork — is baked into one texture
 * that wraps that surface, a procedural cotton weave drives a normal map, and
 * a room environment plus a contact shadow light it like a product shot.
 */
const S = 0.0042; // garment units → world
const PUFF = 0.36; // how far the fabric swells at the centre (world units)
const EDGE = 150; // units over which the edge rounds off
const GRID = { nx: 72, ny: 80 };
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

/** One inflated side of the garment. `back` mirrors the swell to −z and un-mirrors the texture. */
function inflate(cmds: Cmd[], back: boolean): THREE.BufferGeometry {
  const poly = outline(cmds);
  const { nx, ny } = GRID;
  const W = GARMENT_BOX.w, H = GARMENT_BOX.h;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const keep: boolean[] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = (i / nx) * W, y = (j / ny) * H, z = 0;
      const inn = inside(poly, x, y);
      const n = nearest(poly, x, y);
      if (inn) {
        const t = Math.min(n.d / EDGE, 1);
        z = PUFF * (1 - (1 - t) * (1 - t)) + 0.07 * Math.min(n.d / 420, 1);
      } else {
        [x, y] = n.p; // snap outside corners onto the silhouette so the boundary cells close the shape
      }
      keep.push(inn);
      pos.push((x - W / 2) * S, (H / 2 - y) * S, back ? -z : z);
      uv.push(back ? 1 - x / W : x / W, 1 - y / H);
    }
  }
  const at = (i: number, j: number) => j * (nx + 1) + i;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      if (!keep[a] && !keep[b] && !keep[c] && !keep[d]) continue;
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

function bakeSide(doc: DesignDoc, side: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = Math.round((TEX_W * GARMENT_BOX.h) / GARMENT_BOX.w);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = doc.colour; // solid ground so the snapped edge never samples a transparent pixel
  ctx.fillRect(0, 0, c.width, c.height);
  renderSide(ctx, { garment: doc.garment, side, colour: doc.colour, layers: doc.sides[side] ?? [], images: (l) => art.bitmap(l), scale: TEX_W / GARMENT_BOX.w });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Side({ doc, side, back, normalMap }: { doc: DesignDoc; side: string; back: boolean; normalMap: THREE.Texture }) {
  const g = getSide(doc.garment, side);
  const geo = useMemo(() => inflate(g.body, back), [g.body, back]);
  const map = useMemo(() => bakeSide(doc, side), [doc, side]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh geometry={geo}>
      <meshPhysicalMaterial map={map} normalMap={normalMap} normalScale={new THREE.Vector2(0.45, 0.45)} roughness={0.9} metalness={0} sheen={0.12} sheenRoughness={0.85} sheenColor={new THREE.Color("#ffffff")} envMapIntensity={0.3} />
    </mesh>
  );
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
    </group>
  );
}

/** Drag-to-rotate 3D preview. Front and back artwork are live textures from the same renderer as the editor. */
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

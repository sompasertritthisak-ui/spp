"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GARMENT_BOX, getSide, type Cmd } from "@/lib/garments";
import { art } from "@/lib/studio/persistence";
import { renderArtwork } from "@/lib/studio/render-canvas";
import type { DesignDoc } from "@/lib/studio/schema";

const S = 0.0042;
function bodyShape(cmds: Cmd[]) {
  const s = new THREE.Shape(), X = (x: number) => (x - GARMENT_BOX.w / 2) * S, Y = (y: number) => (GARMENT_BOX.h / 2 - y) * S;
  for (const c of cmds) { if (c[0] === "M") s.moveTo(X(c[1]), Y(c[2])); else if (c[0] === "L") s.lineTo(X(c[1]), Y(c[2])); else if (c[0] === "C") s.bezierCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6])); else s.closePath(); }
  return s;
}

function Decal({ doc, side, z, flip }: { doc: DesignDoc; side: string; z: number; flip: boolean }) {
  const g = getSide(doc.garment, side);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(renderArtwork(doc.sides[side] ?? [], (l) => art.bitmap(l), g.area.h / g.area.w, 1024));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [doc.sides, side, g.area.h, g.area.w]);
  useEffect(() => () => tex.dispose(), [tex]);
  const cx = (g.area.x + g.area.w / 2 - GARMENT_BOX.w / 2) * S * (flip ? -1 : 1), cy = (GARMENT_BOX.h / 2 - (g.area.y + g.area.h / 2)) * S;
  return (
    <mesh position={[cx, cy, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <planeGeometry args={[g.area.w * S, g.area.h * S]} />
      <meshStandardMaterial map={tex} transparent roughness={0.85} polygonOffset polygonOffsetFactor={-4} />
    </mesh>
  );
}

function Model({ doc, drag }: { doc: DesignDoc; drag: React.RefObject<{ rot: number; vel: number; held: boolean }> }) {
  const group = useRef<THREE.Group>(null);
  const front = getSide(doc.garment, doc.garment === "cap" ? "panel" : "front");
  const geo = useMemo(() => { const x = new THREE.ExtrudeGeometry(bodyShape(front.body), { depth: 0.26, bevelEnabled: true, bevelThickness: 0.11, bevelSize: 0.09, bevelSegments: 6, curveSegments: 24 }); x.translate(0, 0, -0.13); return x; }, [front.body]);
  useEffect(() => () => geo.dispose(), [geo]);
  const hasBack = getSide(doc.garment, "back").key === "back";
  useFrame((_, dt) => {
    const d = drag.current, o = group.current;
    if (!o) return;
    if (!d.held) { d.rot += d.vel * dt; d.vel += ((Math.abs(d.vel) < 0.02 ? 0.28 : 0) - d.vel) * Math.min(1, dt * 1.6); }
    o.rotation.y = d.rot;
  });
  return (
    <group ref={group}>
      <mesh geometry={geo}><meshStandardMaterial color={doc.colour} roughness={0.95} /></mesh>
      <Decal doc={doc} side={front.key} z={0.245} flip={false} />
      {hasBack && <Decal doc={doc} side="back" z={-0.245} flip />}
    </group>
  );
}

/** Drag-to-rotate 3D preview. Front and back artwork are live textures from the same renderer as the editor. */
export default function Garment3D({ doc }: { doc: DesignDoc }) {
  const drag = useRef({ rot: -0.45, vel: 0.28, held: false, x: 0 });
  return (
    <div className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); Object.assign(drag.current, { held: true, x: e.clientX, vel: 0 }); }}
      onPointerMove={(e) => { const d = drag.current; if (!d.held) return; const dx = e.clientX - d.x; d.x = e.clientX; d.rot += dx * 0.011; d.vel = dx * 0.5; }}
      onPointerUp={() => { drag.current.held = false; }} onPointerCancel={() => { drag.current.held = false; }}
      role="img" aria-label="Rotating 3D preview of your design. Drag to turn it.">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 8.4], fov: 32 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 5, 6]} intensity={2.2} color="#fff7e6" />
        <directionalLight position={[-5, 2, -5]} intensity={1.6} color="#38b6f2" />
        <directionalLight position={[0, 3, -6]} intensity={1.2} />
        <Model doc={doc} drag={drag} />
      </Canvas>
    </div>
  );
}

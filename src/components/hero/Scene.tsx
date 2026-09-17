"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { GARMENTS, GARMENT_BOX, type Cmd } from "@/lib/garments";
import { paintPrint, PRINT_SIZE, type PrintKind } from "./prints";

/* ── Live print textures ─────────────────────────────────────────────────── */
function usePrint(kind: PrintKind, text: string) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = PRINT_SIZE[kind];
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }, [kind]);
  useEffect(() => {
    let alive = true;
    const paint = () => {
      if (!alive) return;
      paintPrint(canvas, kind, text);
      texture.needsUpdate = true;
    };
    paint();
    // repaint once webfonts are in, so the first frame never sticks on a fallback face
    document.fonts?.ready.then(paint);
    return () => { alive = false; };
  }, [canvas, texture, kind, text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/* ── Geometry helpers ────────────────────────────────────────────────────── */
function shapeFrom(cmds: Cmd[], scale: number) {
  const s = new THREE.Shape();
  const X = (x: number) => (x - GARMENT_BOX.w / 2) * scale;
  const Y = (y: number) => (GARMENT_BOX.h / 2 - y) * scale;
  for (const c of cmds) {
    if (c[0] === "M") s.moveTo(X(c[1]), Y(c[2]));
    else if (c[0] === "L") s.lineTo(X(c[1]), Y(c[2]));
    else if (c[0] === "C") s.bezierCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6]));
    else s.closePath();
  }
  return s;
}

/** Every object drifts on its own phase and takes a small "press" when the text changes. */
function Drift({ children, position, rotation = [0, 0, 0], seed, still, pulse }: { children: ReactNode; position: [number, number, number]; rotation?: [number, number, number]; seed: number; still: boolean; pulse: number }) {
  const g = useRef<THREE.Group>(null);
  const hit = useRef(0);
  useEffect(() => { hit.current = 1; }, [pulse]);
  useFrame(({ clock }, dt) => {
    const o = g.current;
    if (!o) return;
    const t = still ? 0 : clock.elapsedTime;
    o.position.y = position[1] + Math.sin(t * 0.55 + seed) * 0.09;
    o.rotation.x = rotation[0] + Math.sin(t * 0.4 + seed * 2) * 0.045;
    o.rotation.y = rotation[1] + Math.cos(t * 0.33 + seed) * 0.07;
    o.rotation.z = rotation[2] + Math.sin(t * 0.28 + seed * 3) * 0.025;
    hit.current = Math.max(0, hit.current - dt * 3.2);
    const k = 1 - Math.sin(hit.current * Math.PI) * 0.035;
    o.scale.setScalar(k);
  });
  return <group ref={g} position={position} rotation={rotation}>{children}</group>;
}

/* ── Objects ─────────────────────────────────────────────────────────────── */
function Tee({ text }: { text: string }) {
  const tex = usePrint("tee", text);
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shapeFrom(GARMENTS.tee.sides[0]!.body, 0.0032), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.07, bevelSegments: 6, curveSegments: 24 });
    g.center();
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo}><meshStandardMaterial color="#e9e5da" roughness={0.96} metalness={0} /></mesh>
      <mesh position={[0, -0.12, 0.2]}>
        <planeGeometry args={[1.62, 1.62]} />
        <meshStandardMaterial map={tex} transparent roughness={0.8} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
    </group>
  );
}

function Billboard({ text }: { text: string }) {
  const tex = usePrint("billboard", text);
  const steel = <meshStandardMaterial color="#1b1b1f" roughness={0.45} metalness={0.7} />;
  return (
    <group>
      <mesh><boxGeometry args={[2.72, 1.42, 0.1]} />{steel}</mesh>
      <mesh position={[0, 0, 0.056]}><planeGeometry args={[2.6, 1.3]} /><meshStandardMaterial map={tex} roughness={0.55} emissive="#ffd60a" emissiveMap={tex} emissiveIntensity={0.22} /></mesh>
      {[-0.75, 0.75].map((x) => <mesh key={x} position={[x, -1.55, -0.06]}><cylinderGeometry args={[0.055, 0.07, 1.7, 12]} />{steel}</mesh>)}
      <mesh position={[0, -0.78, 0.16]}><boxGeometry args={[2.8, 0.035, 0.3]} />{steel}</mesh>
      {[-0.9, 0, 0.9].map((x) => (
        <group key={x} position={[x, 0.78, 0.2]}>
          <mesh rotation={[0.5, 0, 0]}><boxGeometry args={[0.03, 0.03, 0.36]} />{steel}</mesh>
          <mesh position={[0, -0.06, 0.18]}><boxGeometry args={[0.2, 0.05, 0.1]} /><meshStandardMaterial color="#fff6c4" emissive="#ffe9a0" emissiveIntensity={1.4} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Poster({ text }: { text: string }) {
  const tex = usePrint("poster", text);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.2, 1.7, 24, 1);
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) p.setZ(i, -(p.getX(i) ** 2) * 0.32);
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo}><meshStandardMaterial map={tex} roughness={0.85} side={THREE.DoubleSide} /></mesh>;
}

function Cup({ text }: { text: string }) {
  const tex = usePrint("cup", text);
  return (
    <group rotation={[0, Math.PI, 0]}>
      <mesh><cylinderGeometry args={[0.42, 0.3, 1.05, 48, 1, true]} /><meshStandardMaterial map={tex} roughness={0.6} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.555, 0]}><cylinderGeometry args={[0.455, 0.44, 0.07, 48]} /><meshStandardMaterial color="#0e0e10" roughness={0.35} /></mesh>
      <mesh position={[0, 0.615, 0]}><cylinderGeometry args={[0.3, 0.4, 0.06, 48]} /><meshStandardMaterial color="#0e0e10" roughness={0.35} /></mesh>
      <mesh position={[0, -0.525, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.3, 32]} /><meshStandardMaterial color="#d8d3c6" /></mesh>
    </group>
  );
}

function Tote({ text }: { text: string }) {
  const tex = usePrint("tote", text);
  const canvasMat = <meshStandardMaterial color="#e0d5bc" roughness={0.95} />;
  return (
    <group>
      <mesh><boxGeometry args={[1.26, 1.44, 0.11]} />{canvasMat}</mesh>
      <mesh position={[0, 0, 0.0565]}><planeGeometry args={[1.26, 1.44]} /><meshStandardMaterial map={tex} roughness={0.95} /></mesh>
      {[0.058, -0.058].map((z) => <mesh key={z} position={[0, 0.72, z]}><torusGeometry args={[0.3, 0.024, 8, 32, Math.PI]} />{canvasMat}</mesh>)}
    </group>
  );
}

function Cap() {
  return (
    <group rotation={[0.1, 0, 0]}>
      <mesh><sphereGeometry args={[0.6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#ffd60a" roughness={0.9} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.02, 0.5]} rotation={[0.12, 0, 0]} scale={[1, 1, 1.35]}><cylinderGeometry args={[0.6, 0.6, 0.035, 40, 1, false, -Math.PI / 2, Math.PI]} /><meshStandardMaterial color="#0e0e10" roughness={0.8} /></mesh>
      <mesh position={[0, 0.6, 0]}><sphereGeometry args={[0.05, 12, 12]} /><meshStandardMaterial color="#0e0e10" /></mesh>
    </group>
  );
}

/* ── Stage ───────────────────────────────────────────────────────────────── */
function Rig({ children, still }: { children: ReactNode; still: boolean }) {
  const g = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  useFrame((_, dt) => {
    if (!g.current || still) return;
    const k = 1 - Math.exp(-dt * 2.4);
    g.current.rotation.y += (pointer.x * 0.2 - g.current.rotation.y) * k;
    g.current.rotation.x += (-pointer.y * 0.11 - g.current.rotation.x) * k;
  });
  return <group ref={g}>{children}</group>;
}

function Responsive({ compact }: { compact: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = compact ? 40 : 32;
    // Pull back until the composition's half-width fits, whatever the canvas aspect.
    const halfW = compact ? 3.3 : 4.5;
    const halfH = compact ? 4.3 : 3.6;
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = size.width / Math.max(size.height, 1);
    cam.position.set(0, 0, Math.max(halfW / (t * aspect), halfH / t));
    cam.updateProjectionMatrix();
  }, [camera, compact, size.width, size.height]);
  return null;
}

export default function Scene({ text, active, reducedMotion, compact }: { text: string; active: boolean; reducedMotion: boolean; compact: boolean }) {
  const pulse = useMemo(() => text.length + text.charCodeAt(text.length - 1 || 0), [text]);
  const still = reducedMotion;
  return (
    <Canvas
      dpr={[1, compact ? 1.5 : 1.75]}
      frameloop={active && !still ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.15, 8.6], fov: 34, near: 0.1, far: 60 }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Responsive compact={compact} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 6]} intensity={2.4} color="#fff7e6" />
      <directionalLight position={[-6, 2, -3]} intensity={1.6} color="#ffd60a" />
      <pointLight position={[0, -3, 4]} intensity={14} color="#3a6bff" distance={12} />
      <Rig still={still}>
        <Drift seed={0.0} still={still} pulse={pulse} position={compact ? [0, 0.3, 0.4] : [0.3, -0.15, 0.6]} rotation={[0, -0.2, 0.03]}><group scale={compact ? 1.2 : 1.36}><Tee text={text} /></group></Drift>
        <Drift seed={1.7} still={still} pulse={pulse} position={compact ? [-1.2, 3.4, -2.6] : [2.5, 2.35, -3]} rotation={[0, compact ? 0.3 : -0.3, 0]}><Billboard text={text} /></Drift>
        <Drift seed={3.1} still={still} pulse={pulse} position={compact ? [2.1, 2.9, -1.6] : [3.55, -0.1, -1.4]} rotation={[0, -0.55, 0.05]}><Poster text={text} /></Drift>
        <Drift seed={4.4} still={still} pulse={pulse} position={compact ? [-2.1, -2.5, 1] : [-2.0, -2.0, 1.4]} rotation={[0.12, 0.3, -0.08]}><Cup text={text} /></Drift>
        <Drift seed={5.9} still={still} pulse={pulse} position={compact ? [2.1, -2.8, 0.4] : [2.9, -2.25, 0.9]} rotation={[0, -0.35, 0.06]}><Tote text={text} /></Drift>
        <Drift seed={7.2} still={still} pulse={pulse} position={compact ? [-2.2, 1.0, -1] : [-2.4, 2.2, -0.8]} rotation={[0.25, 0.5, -0.1]}><group scale={compact ? 0.8 : 1}><Cap /></group></Drift>
      </Rig>
    </Canvas>
  );
}

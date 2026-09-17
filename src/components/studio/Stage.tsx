"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as RPointerEvent } from "react";
import type { GarmentKey, PrintArea } from "@/content/types";
import { GARMENT_BOX, getSide, isDark, shade, toSvgPath } from "@/lib/garments";
import { layerSize } from "@/lib/studio/metrics";
import { art } from "@/lib/studio/persistence";
import { AREA_W, type Layer } from "@/lib/studio/schema";
import type { Action } from "@/lib/studio/store";
import { LayerSvg } from "./DesignThumb";

type Gesture =
  | { kind: "move"; id: string; px: number; py: number; ox: number; oy: number; moved: boolean }
  | { kind: "resize"; id: string; orig: Layer; w0: number; h0: number; moved: boolean }
  | { kind: "rotate"; id: string; moved: boolean };

type Guide = { axis: "x" | "y"; at: number };
const SNAP = 9; // area units
const SAFE = 0.04;

export function Stage({ garment, side, colour, layers, selectedId, dispatch, physical, zoomToArea, readOnly = false, onEditText }: {
  garment: GarmentKey; side: string; colour: string; layers: Layer[]; selectedId: string | null; dispatch: Dispatch<Action>;
  physical: PrintArea | undefined; zoomToArea: boolean; readOnly?: boolean; onEditText?: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [pxWidth, setPxWidth] = useState(600);

  const g = getSide(garment, side);
  const k = g.area.w / AREA_W;
  const areaH = g.area.h / k;
  const dark = isDark(colour);
  const seam = dark ? shade(colour, 0.22) : shade(colour, -0.2);
  const trim = dark ? shade(colour, 0.08) : shade(colour, -0.09);
  const guideInk = dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)";

  const view = useMemo(() => {
    if (!zoomToArea) return { x: 0, y: 0, w: GARMENT_BOX.w, h: GARMENT_BOX.h };
    const m = g.area.w * 0.22;
    return { x: g.area.x - m, y: g.area.y - m, w: g.area.w + m * 2, h: g.area.h + m * 2 };
  }, [zoomToArea, g.area]);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPxWidth(el.getBoundingClientRect().width || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // how many area-units one CSS pixel covers → keeps handles a constant on-screen size
  const unit = view.w / Math.max(pxWidth, 1) / k;

  const toArea = useCallback((e: { clientX: number; clientY: number }) => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: (p.x - g.area.x) / k, y: (p.y - g.area.y) / k };
  }, [g.area.x, g.area.y, k]);

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  const begin = (e: RPointerEvent, ges: Gesture) => {
    if (readOnly) return;
    e.stopPropagation();
    svg.current?.setPointerCapture(e.pointerId);
    gesture.current = ges;
  };

  const onMove = (e: RPointerEvent) => {
    const ges = gesture.current;
    if (!ges) return;
    const layer = layers.find((l) => l.id === ges.id);
    if (!layer) return;
    const p = toArea(e);
    if (!ges.moved) {
      // drag threshold: a tap selects, it never nudges the layer or pollutes undo history
      if (ges.kind === "move" && Math.hypot(p.x - ges.px, p.y - ges.py) < 4 * unit) return;
      ges.moved = true;
      dispatch({ type: "checkpoint" });
    }

    if (ges.kind === "move") {
      let x = ges.ox + (p.x - ges.px), y = ges.oy + (p.y - ges.py);
      const { w, h } = layerSize(layer);
      const gs: Guide[] = [];
      const inset = AREA_W * SAFE;
      const xs: [number, number][] = [[AREA_W / 2, x], [inset, x - w / 2], [AREA_W - inset, x + w / 2]];
      const ys: [number, number][] = [[areaH / 2, y], [inset, y - h / 2], [areaH - inset, y + h / 2]];
      if (!(layer.angle % 90)) {
        for (const [target, cur] of xs) if (Math.abs(cur - target) < SNAP) { x += target - cur; gs.push({ axis: "x", at: target }); break; }
        for (const [target, cur] of ys) if (Math.abs(cur - target) < SNAP) { y += target - cur; gs.push({ axis: "y", at: target }); break; }
      } else {
        if (Math.abs(x - AREA_W / 2) < SNAP) { x = AREA_W / 2; gs.push({ axis: "x", at: x }); }
        if (Math.abs(y - areaH / 2) < SNAP) { y = areaH / 2; gs.push({ axis: "y", at: y }); }
      }
      setGuides(gs);
      dispatch({ type: "update", id: ges.id, patch: { x, y }, transient: true });
    } else if (ges.kind === "resize") {
      const a = (-(layer.angle ?? 0) * Math.PI) / 180;
      const dx = p.x - layer.x, dy = p.y - layer.y;
      const lx = Math.abs(dx * Math.cos(a) - dy * Math.sin(a)), ly = Math.abs(dx * Math.sin(a) + dy * Math.cos(a));
      const o = ges.orig;
      if (o.type === "text") {
        const s = Math.max(lx / (ges.w0 / 2), ly / (ges.h0 / 2));
        dispatch({ type: "update", id: ges.id, patch: { size: Math.min(1200, Math.max(8, o.size * s)) }, transient: true });
      } else if (o.type === "shape" && !e.shiftKey) {
        dispatch({ type: "update", id: ges.id, patch: { w: Math.max(4, lx * 2), h: Math.max(4, ly * 2) }, transient: true });
      } else {
        const s = Math.max(lx / (ges.w0 / 2), ly / (ges.h0 / 2), 0.02);
        dispatch({ type: "update", id: ges.id, patch: { w: Math.max(4, ges.w0 * s), h: Math.max(4, ges.h0 * s) }, transient: true });
      }
    } else {
      let deg = (Math.atan2(p.y - layer.y, p.x - layer.x) * 180) / Math.PI + 90;
      deg = ((deg + 540) % 360) - 180;
      const near = Math.round(deg / 45) * 45;
      if (Math.abs(deg - near) < 4) deg = near;
      dispatch({ type: "update", id: ges.id, patch: { angle: Math.round(deg) }, transient: true });
    }
  };

  const end = (e: RPointerEvent) => {
    if (gesture.current) svg.current?.releasePointerCapture(e.pointerId);
    gesture.current = null;
    setGuides([]);
  };

  const hs = 11 * unit; // handle size
  const sel = selected ? layerSize(selected) : null;

  return (
    <svg
      ref={svg}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      className="h-full w-full touch-none select-none [transition:none]"
      role="img"
      aria-label={`${g.label} of the garment with your design. Use the layer list and position controls to edit with a keyboard.`}
      onPointerDown={() => !readOnly && dispatch({ type: "select", id: null })}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <defs>
        <clipPath id="stage-area"><rect x={g.area.x} y={g.area.y} width={g.area.w} height={g.area.h} /></clipPath>
        <clipPath id="stage-body"><path d={toSvgPath(g.body)} /></clipPath>
        <linearGradient id="stage-flank" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={dark ? 0.3 : 0.2} /><stop offset=".22" stopColor="#000" stopOpacity=".04" /><stop offset=".5" stopColor="#fff" stopOpacity=".07" /><stop offset=".78" stopColor="#000" stopOpacity=".04" /><stop offset="1" stopColor="#000" stopOpacity={dark ? 0.3 : 0.2} />
        </linearGradient>
        <linearGradient id="stage-fall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".06" /><stop offset="1" stopColor="#000" stopOpacity=".18" /></linearGradient>
        <filter id="stage-shadow" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="22" stdDeviation="26" floodColor="#000" floodOpacity=".5" /></filter>
      </defs>

      <g filter="url(#stage-shadow)">
        <path d={toSvgPath(g.body)} fill={colour} />
        <g clipPath="url(#stage-body)" pointerEvents="none">
          <rect width={GARMENT_BOX.w} height={GARMENT_BOX.h} fill="url(#stage-flank)" />
          <rect width={GARMENT_BOX.w} height={GARMENT_BOX.h} fill="url(#stage-fall)" />
        </g>
        <path d={toSvgPath(g.body)} fill="none" stroke={seam} strokeWidth={3} strokeLinejoin="round" />
      </g>
      {g.trims.map((d, i) => <path key={i} d={d} fill={trim} stroke={seam} strokeWidth={2.5} strokeLinejoin="round" pointerEvents="none" />)}
      {g.seams.map((d, i) => <path key={i} d={d} fill="none" stroke={seam} strokeWidth={2.5} strokeLinecap="round" pointerEvents="none" />)}

      {!readOnly && (
        <g pointerEvents="none">
          <rect x={g.area.x} y={g.area.y} width={g.area.w} height={g.area.h} fill="none" stroke={guideInk} strokeWidth={1.5 * unit * k} strokeDasharray={`${8 * unit * k} ${6 * unit * k}`} />
          <rect x={g.area.x + g.area.w * SAFE} y={g.area.y + g.area.w * SAFE} width={g.area.w * (1 - SAFE * 2)} height={g.area.h - g.area.w * SAFE * 2} fill="none" stroke={guideInk} strokeOpacity={0.55} strokeWidth={1 * unit * k} strokeDasharray={`${2 * unit * k} ${5 * unit * k}`} />
          <text x={g.area.x} y={g.area.y - 9 * unit * k} fontSize={10.5 * unit * k} fill={guideInk} fontFamily="var(--font-jetbrains), monospace" letterSpacing=".1em">
            {`PRINT AREA${physical ? ` · ${physical.widthMm} × ${physical.heightMm} MM` : ""}`}
          </text>
        </g>
      )}

      <g clipPath="url(#stage-area)">
        <g transform={`translate(${g.area.x} ${g.area.y}) scale(${k})`}>
          {layers.filter((l) => !l.hidden).map((l) => {
            const { w, h } = layerSize(l);
            return (
              <g key={l.id} style={{ cursor: readOnly || l.locked ? "default" : "move" }}
                onPointerDown={(e) => {
                  if (readOnly) return;
                  e.stopPropagation();
                  dispatch({ type: "select", id: l.id });
                  if (!l.locked) { const p = toArea(e); begin(e, { kind: "move", id: l.id, px: p.x, py: p.y, ox: l.x, oy: l.y, moved: false }); }
                }}
                onDoubleClick={() => l.type === "text" && onEditText?.()}
              >
                <LayerSvg layer={l} imageUrl={(im) => art.url(im)} />
                {/* generous, invisible hit target so thin text is still easy to grab */}
                <rect transform={`translate(${l.x} ${l.y}) rotate(${l.angle ?? 0})`} x={-w / 2 - 6 * unit} y={-h / 2 - 6 * unit} width={w + 12 * unit} height={h + 12 * unit} fill="transparent" />
              </g>
            );
          })}
        </g>
      </g>

      <g transform={`translate(${g.area.x} ${g.area.y}) scale(${k})`} pointerEvents="none">
        {guides.map((gd, i) => gd.axis === "x"
          ? <line key={i} x1={gd.at} x2={gd.at} y1={-40} y2={areaH + 40} stroke="#ec008c" strokeWidth={1.2 * unit} />
          : <line key={i} y1={gd.at} y2={gd.at} x1={-40} x2={AREA_W + 40} stroke="#ec008c" strokeWidth={1.2 * unit} />)}
      </g>

      {selected && sel && !selected.hidden && !readOnly && (
        <g transform={`translate(${g.area.x} ${g.area.y}) scale(${k}) translate(${selected.x} ${selected.y}) rotate(${selected.angle ?? 0})`}>
          <rect x={-sel.w / 2} y={-sel.h / 2} width={sel.w} height={sel.h} fill="none" stroke="#ffd60a" strokeWidth={1.5 * unit} pointerEvents="none" />
          {!selected.locked && (
            <>
              <line x1={0} y1={-sel.h / 2} x2={0} y2={-sel.h / 2 - 30 * unit} stroke="#ffd60a" strokeWidth={1.5 * unit} pointerEvents="none" />
              <circle cx={0} cy={-sel.h / 2 - 30 * unit} r={hs * 0.62} fill="#0b0b0c" stroke="#ffd60a" strokeWidth={1.5 * unit} style={{ cursor: "grab" }} onPointerDown={(e) => begin(e, { kind: "rotate", id: selected.id, moved: false })}><title>Rotate</title></circle>
              {([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => (
                <g key={`${sx}${sy}`} onPointerDown={(e) => begin(e, { kind: "resize", id: selected.id, orig: selected, w0: sel.w, h0: sel.h, moved: false })} style={{ cursor: sx === sy ? "nwse-resize" : "nesw-resize" }}>
                  {/* 44px touch target around an 11px visual handle */}
                  <rect x={(sx * sel.w) / 2 - 22 * unit} y={(sy * sel.h) / 2 - 22 * unit} width={44 * unit} height={44 * unit} fill="transparent" />
                  <rect x={(sx * sel.w) / 2 - hs / 2} y={(sy * sel.h) / 2 - hs / 2} width={hs} height={hs} fill="#ffd60a" stroke="#0b0b0c" strokeWidth={1.2 * unit} />
                </g>
              ))}
            </>
          )}
        </g>
      )}
    </svg>
  );
}

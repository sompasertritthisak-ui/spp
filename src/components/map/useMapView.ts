"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { VIEWBOX } from "@/lib/geo/laos.generated";

/** Centre of the view in map units, and scale in CSS pixels per map unit. */
export type View = { cx: number; cy: number; s: number };
export type Size = { w: number; h: number };
export type Bounds = readonly [x0: number, y0: number, x1: number, y1: number];

const MAX_ZOOM = 90; // × the fitted country view — enough to separate sites a few hundred metres apart
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const fitScale = (size: Size) => Math.min(size.w / VIEWBOX.w, size.h / VIEWBOX.h);

function clamp(v: View, size: Size): View {
  const fit = fitScale(size);
  const s = Math.min(Math.max(v.s, fit * 0.9), fit * MAX_ZOOM);
  return { s, cx: Math.min(Math.max(v.cx, 0), VIEWBOX.w), cy: Math.min(Math.max(v.cy, 0), VIEWBOX.h) };
}

/**
 * Pan / zoom camera for the vector map: rAF-tweened flights, wheel and pinch
 * zoom about the pointer, drag pan, all clamped to the sheet. The map only
 * claims the wheel once the visitor has engaged with it (or holds Ctrl/⌘), so
 * the page still scrolls past it.
 */
export function useMapView(surface: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<Size | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [wheelHint, setWheelHint] = useState(false);
  const viewRef = useRef<View | null>(null);
  const sizeRef = useRef<Size | null>(null);
  const home = useRef(true);
  const raf = useRef(0);
  const engaged = useRef(false);
  const dragged = useRef(false);

  const commit = useCallback((v: View) => {
    const next = sizeRef.current ? clamp(v, sizeRef.current) : v;
    viewRef.current = next;
    setView(next);
  }, []);

  const homeView = useCallback((sz: Size): View => ({ cx: VIEWBOX.w / 2, cy: VIEWBOX.h / 2, s: fitScale(sz) }), []);

  const flyTo = useCallback((target: View, ms = 750) => {
    cancelAnimationFrame(raf.current);
    const from = viewRef.current, sz = sizeRef.current;
    if (!from || !sz) return;
    const to = clamp(target, sz);
    if (ms <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return commit(to);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms), k = ease(t);
      // scale interpolates geometrically so a long zoom feels even from start to finish
      commit({ cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, s: from.s * Math.pow(to.s / from.s, k) });
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [commit]);

  const flyToBounds = useCallback((b: Bounds, padPx = 72, maxFactor = MAX_ZOOM) => {
    const sz = sizeRef.current;
    if (!sz) return;
    home.current = false;
    const bw = Math.max(b[2] - b[0], 0.5), bh = Math.max(b[3] - b[1], 0.5);
    const pad = Math.min(padPx, sz.w / 5, sz.h / 5);
    const s = Math.min((sz.w - pad * 2) / bw, (sz.h - pad * 2) / bh, fitScale(sz) * maxFactor);
    flyTo({ cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, s });
  }, [flyTo]);

  const flyToPoint = useCallback((x: number, y: number, minScale = 0) => {
    const v = viewRef.current;
    if (!v) return;
    home.current = false;
    flyTo({ cx: x, cy: y, s: Math.max(v.s, minScale) });
  }, [flyTo]);

  const reset = useCallback(() => {
    if (!sizeRef.current) return;
    home.current = true;
    flyTo(homeView(sizeRef.current));
  }, [flyTo, homeView]);

  const zoomAt = useCallback((factor: number, ax?: number, ay?: number, animate = false) => {
    const v = viewRef.current, sz = sizeRef.current;
    if (!v || !sz) return;
    home.current = false;
    const px = ax ?? sz.w / 2, py = ay ?? sz.h / 2;
    const s = clamp({ ...v, s: v.s * factor }, sz).s;
    const mx = v.cx + (px - sz.w / 2) / v.s, my = v.cy + (py - sz.h / 2) / v.s;
    const next = { s, cx: mx - (px - sz.w / 2) / s, cy: my - (py - sz.h / 2) / s };
    if (animate) flyTo(next, 320);
    else { cancelAnimationFrame(raf.current); commit(next); }
  }, [commit, flyTo]);

  const panBy = useCallback((dxPx: number, dyPx: number) => {
    const v = viewRef.current;
    if (!v) return;
    home.current = false;
    cancelAnimationFrame(raf.current);
    commit({ ...v, cx: v.cx - dxPx / v.s, cy: v.cy - dyPx / v.s });
  }, [commit]);

  // Measure; keep the country framed until the visitor takes the controls.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (!r || r.width < 2 || r.height < 2) return;
      const sz = { w: r.width, h: r.height };
      sizeRef.current = sz;
      setSize(sz);
      commit(home.current || !viewRef.current ? homeView(sz) : viewRef.current);
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf.current); };
  }, [surface, commit, homeView]);

  // Pointer (drag + pinch) and wheel. Native listeners: wheel must be non-passive to preventDefault.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let travel = 0;
    let hintTimer = 0;
    const local = (e: PointerEvent | WheelEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      engaged.current = true;
      pts.set(e.pointerId, local(e));
      if (pts.size === 1) { travel = 0; dragged.current = false; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); }
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size === 1) {
        travel += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
        if (travel > 4) {
          if (!dragged.current) { dragged.current = true; el.setPointerCapture(e.pointerId); }
          panBy(p.x - prev.x, p.y - prev.y);
        }
      } else if (pts.size === 2) {
        dragged.current = true;
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch > 0 && d > 0) zoomAt(d / pinch, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
        pinch = d;
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = 0;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const leave = (e: PointerEvent) => { if (e.pointerType === "mouse" && pts.size === 0) engaged.current = false; };
    const wheel = (e: WheelEvent) => {
      const pinchGesture = e.ctrlKey || e.metaKey; // trackpad pinch arrives as ctrl+wheel
      if (!pinchGesture && !engaged.current) {
        setWheelHint(true);
        window.clearTimeout(hintTimer);
        hintTimer = window.setTimeout(() => setWheelHint(false), 1600);
        return;
      }
      e.preventDefault();
      const p = local(e);
      const unit = e.deltaMode === 1 ? 16 : 1;
      zoomAt(Math.exp(-e.deltaY * unit * (pinchGesture ? 0.01 : 0.0018)), p.x, p.y);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.clearTimeout(hintTimer);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("wheel", wheel);
    };
  }, [surface, panBy, zoomAt]);

  /** true when the pointer sequence that just ended was a drag, so clicks can ignore it */
  const wasDrag = useCallback(() => dragged.current, []);
  /** current fitted-country scale, readable from callbacks that outlive a render */
  const fitNow = useCallback(() => (sizeRef.current ? fitScale(sizeRef.current) : 1), []);

  return { size, view, fit: size ? fitScale(size) : null, wheelHint, flyTo, flyToBounds, flyToPoint, zoomAt, panBy, reset, wasDrag, fitNow };
}

/** Map units → CSS pixels within the surface. */
export const toScreen = (v: View, size: Size, x: number, y: number): [number, number] => [(x - v.cx) * v.s + size.w / 2, (y - v.cy) * v.s + size.h / 2];
export const toMap = (v: View, size: Size, px: number, py: number): [number, number] => [v.cx + (px - size.w / 2) / v.s, v.cy + (py - size.h / 2) / v.s];

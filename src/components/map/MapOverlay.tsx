"use client";
import { PROJECTION, PROVINCES, project, unproject } from "@/lib/geo/laos.generated";
import type { Site } from "@/lib/geo/sites";
import { toMap, toScreen, type Size, type View } from "./useMapView";

const STEPS = [5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005];
const UNITS_PER_DEG = (PROJECTION.k * Math.PI) / 180;

const fmt = (v: number, step: number, pos: string, neg: string) => `${Math.abs(v).toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3)}°${v >= 0 ? pos : neg}`;

function niceKm(maxKm: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(maxKm)));
  const m = maxKm / pow;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * pow;
}

/**
 * Everything drawn in SCREEN space so it stays crisp at any zoom: an adaptive
 * graticule with mono coordinate labels, province names, filtered-out sites as
 * ghost ticks, the selection reticle and the scale bar.
 */
export function MapOverlay({ view, size, ghosts, selected, labelled }: { view: View; size: Size; ghosts: Site[]; selected: Site | null; labelled: ReadonlySet<string> }) {
  const step = STEPS.findLast((s) => s * UNITS_PER_DEG * view.s >= 96) ?? 5;
  const [lng0, lat1] = unproject(...toMap(view, size, 0, 0));
  const [lng1, lat0] = unproject(...toMap(view, size, size.w, size.h));
  const lngs: number[] = [], lats: number[] = [];
  for (let v = Math.ceil(lng0 / step) * step; v <= lng1 && lngs.length < 40; v += step) lngs.push(Math.round(v * 1000) / 1000);
  for (let v = Math.ceil(lat0 / step) * step; v <= lat1 && lats.length < 40; v += step) lats.push(Math.round(v * 1000) / 1000);

  // ground distance per pixel at the latitude of the view centre (Mercator stretches with latitude)
  const latC = unproject(view.cx, view.cy)[1];
  const kmPerPx = (6371 * Math.cos((latC * Math.PI) / 180)) / (PROJECTION.k * view.s);
  const barKm = niceKm(kmPerPx * Math.min(140, size.w / 3));
  const barPx = barKm / kmPerPx;
  const showNames = view.s >= 0.62;
  const sel = selected ? toScreen(view, size, selected.x, selected.y) : null;

  return (
    <svg aria-hidden width={size.w} height={size.h} className="pointer-events-none absolute inset-0 select-none">
      <g className="stroke-gold/[0.16]" strokeWidth={1} shapeRendering="crispEdges">
        {lngs.map((v) => { const x = Math.round(toScreen(view, size, project(v, 0)[0], 0)[0]) + 0.5; return <line key={`x${v}`} x1={x} x2={x} y1={0} y2={size.h} />; })}
        {lats.map((v) => { const y = Math.round(toScreen(view, size, 0, project(0, v)[1])[1]) + 0.5; return <line key={`y${v}`} y1={y} y2={y} x1={0} x2={size.w} />; })}
      </g>
      <g className="fill-gold/70 font-mono text-[9px] tracking-[0.08em]">
        {lngs.map((v) => <text key={`lx${v}`} x={toScreen(view, size, project(v, 0)[0], 0)[0] + 5} y={size.h - 8}>{fmt(v, step, "E", "W")}</text>)}
        {lats.map((v) => <text key={`ly${v}`} x={8} y={toScreen(view, size, 0, project(0, v)[1])[1] - 5}>{fmt(v, step, "N", "S")}</text>)}
      </g>

      {showNames && (
        <g className="font-mono text-[9px] uppercase tracking-[0.16em]" textAnchor="middle">
          {PROVINCES.map((p) => {
            const [x, y] = toScreen(view, size, p.cx, p.cy);
            if (x < -80 || y < -20 || x > size.w + 80 || y > size.h + 20) return null;
            return <text key={p.id} x={x} y={y} className={labelled.has(p.id) ? "fill-gold/80" : "fill-ink-500"}>{p.name}</text>;
          })}
        </g>
      )}

      <g className="fill-ink-500">
        {ghosts.map((g) => { const [x, y] = toScreen(view, size, g.x, g.y); return <rect key={g.code} x={x - 2} y={y - 2} width={4} height={4} transform={`rotate(45 ${x} ${y})`} />; })}
      </g>

      {sel && (
        <g className="stroke-gold" strokeWidth={1} fill="none" transform={`translate(${Math.round(sel[0])} ${Math.round(sel[1])})`}>
          <circle r={21} className="[animation:register_.35s_var(--ease-press)_both]" />
          <path d="M-32 0h-8M32 0h8M0-32v-8M0 32v8" />
        </g>
      )}

      <g transform={`translate(${size.w - 16 - barPx} ${size.h - 30})`}>
        <path d={`M.5 0v6h${Math.round(barPx)}V0M${Math.round(barPx / 2) + 0.5} 3v3`} className="stroke-gold/80" fill="none" strokeWidth={1} />
        <text x={barPx} y={-5} textAnchor="end" className="fill-gold/80 font-mono text-[9px] tracking-[0.12em]">{barKm >= 1 ? `${barKm} KM` : `${Math.round(barKm * 1000)} M`}</text>
      </g>
    </svg>
  );
}

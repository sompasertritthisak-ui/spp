"use client";
import { clsx } from "clsx";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { STATUS, type Site } from "@/lib/geo/sites";
import { StatusGlyph } from "./StatusGlyph";
import { toScreen, type Size, type View } from "./useMapView";

/** Sites closer than this on screen merge into one badge. Slightly under the 44px hit area so neighbours stay tappable. */
export const CLUSTER_PX = 38;

export type Cluster = { id: string; x: number; y: number; members: Site[] };

/** Greedy screen-space clustering; input order (site code) keeps the result stable frame to frame. */
export function clusterSites(sites: Site[], view: View, size: Size): Cluster[] {
  const out: (Cluster & { sx: number; sy: number })[] = [];
  for (const s of sites) {
    const [px, py] = toScreen(view, size, s.x, s.y);
    const home = out.find((c) => Math.hypot(c.sx / c.members.length - px, c.sy / c.members.length - py) < CLUSTER_PX);
    if (home) { home.members.push(s); home.sx += px; home.sy += py; }
    else out.push({ id: s.code, x: 0, y: 0, sx: px, sy: py, members: [s] });
  }
  return out.map((c) => ({ id: c.members.length > 1 ? `cluster-${c.id}` : c.id, x: c.sx / c.members.length, y: c.sy / c.members.length, members: c.members }));
}

type Props = {
  clusters: Cluster[];
  size: Size;
  detailed: boolean;
  selected: string | null;
  hovered: string | null;
  focusRequest: string | null;
  onFocusHandled: () => void;
  onSelect: (code: string) => void;
  onHover: (code: string | null) => void;
  onOpenCluster: (c: Cluster) => void;
  onProvinceHint: (provinceId: string | null) => void;
  wasDrag: () => boolean;
};

export function MapMarkers({ clusters, size, detailed, selected, hovered, focusRequest, onFocusHandled, onSelect, onHover, onOpenCluster, onProvinceHint, wasDrag }: Props) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const onScreen = clusters.filter((c) => c.x > -24 && c.y > -24 && c.x < size.w + 24 && c.y < size.h + 24);

  // After a cluster opens (or the list asks), hand keyboard focus to the marker that replaced it.
  useEffect(() => {
    if (!focusRequest) return;
    const el = refs.current.get(focusRequest);
    if (el) { el.focus({ preventScroll: true }); onFocusHandled(); }
  });

  // Arrow keys walk the markers spatially: the nearest one inside a 90° cone in that direction.
  const walk = (e: KeyboardEvent, from: Cluster) => {
    const dir = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, [number, number]>)[e.key];
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    let best: Cluster | null = null, bestD = Infinity;
    for (const c of onScreen) {
      if (c.id === from.id) continue;
      const dx = c.x - from.x, dy = c.y - from.y, d = Math.hypot(dx, dy);
      if ((dx * dir[0] + dy * dir[1]) / d < Math.SQRT1_2) continue;
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) refs.current.get(best.id)?.focus({ preventScroll: true });
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden [&>button]:pointer-events-auto">
      {onScreen.map((c) => {
        const first = c.members[0]!;
        const style = { transform: `translate3d(${Math.round(c.x) - 22}px, ${Math.round(c.y) - 22}px, 0)` };
        const setRef = (el: HTMLButtonElement | null) => { if (el) refs.current.set(c.id, el); else refs.current.delete(c.id); };

        if (c.members.length > 1) {
          const open = c.members.filter((m) => m.status === "available").length;
          return (
            <button
              key={c.id} ref={setRef} type="button" style={style}
              aria-label={`${c.members.length} locations around ${first.district}, ${first.province} — ${open} available. Zoom in.`}
              onClick={() => { if (!wasDrag()) onOpenCluster(c); }}
              onKeyDown={(e) => walk(e, c)}
              onFocus={() => onProvinceHint(first.provinceId)} onBlur={() => onProvinceHint(null)}
              className="group absolute left-0 top-0 z-20 flex h-11 w-11 items-center justify-center"
            >
              <span className={clsx("flex h-8 w-8 items-center justify-center rounded-full border bg-ink-950 font-mono text-xs font-semibold tabular-nums transition-transform duration-200 ease-[var(--ease-press)] group-hover:scale-110", open ? "border-yellow text-yellow" : "border-fog-400 text-fog-100")}>{c.members.length}</span>
              <span aria-hidden className="t-label pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 whitespace-nowrap bg-ink-950/85 px-1.5 py-1 text-[0.5625rem] text-fog-300">{open ? `${open} open` : "sites"}</span>
            </button>
          );
        }

        const isSel = selected === first.code, isHot = hovered === first.code;
        return (
          <button
            key={c.id} ref={setRef} type="button" style={style}
            aria-label={`${first.code} ${first.name} — ${STATUS[first.status].label}. ${first.district}, ${first.province}.`}
            aria-pressed={isSel}
            onClick={() => { if (!wasDrag()) onSelect(first.code); }}
            onKeyDown={(e) => walk(e, c)}
            onPointerEnter={() => onHover(first.code)} onPointerLeave={() => onHover(null)}
            onFocus={() => { onHover(first.code); onProvinceHint(first.provinceId); }} onBlur={() => { onHover(null); onProvinceHint(null); }}
            className={clsx("group absolute left-0 top-0 flex h-11 w-11 items-center justify-center", isSel ? "z-30" : first.status === "available" ? "z-20" : "z-10")}
          >
            {first.status === "available" && <span aria-hidden className="absolute h-4 w-4 rounded-full border border-yellow motion-safe:[animation:pulse-ring_2.4s_var(--ease-press)_infinite] motion-reduce:hidden" />}
            <StatusGlyph status={first.status} size={isSel || isHot ? 22 : 18} className="relative transition-[width,height] duration-150" />
            {(detailed || isSel || isHot) && (
              <span aria-hidden className={clsx("pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 whitespace-nowrap px-1.5 py-1 font-mono text-[0.625rem] uppercase tracking-[0.1em]", isSel ? "bg-yellow text-ink-950" : "bg-ink-950/85 text-fog-100")}>
                <span className="opacity-60">{first.code.replace("SPP-BB-", "")}</span> {first.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

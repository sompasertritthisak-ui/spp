"use client";
import { Crosshair, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from "react";
import { VIEWBOX, unproject } from "@/lib/geo/laos.generated";
import { provinceById } from "@/lib/geo/provinces";
import { STATUS, STATUS_ORDER, type Site } from "@/lib/geo/sites";
import { MapBase } from "./MapBase";
import { CLUSTER_PX, MapMarkers, clusterSites, type Cluster } from "./MapMarkers";
import { MapOverlay } from "./MapOverlay";
import { StatusGlyph } from "./StatusGlyph";
import { toMap, useMapView } from "./useMapView";

export type MapHandle = { flyToSite: (code: string, focus?: boolean) => void; flyToProvince: (id: string) => void; reset: () => void };

type Props = {
  ref?: Ref<MapHandle>;
  sites: Site[];
  /** codes that pass the current filters */
  visible: ReadonlySet<string>;
  selected: string | null;
  hovered: string | null;
  focusedProvince: string | null;
  onSelect: (code: string) => void;
  onHover: (code: string | null) => void;
};

const LEVELS = [{ max: 2.2, n: "01", name: "Country" }, { max: 14, n: "02", name: "Province" }, { max: Infinity, n: "03", name: "District" }] as const;
const ctl = "flex h-11 w-11 items-center justify-center border border-ink-600 bg-ink-950/90 text-fog-100 transition-colors duration-150 hover:border-yellow hover:text-yellow disabled:opacity-40";

const boundsOf = (list: Site[]) => [Math.min(...list.map((s) => s.x)), Math.min(...list.map((s) => s.y)), Math.max(...list.map((s) => s.x)), Math.max(...list.map((s) => s.y))] as const;

export function MapCanvas({ ref, sites, visible, selected, hovered, focusedProvince, onSelect, onHover }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const cam = useMapView(surface);
  const { view, size, fit } = cam;
  const [hoverProvince, setHoverProvince] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const queued = useRef<(() => void) | null>(null);

  const shown = useMemo(() => sites.filter((s) => visible.has(s.code)), [sites, visible]);
  const ghosts = useMemo(() => sites.filter((s) => !visible.has(s.code)), [sites, visible]);
  const active = useMemo(() => new Set(sites.flatMap((s) => (s.provinceId ? [s.provinceId] : []))), [sites]);
  const capital = useMemo(() => sites.filter((s) => s.provinceId === "vientiane-capital"), [sites]);

  /** Scale at which a site stands clear of its nearest neighbour instead of hiding in a cluster badge. */
  const clearScale = useCallback((site: Site) => {
    const nearest = Math.min(...sites.filter((s) => s.code !== site.code).map((s) => Math.hypot(s.x - site.x, s.y - site.y)));
    return Number.isFinite(nearest) && nearest > 0 ? (CLUSTER_PX + 14) / nearest : 0;
  }, [sites]);

  const run = useCallback((fn: () => void) => { if (cam.view) fn(); else queued.current = fn; }, [cam.view]);
  useEffect(() => { if (view && queued.current) { const fn = queued.current; queued.current = null; fn(); } }, [view]);

  useImperativeHandle(ref, () => ({
    flyToSite: (code, focus) => run(() => {
      const s = sites.find((x) => x.code === code);
      if (!s) return;
      cam.flyToPoint(s.x, s.y, Math.max(clearScale(s), (fit ?? 1) * 3));
      if (focus) setFocusRequest(code);
    }),
    flyToProvince: (id) => run(() => { const p = provinceById(id); if (p) cam.flyToBounds(p.bbox, 56, 30); }),
    reset: () => run(cam.reset),
  }), [run, sites, cam, clearScale, fit]);

  const { flyToBounds, wasDrag } = cam;
  const openCluster = useCallback((c: Cluster) => {
    flyToBounds(boundsOf(c.members), 96);
    setFocusRequest(c.members[0]!.code);
  }, [flyToBounds]);
  // stable identity: MapBase is memoised and must not re-render on camera frames
  const pickProvince = useCallback((id: string) => {
    const p = wasDrag() ? null : provinceById(id);
    if (p) flyToBounds(p.bbox, 56, 30);
  }, [flyToBounds, wasDrag]);

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== surface.current) return;
    const pan: Record<string, [number, number]> = { ArrowUp: [0, 80], ArrowDown: [0, -80], ArrowLeft: [80, 0], ArrowRight: [-80, 0] };
    if (pan[e.key]) { e.preventDefault(); cam.panBy(...pan[e.key]!); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); cam.zoomAt(1.6, undefined, undefined, true); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); cam.zoomAt(1 / 1.6, undefined, undefined, true); }
    else if (e.key === "0" || e.key === "Home") { e.preventDefault(); cam.reset(); }
  };

  // Cursor position readout writes straight to the DOM: no React work per mouse move.
  const onMove = (e: PointerEvent) => {
    if (!view || !size || !readout.current || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const [lng, lat] = unproject(...toMap(view, size, e.clientX - r.left, e.clientY - r.top));
    readout.current.textContent = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}  ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  };

  const vb = view && size ? `${view.cx - size.w / 2 / view.s} ${view.cy - size.h / 2 / view.s} ${size.w / view.s} ${size.h / view.s}` : `0 0 ${VIEWBOX.w} ${VIEWBOX.h}`;
  const zoom = view && fit ? view.s / fit : 1;
  const level = LEVELS.find((l) => zoom < l.max) ?? LEVELS[0];
  const clusters = view && size ? clusterSites(shown, view, size) : [];
  const selectedSite = selected ? shown.find((s) => s.code === selected) ?? null : null;
  const selectedLoose = selectedSite && clusters.some((c) => c.members.length === 1 && c.members[0]!.code === selectedSite.code);

  const hintId = hoverProvince;
  const hint = hintId ? provinceById(hintId) : null;
  const hintSites = hintId ? sites.filter((s) => s.provinceId === hintId) : [];

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <div
        ref={surface}
        role="group"
        tabIndex={0}
        aria-label="Interactive map of SPP billboard locations in Laos"
        aria-describedby="spp-map-help"
        data-lenis-prevent
        onKeyDown={onKey}
        onPointerMove={onMove}
        className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing focus-visible:outline-offset-[-3px]"
      >
        <p id="spp-map-help" className="sr-only">Drag, or use the arrow keys, to pan. Plus and minus zoom, zero resets. Each marker is a button; arrow keys move between markers. Every location is also in the list that follows the map.</p>
        <svg aria-hidden viewBox={vb} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
          <defs>
            <pattern id="spp-map-halftone" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform={`scale(${1 / (view?.s ?? 0.8)})`}>
              <circle cx="3.5" cy="3.5" r="0.9" className="fill-fog-50/[0.09]" />
            </pattern>
          </defs>
          <MapBase active={active} focused={focusedProvince} onHover={setHoverProvince} onPick={pickProvince} />
        </svg>
        {view && size && <MapOverlay view={view} size={size} ghosts={ghosts} selected={selectedLoose ? selectedSite : null} labelled={active} />}
        {view && size && (
          <MapMarkers
            clusters={clusters} size={size} detailed={zoom >= 2.2} selected={selected} hovered={hovered}
            focusRequest={focusRequest} onFocusHandled={() => setFocusRequest(null)}
            onSelect={onSelect} onHover={onHover} onOpenCluster={openCluster} onProvinceHint={setHoverProvince} wasDrag={cam.wasDrag}
          />
        )}
      </div>

      {/* sheet furniture: crop marks, title block, north mark */}
      {(["left-3 top-3 border-l border-t", "right-3 top-3 border-r border-t", "left-3 bottom-3 border-l border-b", "right-3 bottom-3 border-r border-b"] as const).map((c) => <span key={c} aria-hidden className={`pointer-events-none absolute h-3.5 w-3.5 border-ink-500 ${c}`} />)}
      <div className="pointer-events-none absolute left-6 top-6 max-w-[60%]">
        <p className="t-label flex items-center gap-2.5 text-fog-300"><span aria-hidden className="reg text-yellow" />SPP Outdoor Network</p>
        <p className="t-label mt-2 text-[0.625rem] text-fog-500">Level {level.n} · {level.name} <span className="t-data text-fog-400">×{zoom.toFixed(1)}</span></p>
        <p aria-live="polite" className="t-label mt-3 min-h-4 text-[0.625rem] text-fog-100">
          {hint && <>{hint.name} · {hintSites.length} {hintSites.length === 1 ? "site" : "sites"} · {hintSites.filter((s) => s.status === "available").length} available</>}
        </p>
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <div className="flex flex-col" role="group" aria-label="Map controls">
          <button type="button" className={ctl} aria-label="Zoom in" onClick={() => cam.zoomAt(1.8, undefined, undefined, true)}><Plus aria-hidden size={18} strokeWidth={1.5} /></button>
          <button type="button" className={`${ctl} -mt-px`} aria-label="Zoom out" onClick={() => cam.zoomAt(1 / 1.8, undefined, undefined, true)}><Minus aria-hidden size={18} strokeWidth={1.5} /></button>
          <button type="button" className={`${ctl} -mt-px`} aria-label="Reset to the whole country" onClick={cam.reset}><RotateCcw aria-hidden size={16} strokeWidth={1.5} /></button>
        </div>
        {capital.length > 0 && (
          <button type="button" onClick={() => cam.flyToBounds(boundsOf(capital), 96)} className="t-label flex min-h-11 items-center gap-2 border border-ink-600 bg-ink-950/90 px-3 text-[0.625rem] text-fog-100 transition-colors duration-150 hover:border-yellow hover:text-yellow">
            <Crosshair aria-hidden size={14} strokeWidth={1.5} />Vientiane
          </button>
        )}
        <svg aria-hidden viewBox="0 0 24 40" className="mr-2.5 mt-2 h-10 w-6 text-fog-400" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M12 38V12M12 3l5 11-5-3-5 3z" /><path d="M12 3l5 11-5-3z" fill="currentColor" />
        </svg>
        <span aria-hidden className="t-label -mt-1 mr-[1.05rem] text-[0.5625rem] text-fog-400">N</span>
      </div>

      <ul aria-label="Map legend" className="pointer-events-none absolute bottom-10 left-6 hidden flex-col gap-1.5 sm:flex">
        {STATUS_ORDER.map((s) => <li key={s} className="t-label flex items-center gap-2 text-[0.625rem] text-fog-400"><StatusGlyph status={s} size={12} />{STATUS[s].label}</li>)}
      </ul>
      <span ref={readout} aria-hidden className="t-data pointer-events-none absolute bottom-14 right-4 hidden whitespace-pre text-[0.625rem] text-fog-400 md:block" />

      <p role="status" className={`t-label pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-ink-600 bg-ink-950/95 px-4 py-3 text-[0.625rem] text-fog-100 transition-opacity duration-200 ${cam.wheelHint ? "opacity-100" : "opacity-0"}`}>
        {cam.wheelHint ? "Click the map, or hold Ctrl / ⌘, to zoom with the wheel" : ""}
      </p>
    </div>
  );
}

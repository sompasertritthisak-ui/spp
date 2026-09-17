"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Billboard, BillboardStatus } from "@/content/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { track } from "@/lib/backend/analytics";
import { PROVINCES } from "@/lib/geo/laos.generated";
import { SIZE_CLASSES, STATUS_ORDER, toSite, type Site, type SizeClass } from "@/lib/geo/sites";
import { LocationList } from "./LocationList";
import { MapCanvas, type MapHandle } from "./MapCanvas";
import { MapFilters, type FilterCounts, type Filters } from "./MapFilters";
import { SiteCard } from "./SiteCard";
import { useLiveAvailability } from "./useLiveAvailability";

const isStatus = (v: string | null): v is BillboardStatus => STATUS_ORDER.includes(v as BillboardStatus);
const isSize = (v: string | null): v is SizeClass => SIZE_CLASSES.some((c) => c.key === v);

const matches = (s: Site, f: Filters, skip?: keyof Filters) =>
  (skip === "status" || !f.status || s.status === f.status) &&
  (skip === "province" || !f.province || s.provinceId === f.province) &&
  (skip === "size" || !f.size || s.sizeClass === f.size) &&
  (skip === "lit" || !f.lit || s.lit);

/**
 * The Outdoor Network instrument: map, filters, detail readout and the list
 * twin. Filters and the selection live in the URL so a view can be shared;
 * availability is refreshed from the back-end when there is one.
 */
export function OutdoorMap({ billboards, showPrices }: { billboards: Billboard[]; showPrices: boolean }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const map = useRef<MapHandle>(null);
  const card = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const live = useLiveAvailability();

  const sites = useMemo(() => billboards.map((b) => toSite({ ...b, ...(live.byCode[b.code] ? { status: live.byCode[b.code]!.status, availableFrom: live.byCode[b.code]!.availableFrom } : {}) })), [billboards, live.byCode]);

  const rawStatus = params.get("status"), rawSize = params.get("size"), rawProvince = params.get("province"), rawSite = params.get("site");
  const filters = useMemo<Filters>(() => ({
    status: isStatus(rawStatus) ? rawStatus : null,
    province: PROVINCES.some((p) => p.id === rawProvince) ? rawProvince : null,
    size: isSize(rawSize) ? rawSize : null,
    lit: params.get("lit") === "1",
  }), [rawStatus, rawSize, rawProvince, params]);
  const selected = sites.some((s) => s.code === rawSite) ? rawSite : null;

  // Next mirrors history.replaceState into useSearchParams, so the URL is the single source of truth.
  const write = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    const qs = next.toString();
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
  }, [pathname]);

  const shown = useMemo(() => sites.filter((s) => matches(s, filters)), [sites, filters]);
  const visible = useMemo(() => new Set(shown.map((s) => s.code)), [shown]);
  const selectedSite = selected ? sites.find((s) => s.code === selected) ?? null : null;

  // Each facet counts what it WOULD show given the other filters — so a count never lies about the next click.
  const counts = useMemo<FilterCounts>(() => {
    const forStatus = sites.filter((s) => matches(s, filters, "status"));
    const forProvince = sites.filter((s) => matches(s, filters, "province"));
    const forSize = sites.filter((s) => matches(s, filters, "size"));
    return {
      all: forStatus.length,
      status: Object.fromEntries(STATUS_ORDER.map((k) => [k, forStatus.filter((s) => s.status === k).length])) as FilterCounts["status"],
      province: PROVINCES.map((p) => ({ id: p.id, name: p.name, n: forProvince.filter((s) => s.provinceId === p.id).length })).filter((p) => sites.some((s) => s.provinceId === p.id)),
      size: Object.fromEntries(SIZE_CLASSES.map((c) => [c.key, forSize.filter((s) => s.sizeClass === c.key).length])) as FilterCounts["size"],
      lit: sites.filter((s) => matches(s, filters, "lit") && s.lit).length,
    };
  }, [sites, filters]);

  const select = useCallback((code: string, from: "map" | "list") => {
    write({ site: code });
    track("billboard_viewed", { ref: code, source: from === "map" ? "outdoor-map" : "outdoor-list" });
    if (from === "list") map.current?.flyToSite(code);
    // on small screens the readout sits at the top of the sheet, under the pinned map
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => card.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }, [write]);

  const change = useCallback((patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const keepSite = selectedSite && matches(selectedSite, next) ? selectedSite.code : null;
    write({ status: next.status, province: next.province, size: next.size, lit: next.lit ? "1" : null, site: keepSite });
    if ("province" in patch) { if (patch.province) map.current?.flyToProvince(patch.province); else map.current?.reset(); }
  }, [filters, selectedSite, write]);

  const clear = useCallback(() => { write({ status: null, province: null, size: null, lit: null }); map.current?.reset(); }, [write]);

  // Shared links (?site=… / ?province=…) open already framed. Runs once: later moves are driven by the handlers above.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (selected) map.current?.flyToSite(selected);
    else if (filters.province) map.current?.flyToProvince(filters.province);
  }, [selected, filters.province]);

  const readout = selectedSite && <SiteCard site={selectedSite} showPrices={showPrices} onClose={() => write({ site: null })} />;

  return (
    <div className="border-y border-ink-700 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem]">
      <div className="sticky top-[var(--nav-h)] z-20 h-[55svh] border-b border-ink-700 lg:h-[calc(100dvh-var(--nav-h))] lg:border-b-0">
        <MapCanvas ref={map} sites={sites} visible={visible} selected={selected} hovered={hovered} focusedProvince={filters.province} onSelect={(c) => select(c, "map")} onHover={setHovered} />
        <div className="absolute bottom-6 left-6 z-40 hidden w-[23rem] max-w-[calc(100%-3rem)] lg:block" aria-live="polite">{readout}</div>
      </div>

      <div className="relative z-10 border-ink-700 bg-ink-900 lg:border-l">
        <div aria-hidden className="flex justify-center pt-2.5 lg:hidden"><span className="h-1 w-10 bg-ink-600" /></div>
        <div ref={card} className="scroll-mt-[calc(var(--nav-h)+55svh)] lg:hidden" aria-live="polite">{readout && <div className="p-4 pb-0">{readout}</div>}</div>

        <div className="px-5 py-6 sm:px-6">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="t-heading text-fog-50">Locations</h2>
            <p className="t-label text-[0.625rem] text-fog-400" aria-live="polite">
              <span className="t-data text-fog-50">{shown.length}</span> of {sites.length} shown
            </p>
          </div>
          <MapFilters value={filters} counts={counts} onChange={change} onClear={clear} />
          <p className="t-label mt-5 flex items-center gap-2 text-[0.5625rem] text-fog-500">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${live.state === "live" ? "bg-ok" : "bg-fog-500"}`} />
            {live.state === "live" ? "Availability checked live just now" : live.state === "loading" ? "Checking live availability…" : "Availability as of the last site update"}
          </p>
        </div>

        {shown.length ? (
          <LocationList sites={shown} selected={selected} hovered={hovered} onSelect={(c) => select(c, "list")} onHover={setHovered} />
        ) : (
          <div className="p-5 sm:p-6"><EmptyState title="No locations match." body="Loosen a filter — or tell SPP which area you need and we will advise." action={<button type="button" onClick={clear} className="t-label min-h-11 border border-ink-500 px-4 text-fog-50 hover:border-yellow hover:text-yellow">Clear filters</button>} /></div>
        )}
      </div>
    </div>
  );
}

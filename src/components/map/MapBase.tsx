"use client";
import { memo } from "react";
import { clsx } from "clsx";
import { OUTLINE, PROVINCES } from "@/lib/geo/laos.generated";

/**
 * The static artwork of the map: province shapes and the national outline.
 * Memoised so camera frames (which only change the parent viewBox) never
 * re-render 18 long paths.
 */
export const MapBase = memo(function MapBase({ active, focused, onHover, onPick }: { active: ReadonlySet<string>; focused: string | null; onHover: (id: string | null) => void; onPick: (id: string) => void }) {
  return (
    <g>
      {PROVINCES.map((p) => {
        const on = active.has(p.id);
        return (
          <path
            key={p.id}
            d={p.d}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1}
            strokeLinejoin="round"
            className={clsx("transition-[fill] duration-200 ease-[var(--ease-press)]", on ? "cursor-pointer fill-ink-800 stroke-ink-600 hover:fill-ink-700" : "fill-ink-900 stroke-ink-700")}
            onPointerEnter={on ? () => onHover(p.id) : undefined}
            onPointerLeave={on ? () => onHover(null) : undefined}
            onClick={on ? () => onPick(p.id) : undefined}
          />
        );
      })}
      {/* halftone tint over provinces that carry sites — texture, not decoration: it marks the network's footprint */}
      {PROVINCES.filter((p) => active.has(p.id)).map((p) => <path key={p.id} d={p.d} fill="url(#spp-map-halftone)" className="pointer-events-none" />)}
      {focused && PROVINCES.filter((p) => p.id === focused).map((p) => <path key={p.id} d={p.d} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.5} className="pointer-events-none stroke-yellow/80" />)}
      <path d={OUTLINE} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.25} strokeLinejoin="round" className="pointer-events-none stroke-fog-500" />
    </g>
  );
});

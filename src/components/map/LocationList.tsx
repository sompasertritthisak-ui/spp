"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Site } from "@/lib/geo/sites";
import { StatusTag } from "./StatusGlyph";

/**
 * The accessible twin of the map: every location, grouped by province, as real
 * buttons and links. Selection and hover are mirrored both ways.
 */
export function LocationList({ sites, selected, hovered, onSelect, onHover }: { sites: Site[]; selected: string | null; hovered: string | null; onSelect: (code: string) => void; onHover: (code: string | null) => void }) {
  const current = useRef<HTMLLIElement>(null);
  // keep the chosen row in view when the selection came from the map (never steals focus)
  useEffect(() => { if (selected && window.matchMedia("(min-width: 1024px)").matches) current.current?.scrollIntoView({ block: "nearest" }); }, [selected]);

  const groups = new Map<string, Site[]>();
  for (const s of sites) groups.set(s.province, [...(groups.get(s.province) ?? []), s]);

  return (
    <div className="flex flex-col">
      {[...groups.entries()].map(([province, rows]) => (
        <section key={province} aria-label={province}>
          <h3 className="t-label sticky top-[var(--nav-h)] z-[1] flex items-center justify-between border-y border-ink-700 bg-ink-850 px-5 py-2.5 text-[0.625rem] text-fog-300 max-lg:top-[calc(var(--nav-h)+55svh)] sm:px-6">
            {province}<span className="t-data text-fog-500">{String(rows.length).padStart(2, "0")}</span>
          </h3>
          <ul>
            {rows.map((s) => {
              const isSel = s.code === selected;
              return (
                <li key={s.code} ref={isSel ? current : undefined} onPointerEnter={() => onHover(s.code)} onPointerLeave={() => onHover(null)} className={clsx("relative flex border-b border-ink-700 transition-colors duration-150", isSel ? "bg-ink-800" : hovered === s.code ? "bg-ink-850" : "")}>
                  {isSel && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-yellow" />}
                  <button type="button" aria-pressed={isSel} onClick={() => onSelect(s.code)} onFocus={() => onHover(s.code)} onBlur={() => onHover(null)} className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-start justify-center gap-1.5 px-5 py-3 text-left focus-visible:outline-offset-[-3px] sm:px-6">
                    <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="t-data text-xs text-fog-500">{s.code}</span>
                      <StatusTag status={s.status} className="text-[0.5625rem]" />
                    </span>
                    <span className="truncate text-base font-medium text-fog-50">{s.name}</span>
                    <span className="t-data text-xs text-fog-400">{s.widthM} × {s.heightM} m · {s.lit ? "Lit" : "Unlit"} · {s.district}</span>
                  </button>
                  <Link href={`/billboards/${s.code}/`} aria-label={`View ${s.name} location page`} className="flex w-14 flex-none items-center justify-center border-l border-ink-700 text-fog-400 transition-colors duration-150 hover:bg-yellow hover:text-ink-950 focus-visible:outline-offset-[-3px]">
                    <svg aria-hidden viewBox="0 0 20 10" className="h-2.5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M0 5h18M14 1l4 4-4 4" /></svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

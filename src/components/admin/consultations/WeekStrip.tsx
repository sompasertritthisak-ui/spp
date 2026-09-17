"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { vteDay, vteTime } from "../ops/vientiane";
import { StatusPill } from "../ui";
import { effectiveAt, isOpen, type Consultation } from "./shared";

/** Seven days at a glance, in Vientiane time. Scrolls inside itself on small screens. */
export function WeekStrip({ rows, now, onOpen }: { rows: Consultation[]; now: number; onOpen: (id: string) => void }) {
  const [offset, setOffset] = useState(0);
  const today = vteDay(now);
  const days = Array.from({ length: 7 }, (_, i) => vteDay(now + (offset * 7 + i) * 864e5));
  const byDay = (d: string) => rows.filter((c) => c.status !== "declined" && vteDay(new Date(effectiveAt(c)).getTime()) === d).sort((a, b) => effectiveAt(a).localeCompare(effectiveAt(b)));
  return (
    <section aria-label="Week view" className="mb-6 border border-ink-700 bg-ink-900">
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-ink-700 px-4">
        <h2 className="t-label text-fog-300">{formatDate(days[0], { day: "numeric", month: "short" })} – {formatDate(days[6], { day: "numeric", month: "short" })} <span className="text-fog-500">· Asia/Vientiane (ICT, UTC+7)</span></h2>
        <div className="flex gap-1">
          <button type="button" onClick={() => setOffset((o) => o - 1)} className="t-label min-h-9 border border-ink-600 px-2.5 text-[0.625rem] text-fog-300 hover:border-yellow hover:text-yellow">Earlier</button>
          {offset !== 0 && <button type="button" onClick={() => setOffset(0)} className="t-label min-h-9 border border-ink-600 px-2.5 text-[0.625rem] text-fog-300 hover:border-yellow hover:text-yellow">This week</button>}
          <button type="button" onClick={() => setOffset((o) => o + 1)} className="t-label min-h-9 border border-ink-600 px-2.5 text-[0.625rem] text-fog-300 hover:border-yellow hover:text-yellow">Later</button>
        </div>
      </header>
      <div className="thin-scroll overflow-x-auto">
        <ol className="grid min-w-[56rem] grid-cols-7 divide-x divide-ink-800">
          {days.map((d) => {
            const list = byDay(d);
            return (
              <li key={d} className={clsx("min-h-32 p-2", d === today && "bg-ink-850")}>
                <p className={clsx("t-label mb-2 flex items-center justify-between text-[0.625rem]", d === today ? "text-yellow" : "text-fog-500")}><span>{formatDate(d, { weekday: "short", day: "numeric" })}{d === today ? " · today" : ""}</span>{list.length > 0 && <span className="t-data">{list.length}</span>}</p>
                <ul className="flex flex-col gap-1.5">
                  {list.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => onOpen(c.id)} className={clsx("block w-full border px-2 py-1.5 text-left hover:border-yellow", isOpen(c) ? "border-ink-600 bg-ink-950" : "border-ink-800 opacity-60")}>
                        <span className="t-data block text-xs text-fog-50">{vteTime(effectiveAt(c))} <span className="text-fog-500">· {c.duration_mins}m</span></span>
                        <span className="block truncate text-xs text-fog-300">{c.name}</span>
                        <StatusPill status={c.status} className="mt-1 !px-1 !py-0.5 !text-[0.5rem]" />
                      </button>
                    </li>
                  ))}
                  {list.length === 0 && <li className="text-xs text-fog-500/60">—</li>}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

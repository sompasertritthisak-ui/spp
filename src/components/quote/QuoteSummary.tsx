"use client";
import type { ProductLite } from "@/components/catalogue/lite";
import { formatDate, formatLak, formatNumber } from "@/lib/format";
import type { Line } from "./lines";

export type Band = { low: number; high: number; priced: number; complete: boolean };

/** One-line version for the mobile bar. */
export function bandLine(band: Band, count: number, live: boolean) {
  if (count === 0) return "Add a product to begin";
  if (!live || band.priced === 0) return "Priced in your written quotation";
  return `${formatLak(band.low)} – ${formatLak(band.high)}${band.complete ? "" : " + quoted items"}`;
}

export function BandFigure({ band, count, live }: { band: Band; count: number; live: boolean }) {
  if (count === 0) return <p className="text-fog-400">Add a product to begin.</p>;
  if (!live || band.priced === 0) return <p className="text-fog-300">Priced in your written quotation.</p>;
  return (
    <>
      <p className="t-data text-xl text-fog-50 sm:text-2xl">{formatLak(band.low)} – {formatLak(band.high)}</p>
      {!band.complete && <p className="mt-1 text-sm text-fog-400">+ {count - band.priced} {count - band.priced === 1 ? "item" : "items"} quoted individually</p>}
    </>
  );
}

export function QuoteSummary({ lines, bySlug, band, live, neededBy, bundleNote }: { lines: Line[]; bySlug: Map<string, ProductLite>; band: Band; live: boolean; neededBy: string; bundleNote?: string }) {
  return (
    <div>
      <p className="t-label flex items-center gap-3 text-fog-400"><span aria-hidden className="reg text-yellow" />Your request</p>
      {lines.length === 0 ? <p className="mt-5 text-fog-400">Nothing added yet.</p> : (
        <ul className="mt-5 rule-t">
          {lines.map((l) => (
            <li key={l.id} className="rule-b flex items-baseline justify-between gap-4 py-3">
              <span className="min-w-0 text-fog-100">{bySlug.get(l.product)?.name ?? l.product}{l.colour && <span className="text-fog-500"> · {l.colour}</span>}</span>
              <span className="t-data flex-none text-sm text-fog-300">× {formatNumber(l.qty)}</span>
            </li>
          ))}
        </ul>
      )}
      {bundleNote && <p className="mt-4 border border-yellow/40 p-3 text-sm text-fog-100">{bundleNote}</p>}
      {neededBy && <p className="mt-4 text-sm text-fog-300"><span className="t-label mr-2 text-fog-500">Needed by</span>{formatDate(neededBy)}</p>}
      <div aria-live="polite" className="mt-6 border-t border-ink-600 pt-5">
        <p className="t-label mb-2 text-fog-500">Running estimate</p>
        <BandFigure band={band} count={lines.length} live={live} />
        {live && band.priced > 0 && <p className="mt-3 text-sm text-fog-500">Estimate only. Your written quotation from SPP is the confirmed price.</p>}
      </div>
    </div>
  );
}

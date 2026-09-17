"use client";
import Link from "next/link";
import { useMemo } from "react";
import { formatLak, formatNumber } from "@/lib/format";
import { DesignPreview, useDesignsById } from "./designs/shared";
import { configSummary } from "./orders/shared";

export type Line = { id: string; product_slug: string; product_name: string; design_id: string | null; design_version: number | null; qty: number; config: unknown; unit_price_lak: number | null; line_total_lak: number | null; note?: string };

/** Quote / order lines with the design that will be printed. Prices appear only when the caller says SPP has published them. */
export function LineItems({ lines, showPrices }: { lines: Line[]; showPrices: boolean }) {
  const { byId, imageUrl } = useDesignsById(useMemo(() => lines.map((l) => l.design_id), [lines]));
  return (
    <ul className="border-t border-ink-700">
      {lines.map((l) => {
        const design = l.design_id ? byId.get(l.design_id) : undefined;
        const summary = configSummary(l.config);
        const total = l.line_total_lak ?? (l.unit_price_lak != null ? l.unit_price_lak * l.qty : null);
        return (
          <li key={l.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-ink-700 py-4 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
            <div className="row-span-2 border border-ink-700 bg-ink-850 p-1 sm:row-span-1">
              {design ? <DesignPreview design={design} imageUrl={imageUrl} className="h-auto w-full" /> : <div className="flex aspect-[25/28] items-center justify-center text-center"><span className="t-label text-[0.5625rem] leading-tight text-fog-500">{l.design_id ? "Design removed" : "No design"}</span></div>}
            </div>
            <div className="min-w-0">
              <p className="text-fog-50">{l.product_name}</p>
              <p className="t-data text-sm text-fog-300">Qty {formatNumber(l.qty)}</p>
              {summary && <p className="mt-1 break-words text-sm text-fog-400">{summary}</p>}
              {design && <p className="mt-1 text-sm"><Link href={`/design/?id=${design.id}`} className="t-data text-fog-400 underline-offset-4 hover:text-yellow hover:underline">{design.ref}</Link>{l.design_version ? <span className="t-data text-fog-500"> · v{l.design_version}</span> : null}</p>}
              {l.note && <p className="mt-1 break-words text-sm italic text-fog-400">“{l.note}”</p>}
            </div>
            {showPrices && (
              <div className="col-start-2 sm:col-start-3 sm:text-right">
                {l.unit_price_lak != null ? (<><p className="t-data text-fog-50">{formatLak(total)}</p><p className="t-data text-xs text-fog-500">{formatLak(l.unit_price_lak)} each</p></>) : <p className="text-sm text-fog-500">Included in total</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

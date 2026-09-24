"use client";
import { useState } from "react";
import { Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Plate";
import { Chip, QtyStepper } from "@/components/forms/controls";
import type { ProductLite } from "@/components/catalogue/lite";
import { METHODS } from "@/components/catalogue/methods";
import { ProductVisual } from "@/components/catalogue/ProductVisual";
import { formatLak, formatNumber } from "@/lib/format";
import type { PrintMethod } from "@/content/types";
import { LocationsPicker } from "./LocationsPicker";
import { sizesTotal, type Line } from "./lines";
import type { EstimateEntry } from "./useEstimates";

export function QuoteLineCard({ n, line, product: p, estimate, qtyError, onChange, onRemove }: {
  n: number; line: Line; product: ProductLite; estimate: EstimateEntry | null; qtyError?: string; onChange: (patch: Partial<Line>) => void; onRemove: () => void;
}) {
  const [showSizes, setShowSizes] = useState(sizesTotal(line.sizes) > 0);
  const colour = p.colours.find((c) => c.name === line.colour);
  const sized = sizesTotal(line.sizes);
  const est = estimate?.status === "ready" ? estimate.data : null;

  return (
    <li className="border border-gold/50 bg-gold/5">
      <div className="flex items-start gap-4 border-b border-gold/25 p-5 sm:gap-5 sm:p-6">
        <ProductVisual garment={p.garment} colour={colour?.hex ?? p.colours[0]?.hex} category={p.category} name={p.name} className="h-16 w-16 flex-none sm:h-20 sm:w-20" glyphClassName="h-full w-full p-1 text-fog-400" />
        <div className="min-w-0 flex-1">
          <p className="t-label text-gold">Item {String(n).padStart(2, "0")}</p>
          <h3 className="t-heading mt-1 text-fog-50">{p.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {line.designRef && (
              <span className="t-label inline-flex items-center gap-2 border border-gold/60 py-1 pl-2 text-[0.625rem] text-gold">
                {line.designRef}
                <button type="button" onClick={() => onChange({ designRef: undefined })} aria-label={`Detach design ${line.designRef}`} className="-my-1 flex h-7 w-7 items-center justify-center hover:text-fog-50">
                  <svg aria-hidden viewBox="0 0 10 10" className="h-2 w-2" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l8 8M9 1L1 9" /></svg>
                </button>
              </span>
            )}
            {line.qty < p.moq && <Badge tone="warn">Below usual minimum of {formatNumber(p.moq)}</Badge>}
          </div>
        </div>
        <button type="button" onClick={onRemove} className="t-label -mr-2 -mt-2 flex min-h-11 items-center px-2 text-fog-500 transition-colors hover:text-danger" aria-label={`Remove ${p.name}`}>Remove</button>
      </div>

      <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
        <div>
          <QtyStepper label={`Quantity (${p.priceUnit.replace(/^per /, "")})`} value={line.qty} onChange={(qty) => onChange({ qty })} />
          {qtyError && <p role="alert" className="mt-2 text-sm text-danger">{qtyError}</p>}
        </div>
        {p.printMethods.length > 1 ? (
          <Select label="Print method" value={line.method ?? ""} onChange={(e) => onChange({ method: e.target.value as PrintMethod })} hint="Not sure? Leave it — we will recommend one.">
            {p.printMethods.map((m) => <option key={m} value={m}>{METHODS[m].label}</option>)}
          </Select>
        ) : <div className="hidden sm:block" />}
        {p.colours.length > 0 && (
          <Select label="Colour" value={line.colour ?? ""} onChange={(e) => onChange({ colour: e.target.value || undefined })}>
            <option value="">Decide later</option>
            {p.colours.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </Select>
        )}
        <LocationsPicker areas={p.areas} value={line.locations ?? []} onChange={(locations) => onChange({ locations })} />
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {p.sizes.length > 1 && <Chip checked={showSizes} onChange={(v) => { setShowSizes(v); if (!v) onChange({ sizes: undefined }); }}>Add a size breakdown</Chip>}
          <Chip checked={Boolean(line.delivery)} onChange={(delivery) => onChange({ delivery })}>Include delivery</Chip>
        </div>
        {showSizes && p.sizes.length > 1 && (
          <fieldset className="sm:col-span-2">
            <legend className="t-label mb-3 text-fog-400">Sizes <span className="normal-case tracking-normal text-fog-500">— optional, you can send these later</span></legend>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
              {p.sizes.map((s) => (
                <label key={s} className="flex flex-col gap-1.5">
                  <span className="t-label text-fog-500">{s}</span>
                  <input type="number" inputMode="numeric" min={0} max={1000000} value={line.sizes?.[s] || ""} placeholder="0"
                    onChange={(e) => { const v = Math.max(0, Math.round(Number(e.target.value)) || 0); onChange({ sizes: { ...line.sizes, [s]: v } }); }}
                    className="t-data min-h-11 w-full border border-ink-600 bg-ink-950 px-2 text-center text-base text-fog-50 [appearance:textfield] focus:border-yellow focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" />
                </label>
              ))}
            </div>
            {sized > 0 && sized !== line.qty && (
              <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-fog-300">
                Sizes add up to {formatNumber(sized)}; quantity is {formatNumber(line.qty)}.
                <button type="button" onClick={() => onChange({ qty: sized })} className="t-label min-h-11 text-gold hover:text-fog-50">Use {formatNumber(sized)}</button>
              </p>
            )}
          </fieldset>
        )}
        <Input className="sm:col-span-2" label="Note for this item" maxLength={500} value={line.note ?? ""} onChange={(e) => onChange({ note: e.target.value })} placeholder="Fabric, finish, names and numbers, anything specific…" />
      </div>

      <div aria-live="polite" className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-gold/25 px-5 py-4 sm:px-6">
        <span className="t-label text-fog-500">Estimate for this item</span>
        {estimate === null || (est && est.mode === "quote") ? <span className="text-sm text-fog-300">Quoted individually</span>
          : estimate.status === "loading" ? <span className="skeleton h-5 w-40" />
          : estimate.status === "error" ? <span className="text-sm text-fog-400">Estimate unavailable — included in your written quote</span>
          : est ? <span className="t-data text-gold">{formatLak(est.totalLow)} – {formatLak(est.totalHigh)}</span> : null}
      </div>
    </li>
  );
}

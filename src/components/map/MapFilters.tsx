"use client";
import { clsx } from "clsx";
import type { BillboardKind, BillboardStatus } from "@/content/types";
import { KIND, KIND_ORDER } from "@/components/billboards/vocab";
import { Checkbox, Select } from "@/components/ui/Field";
import { SIZE_CLASSES, STATUS, STATUS_ORDER, type SizeClass } from "@/lib/geo/sites";
import { StatusGlyph } from "./StatusGlyph";

export type Filters = { status: BillboardStatus | null; kind: BillboardKind | null; province: string | null; size: SizeClass | null; lit: boolean };
export type FilterCounts = { status: Record<BillboardStatus, number>; kind: Record<BillboardKind, number>; province: { id: string; name: string; n: number }[]; size: Record<SizeClass, number>; lit: number; all: number };

const chip = "t-label flex min-h-11 items-center gap-2 border px-3 text-[0.625rem] transition-colors duration-150 disabled:opacity-40";

/** Status and type chips double as the map legend: each carries its glyph or mark, its word and a live count. */
export function MapFilters({ value, counts, onChange, onClear }: { value: Filters; counts: FilterCounts; onChange: (patch: Partial<Filters>) => void; onClear: () => void }) {
  const dirty = Boolean(value.status || value.kind || value.province || value.size || value.lit);
  return (
    <form role="search" aria-label="Filter billboard locations" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5">
      <fieldset>
        <legend className="t-label mb-3 text-fog-400">Status</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!value.status} onClick={() => onChange({ status: null })} className={clsx(chip, !value.status ? "border-gold text-gold" : "border-ink-600 text-fog-400 hover:border-gold/50 hover:text-fog-100")}>
            All <span className="t-data opacity-70">{counts.all}</span>
          </button>
          {STATUS_ORDER.map((s) => {
            const on = value.status === s;
            return (
              <button key={s} type="button" aria-pressed={on} disabled={!counts.status[s] && !on} onClick={() => onChange({ status: on ? null : s })} className={clsx(chip, on ? (s === "available" ? "border-gold text-gold" : s === "reserved" ? "border-sky text-sky" : s === "maintenance" ? "border-warn text-warn" : "border-fog-100 text-fog-50") : "border-ink-600 text-fog-300 hover:border-ink-500 hover:text-fog-50")}>
                <StatusGlyph status={s} size={13} />{STATUS[s].label} <span className="t-data opacity-70">{counts.status[s]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="t-label mb-3 text-fog-400">Type</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!value.kind} onClick={() => onChange({ kind: null })} className={clsx(chip, !value.kind ? "border-gold text-gold" : "border-ink-600 text-fog-400 hover:border-gold/50 hover:text-fog-100")}>All types</button>
          {KIND_ORDER.map((k) => {
            const on = value.kind === k;
            return (
              <button key={k} type="button" aria-pressed={on} disabled={!counts.kind[k] && !on} onClick={() => onChange({ kind: on ? null : k })} className={clsx(chip, on ? "border-gold text-gold" : "border-ink-600 text-fog-300 hover:border-ink-500 hover:text-fog-50")}>
                <span className={clsx("border px-1 text-[0.5625rem]", on ? "border-gold" : "border-fog-500")}>{KIND[k].short}</span>{KIND[k].label} <span className="t-data opacity-70">{counts.kind[k]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Select label="Province" value={value.province ?? ""} onChange={(e) => onChange({ province: e.target.value || null })}>
          <option value="">All provinces</option>
          {counts.province.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.n})</option>)}
        </Select>
        <Select label="Size class" value={value.size ?? ""} onChange={(e) => onChange({ size: (e.target.value || null) as SizeClass | null })}>
          <option value="">Any size</option>
          {SIZE_CLASSES.map((c) => <option key={c.key} value={c.key}>{c.label} · {c.hint} ({counts.size[c.key]})</option>)}
        </Select>
      </div>

      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <Checkbox checked={value.lit} onChange={(e) => onChange({ lit: e.target.checked })} label={<>Illuminated sites only <span className="t-data text-fog-500">({counts.lit})</span></>} />
        {dirty && <button type="button" onClick={onClear} className="t-label min-h-11 px-1 text-[0.625rem] text-fog-300 underline decoration-gold/40 underline-offset-4 hover:text-gold">Clear filters</button>}
      </div>
    </form>
  );
}

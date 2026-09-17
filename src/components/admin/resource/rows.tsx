"use client";
import { clsx } from "clsx";
import { useId } from "react";
import { FieldShell, inputCls, type FieldProps } from "./fields";

export type RowColumn<T> = { key: keyof T & string; label: string; placeholder?: string; grow?: number; options?: readonly { value: string; label: string }[]; type?: "text" | "colour" | "number" };

const iconBtn = "flex h-11 w-9 flex-none items-center justify-center text-fog-400 hover:text-fog-50 disabled:opacity-30";

/** Ordered list of small objects (hours, social links, stats, colours…): add, remove, reorder — never raw JSON. */
export function RowsField<T extends Record<string, string | number>>({ value, onChange, columns, blank, addLabel = "Add row", max = 40, rowErrors, ...p }: FieldProps & { value: T[]; onChange: (v: T[]) => void; columns: RowColumn<T>[]; blank: T; addLabel?: string; max?: number; rowErrors?: Record<number, string> }) {
  const id = useId();
  const set = (i: number, k: keyof T, v: string | number) => onChange(value.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= value.length) return; const n = [...value]; [n[i], n[j]] = [n[j]!, n[i]!]; onChange(n); };
  return (
    <FieldShell id={id} as="legend" {...p}>
      <div role="group" aria-labelledby={`${id}-lbl`} className="flex flex-col gap-2">
        {value.map((row, i) => (
          <div key={i}>
            <div className="flex flex-wrap items-start gap-2 border border-ink-700 bg-ink-950/50 p-2 sm:flex-nowrap sm:border-0 sm:bg-transparent sm:p-0">
              {columns.map((c) => {
                const label = `${c.label} ${i + 1}`;
                const v = row[c.key];
                return (
                  <div key={c.key} className="min-w-[8rem] flex-1" style={{ flexGrow: c.grow ?? 1 }}>
                    {c.options ? (
                      <select aria-label={label} disabled={p.disabled} value={String(v)} onChange={(e) => set(i, c.key, e.target.value)} className={clsx(inputCls, "pr-6")}>{c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    ) : c.type === "colour" ? (
                      <div className="flex gap-1"><input type="color" aria-label={`${label} picker`} disabled={p.disabled} value={/^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : "#000000"} onChange={(e) => set(i, c.key, e.target.value)} className="h-11 w-11 flex-none cursor-pointer border border-ink-600 bg-ink-950 p-1" /><input aria-label={label} disabled={p.disabled} value={String(v)} maxLength={7} placeholder="#000000" onChange={(e) => set(i, c.key, e.target.value.trim())} className={clsx(inputCls, "t-data")} /></div>
                    ) : (
                      <input aria-label={label} disabled={p.disabled} type={c.type === "number" ? "number" : "text"} value={v} placeholder={c.placeholder ?? c.label} onChange={(e) => set(i, c.key, c.type === "number" ? (Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber) : e.target.value)} className={clsx(inputCls, c.type === "number" && "t-data")} />
                    )}
                  </div>
                );
              })}
              <div className="flex flex-none">
                <button type="button" disabled={p.disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move row ${i + 1} up`} className={iconBtn}>↑</button>
                <button type="button" disabled={p.disabled || i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move row ${i + 1} down`} className={iconBtn}>↓</button>
                <button type="button" disabled={p.disabled} onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label={`Remove row ${i + 1}`} className={clsx(iconBtn, "hover:text-danger")}>×</button>
              </div>
            </div>
            {rowErrors?.[i] && <p role="alert" className="mt-1 text-xs text-danger">{rowErrors[i]}</p>}
          </div>
        ))}
        {value.length === 0 && <p className="text-sm text-fog-500">None yet.</p>}
        <button type="button" disabled={p.disabled || value.length >= max} onClick={() => onChange([...value, { ...blank }])} className="t-label min-h-10 self-start border border-dashed border-ink-600 px-3 text-fog-400 hover:border-yellow hover:text-yellow disabled:opacity-40">+ {addLabel}</button>
      </div>
    </FieldShell>
  );
}

/** Multi-choice over a fixed enum, as real checkboxes. */
export function CheckGroupField<T extends string>({ value, onChange, options, ...p }: FieldProps & { value: T[]; onChange: (v: T[]) => void; options: readonly { value: T; label: string; hint?: string }[] }) {
  const id = useId();
  return (
    <FieldShell id={id} as="legend" {...p}>
      <div role="group" aria-labelledby={`${id}-lbl`} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label key={o.value} title={o.hint} className={clsx("flex min-h-11 cursor-pointer items-center gap-2 border px-3 text-sm transition-colors focus-within:border-yellow", on ? "border-yellow/70 bg-yellow/10 text-fog-50" : "border-ink-600 text-fog-300 hover:border-ink-500", p.disabled && "pointer-events-none opacity-50")}>
              <input type="checkbox" className="sr-only" disabled={p.disabled} checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o.value) : options.filter((x) => x.value === o.value || value.includes(x.value)).map((x) => x.value))} />
              <span aria-hidden className={clsx("flex h-4 w-4 flex-none items-center justify-center border text-[0.625rem] leading-none", on ? "border-yellow bg-yellow text-ink-950" : "border-ink-500")}>{on ? "✓" : ""}</span>
              {o.label}
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}

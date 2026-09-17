"use client";
import { BRAND } from "@/lib/brand";
import { clsx } from "clsx";
import { useId, useState, type ReactNode } from "react";
import { isoToLocalInput, localInputToIso } from "./status";

/* Dense form controls for the Command Center. Every control is labelled, shows
   its own inline error and keeps a 44px touch target. */

export const inputCls = "min-h-11 w-full border border-ink-600 bg-ink-950 px-3 text-sm text-fog-50 placeholder:text-fog-500 hover:border-ink-500 focus:border-yellow focus:outline-none aria-[invalid=true]:border-danger disabled:opacity-50";

export type FieldProps = { label: string; hint?: ReactNode; error?: string | null; required?: boolean; className?: string; disabled?: boolean };

export function FieldShell({ id, label, hint, error, required, className, children, as = "label" }: FieldProps & { id: string; children: ReactNode; as?: "label" | "legend" }) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1.5", className)}>
      {as === "label"
        ? <label htmlFor={id} className="t-label text-fog-400">{label}{required && <span aria-hidden className="ml-1 text-yellow">*</span>}</label>
        : <span id={`${id}-lbl`} className="t-label text-fog-400">{label}{required && <span aria-hidden className="ml-1 text-yellow">*</span>}</span>}
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs leading-relaxed text-fog-500">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
const aria = (id: string, p: FieldProps) => ({ id, "aria-invalid": Boolean(p.error), "aria-describedby": p.error ? `${id}-err` : p.hint ? `${id}-hint` : undefined, disabled: p.disabled });

export function TextField({ value, onChange, placeholder, type = "text", inputMode, maxLength, autoComplete = "off", ...p }: FieldProps & { value: string; onChange: (v: string) => void; placeholder?: string; type?: "text" | "url" | "email" | "tel"; inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url"; maxLength?: number; autoComplete?: string }) {
  const id = useId();
  return <FieldShell id={id} {...p}><input {...aria(id, p)} type={type} inputMode={inputMode} maxLength={maxLength} autoComplete={autoComplete} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} /></FieldShell>;
}

export function AreaField({ value, onChange, rows = 4, maxLength, mono = false, placeholder, ...p }: FieldProps & { value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; mono?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} {...p} hint={maxLength ? <>{p.hint} <span className="t-data">{value.length}/{maxLength}</span></> : p.hint}>
      <textarea {...aria(id, p)} rows={rows} maxLength={maxLength} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={clsx(inputCls, "resize-y py-2.5 leading-relaxed", mono && "font-mono text-[0.8125rem]")} />
    </FieldShell>
  );
}

export function NumberField({ value, onChange, min, max, step, suffix, placeholder, ...p }: FieldProps & { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number | "any"; suffix?: string; placeholder?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} {...p}>
      <div className="relative">
        <input {...aria(id, p)} type="number" inputMode="decimal" min={min} max={max} step={step ?? "any"} placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" || Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber)} className={clsx(inputCls, "t-data", suffix && "pr-16")} />
        {suffix && <span aria-hidden className="t-label pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fog-500">{suffix}</span>}
      </div>
    </FieldShell>
  );
}

export function SelectField<T extends string>({ value, onChange, options, placeholder, ...p }: FieldProps & { value: T | ""; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; placeholder?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} {...p}>
      <div className="relative">
        <select {...aria(id, p)} value={value} onChange={(e) => onChange(e.target.value as T)} className={clsx(inputCls, "appearance-none pr-9")}>
          {placeholder != null && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg aria-hidden viewBox="0 0 12 8" className="pointer-events-none absolute right-3 top-1/2 h-2 w-3 -translate-y-1/2 text-fog-400" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l5 5 5-5" /></svg>
      </div>
    </FieldShell>
  );
}

export function ToggleField({ value, onChange, onLabel = "On", offLabel = "Off", ...p }: FieldProps & { value: boolean; onChange: (v: boolean) => void; onLabel?: string; offLabel?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} as="legend" {...p}>
      <button id={id} type="button" role="switch" aria-checked={value} aria-labelledby={`${id}-lbl`} disabled={p.disabled} onClick={() => onChange(!value)} className="flex min-h-11 items-center gap-3 self-start text-sm text-fog-100 disabled:opacity-50">
        <span aria-hidden className={clsx("relative h-5 w-9 flex-none border transition-colors", value ? "border-yellow bg-yellow/20" : "border-ink-500 bg-ink-950")}><span className={clsx("absolute top-0.5 h-3.5 w-3.5 transition-[left,background] duration-150", value ? "left-[1.125rem] bg-yellow" : "left-0.5 bg-fog-500")} /></span>
        {value ? onLabel : offLabel}
      </button>
    </FieldShell>
  );
}

/** String-array editor: Enter or comma adds, Backspace on empty removes the last, chips reorder with ← →. */
export function TagsField({ value, onChange, placeholder = "Type and press Enter", suggestions, max = 40, ...p }: FieldProps & { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: readonly string[]; max?: number }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).filter((s) => !value.includes(s));
    if (parts.length) onChange([...value, ...parts].slice(0, max));
    setDraft("");
  };
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= value.length) return; const next = [...value]; [next[i], next[j]] = [next[j]!, next[i]!]; onChange(next); };
  const left = suggestions?.filter((s) => !value.includes(s)) ?? [];
  return (
    <FieldShell id={id} {...p}>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((t, i) => (
            <li key={t} className="flex items-center border border-ink-600 bg-ink-850 text-sm text-fog-100">
              <button type="button" disabled={p.disabled} onClick={() => move(i, -1)} aria-label={`Move ${t} earlier`} className="px-1.5 py-1.5 text-fog-500 hover:text-fog-50 disabled:opacity-40">‹</button>
              <span className="max-w-[16rem] truncate py-1.5">{t}</span>
              <button type="button" disabled={p.disabled} onClick={() => move(i, 1)} aria-label={`Move ${t} later`} className="px-1.5 py-1.5 text-fog-500 hover:text-fog-50 disabled:opacity-40">›</button>
              <button type="button" disabled={p.disabled} onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="border-l border-ink-600 px-2 py-1.5 text-fog-400 hover:text-danger">×</button>
            </li>
          ))}
        </ul>
      )}
      <input {...aria(id, p)} value={draft} placeholder={placeholder} onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))} onBlur={() => draft.trim() && add(draft)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1)); }} className={inputCls} />
      {left.length > 0 && <div className="flex flex-wrap gap-1.5">{left.map((s) => <button key={s} type="button" disabled={p.disabled} onClick={() => add(s)} className="t-label border border-dashed border-ink-600 px-2 py-1.5 text-[0.625rem] text-fog-400 hover:border-yellow hover:text-yellow">+ {s}</button>)}</div>}
    </FieldShell>
  );
}

/** `date` columns use YYYY-MM-DD; timestamptz columns (withTime) round-trip through ISO. */
export function DateField({ value, onChange, withTime = false, min, max, ...p }: FieldProps & { value: string | null; onChange: (v: string | null) => void; withTime?: boolean; min?: string; max?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} {...p}>
      <div className="flex gap-2">
        <input {...aria(id, p)} type={withTime ? "datetime-local" : "date"} min={min} max={max} value={withTime ? isoToLocalInput(value) : (value ?? "").slice(0, 10)} onChange={(e) => onChange(withTime ? localInputToIso(e.target.value) : e.target.value || null)} className={clsx(inputCls, "t-data [color-scheme:dark]")} />
        {value && !p.required && <button type="button" disabled={p.disabled} onClick={() => onChange(null)} className="t-label flex-none border border-ink-600 px-3 text-fog-400 hover:border-ink-500 hover:text-fog-50">Clear</button>}
      </div>
    </FieldShell>
  );
}

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export function ColourField({ value, onChange, ...p }: FieldProps & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const valid = HEX_RE.test(value);
  return (
    <FieldShell id={id} {...p} error={p.error ?? (value && !valid ? `Use a 6-digit hex colour, e.g. ${BRAND.gold}.` : null)}>
      <div className="flex gap-2">
        <input type="color" aria-label={`${p.label} picker`} disabled={p.disabled} value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-11 w-12 flex-none cursor-pointer border border-ink-600 bg-ink-950 p-1" />
        <input {...aria(id, p)} value={value} maxLength={7} placeholder={BRAND.gold} onChange={(e) => onChange(e.target.value.trim())} className={clsx(inputCls, "t-data")} />
      </div>
    </FieldShell>
  );
}

/** "JSON-lite": a flat key → value map edited as rows, never as raw JSON. */
export function KeyValueField({ value, onChange, keyLabel = "Key", valueLabel = "Value", ...p }: FieldProps & { value: Record<string, string>; onChange: (v: Record<string, string>) => void; keyLabel?: string; valueLabel?: string }) {
  const id = useId();
  const [rows, setRows] = useState<{ k: string; v: string }[]>(() => Object.entries(value).map(([k, v]) => ({ k, v: String(v) })));
  const commit = (next: { k: string; v: string }[]) => { setRows(next); onChange(Object.fromEntries(next.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v]))); };
  return (
    <FieldShell id={id} as="legend" {...p}>
      <div role="group" aria-labelledby={`${id}-lbl`} className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <input aria-label={`${keyLabel} ${i + 1}`} disabled={p.disabled} value={r.k} placeholder={keyLabel} onChange={(e) => commit(rows.map((x, n) => (n === i ? { ...x, k: e.target.value } : x)))} className={inputCls} />
            <input aria-label={`${valueLabel} ${i + 1}`} disabled={p.disabled} value={r.v} placeholder={valueLabel} onChange={(e) => commit(rows.map((x, n) => (n === i ? { ...x, v: e.target.value } : x)))} className={inputCls} />
            <button type="button" disabled={p.disabled} aria-label={`Remove row ${i + 1}`} onClick={() => commit(rows.filter((_, n) => n !== i))} className="flex h-11 w-11 items-center justify-center border border-ink-600 text-fog-400 hover:border-danger hover:text-danger">×</button>
          </div>
        ))}
        <button type="button" disabled={p.disabled} onClick={() => setRows([...rows, { k: "", v: "" }])} className="t-label min-h-10 self-start border border-dashed border-ink-600 px-3 text-fog-400 hover:border-yellow hover:text-yellow">+ Add row</button>
      </div>
    </FieldShell>
  );
}

/** Section divider inside long forms. */
export function FormSection({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="border-t border-ink-700 pt-5 first:border-0 first:pt-0">
      <legend className="t-label float-left mb-4 w-full text-fog-300">{title}</legend>
      {note && <p className="clear-both -mt-2 mb-4 text-xs leading-relaxed text-fog-500">{note}</p>}
      <div className="clear-both grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

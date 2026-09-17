"use client";
import { Plus, X } from "lucide-react";
import { useState } from "react";

export type Swatch = { name: string; hex: string };
export const HEX = /^#[0-9a-fA-F]{6}$/;
export const MAX_SWATCHES = 24;

const field = "min-h-11 w-full border border-ink-600 bg-ink-900 px-3 text-base text-fog-50 placeholder:text-fog-500 hover:border-ink-500 focus:border-yellow focus:outline-none aria-[invalid=true]:border-danger";

export function PaletteEditor({ value, onChange }: { value: Swatch[]; onChange: (v: Swatch[]) => void }) {
  const patch = (i: number, p: Partial<Swatch>) => onChange(value.map((s, n) => (n === i ? { ...s, ...p } : s)));
  return (
    <fieldset>
      <legend className="t-label mb-3 text-fog-400">Brand colours</legend>
      {value.length === 0 && <p className="mb-3 text-fog-500">No colours saved yet. Add your primary colour first.</p>}
      <ul className="flex flex-col gap-2">
        {value.map((s, i) => {
          const valid = HEX.test(s.hex);
          return (
            <li key={i} className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[2.75rem_8rem_minmax(0,1fr)_2.75rem]">
              <input type="color" aria-label={`Pick colour ${i + 1}`} value={valid ? s.hex.toLowerCase() : "#000000"} onChange={(e) => patch(i, { hex: e.target.value })} className="h-11 w-11 cursor-pointer border border-ink-600 bg-ink-900 p-1" />
              <input aria-label={`Hex value for colour ${i + 1}`} value={s.hex} onChange={(e) => patch(i, { hex: e.target.value.trim() })} aria-invalid={!valid} maxLength={7} spellCheck={false} autoCapitalize="none" placeholder="#1A73E8" className={`${field} t-data col-start-2 uppercase`} />
              <input aria-label={`Name for colour ${i + 1}`} value={s.name} onChange={(e) => patch(i, { name: e.target.value })} maxLength={40} placeholder="Name, e.g. Primary blue" className={`${field} col-span-2 col-start-2 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1`} />
              <button type="button" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label={`Remove colour ${s.name || s.hex}`} className="col-start-3 row-start-1 flex h-11 w-11 items-center justify-center text-fog-400 hover:text-danger sm:col-start-4"><X aria-hidden className="h-4 w-4" strokeWidth={1.5} /></button>
            </li>
          );
        })}
      </ul>
      <button type="button" disabled={value.length >= MAX_SWATCHES} onClick={() => onChange([...value, { name: "", hex: "#808080" }])} className="t-label mt-3 inline-flex min-h-11 items-center gap-2 border border-dashed border-ink-500 px-4 text-fog-300 transition-colors hover:border-yellow hover:text-yellow disabled:opacity-40">
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />Add colour
      </button>
    </fieldset>
  );
}

export function FontList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const names = draft.split(",").map((s) => s.trim().slice(0, 80)).filter(Boolean);
    if (!names.length) return;
    onChange([...new Set([...value, ...names])].slice(0, 12));
    setDraft("");
  };
  return (
    <fieldset>
      <legend className="t-label mb-3 text-fog-400">Brand fonts</legend>
      {value.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {value.map((f) => (
            <li key={f} className="flex items-center border border-ink-600 pl-3 text-fog-100">
              {f}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== f))} aria-label={`Remove font ${f}`} className="flex h-11 w-10 items-center justify-center text-fog-400 hover:text-danger"><X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input aria-label="Font name" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} maxLength={200} placeholder="e.g. Helvetica Neue Bold" className={field} />
        <button type="button" onClick={add} disabled={!draft.trim() || value.length >= 12} className="t-label min-h-11 flex-none border border-ink-500 px-4 text-fog-100 hover:border-yellow hover:text-yellow disabled:opacity-40">Add</button>
      </div>
      <p className="mt-2 text-sm text-fog-500">Names only — they tell SPP designers what to match. Font files are not uploaded here.</p>
    </fieldset>
  );
}

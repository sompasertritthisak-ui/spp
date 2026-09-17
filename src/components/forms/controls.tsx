"use client";
import { clsx } from "clsx";
import { useId, useState, type ReactNode } from "react";
import { Plate } from "@/components/ui/Plate";

/** A form group with a plate-style legend. */
export function Group({ n, legend, hint, children, className }: { n?: string; legend: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={clsx("rule-t pt-8", className)}>
      <div id={id}><Plate n={n}>{legend}</Plate></div>
      {hint && <p className="mt-3 max-w-xl text-fog-400">{hint}</p>}
      <div className="mt-7 flex flex-col gap-6">{children}</div>
    </div>
  );
}

/** Radio group drawn as a segmented control. Real radios underneath, so arrows and forms just work. */
export function Segmented<T extends string | number>({ label, value, onChange, options, className }: {
  label: string; value: T | null; onChange: (v: T) => void; options: readonly { value: T; label: string; hint?: string }[]; className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={clsx("min-w-0", className)}>
      <legend className="t-label mb-2 text-fog-400">{label}</legend>
      <div className="flex flex-wrap gap-px border border-ink-600 bg-ink-600">
        {options.map((o) => (
          <label key={String(o.value)} className="relative min-w-[5.5rem] flex-1 cursor-pointer">
            <input type="radio" name={name} className="peer sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="flex min-h-12 flex-col items-center justify-center gap-0.5 bg-ink-900 px-3 py-2 text-center text-sm text-fog-300 transition-colors duration-150 hover:text-fog-50 peer-checked:bg-yellow peer-checked:text-ink-950 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-4px] peer-focus-visible:outline-ink-950">
              <span className="font-mono text-xs uppercase tracking-[0.1em]">{o.label}</span>
              {o.hint && <span className="text-xs opacity-70">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Toggle chip (checkbox semantics). */
export function Chip({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={clsx("relative inline-flex cursor-pointer", disabled && "opacity-45")}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="inline-flex min-h-11 items-center gap-2 border border-ink-600 px-4 text-sm text-fog-300 transition-colors duration-150 hover:border-ink-500 hover:text-fog-50 peer-checked:border-yellow peer-checked:text-yellow peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-yellow">
        <span aria-hidden className={clsx("h-2 w-2 border border-current", checked && "bg-yellow")} />
        {children}
      </span>
    </label>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Quantity with − / + and a typed value. Commits a clamped integer; never NaN. */
export function QtyStepper({ label, value, onChange, min = 1, max = 1_000_000, step = 1, size = "md", hideLabel = false }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; size?: "sm" | "md"; hideLabel?: boolean;
}) {
  const id = useId();
  // While typing, show the raw text so "1" → "15" is not clamped mid-keystroke.
  const [draft, setDraft] = useState<string | null>(null);
  const h = size === "sm" ? "h-11" : "h-12";
  const btn = clsx("flex w-11 flex-none items-center justify-center text-fog-300 transition-colors hover:bg-ink-800 hover:text-yellow disabled:opacity-40", h);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={clsx("t-label text-fog-400", hideLabel && "sr-only")}>{label}</label>
      <div className="inline-flex w-fit items-stretch border border-ink-600 bg-ink-900 focus-within:border-yellow">
        <button type="button" className={btn} aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step, min, max))}>
          <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" stroke="currentColor" strokeWidth="1.5"><path d="M1 6h10" /></svg>
        </button>
        <input
          id={id} type="number" inputMode="numeric" min={min} max={max} value={draft ?? String(value)}
          onChange={(e) => { setDraft(e.target.value); const v = Math.round(Number(e.target.value)); if (e.target.value !== "" && Number.isFinite(v) && v >= min) onChange(clamp(v, min, max)); }}
          onBlur={() => setDraft(null)}
          className={clsx("t-data w-20 border-x border-ink-600 bg-transparent text-center text-base text-fog-50 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none", h)}
        />
        <button type="button" className={btn} aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step, min, max))}>
          <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" stroke="currentColor" strokeWidth="1.5"><path d="M1 6h10M6 1v10" /></svg>
        </button>
      </div>
    </div>
  );
}

"use client";
import { clsx } from "clsx";
import { useId, type ComponentProps, type ReactNode } from "react";

const control =
  "w-full min-h-12 border border-ink-600 bg-ink-900 px-4 text-base text-fog-50 placeholder:text-fog-500 transition-colors duration-150 hover:border-ink-500 focus:border-yellow focus:outline-none aria-[invalid=true]:border-danger disabled:opacity-50";

type FieldShell = { label: string; hint?: string; error?: string; required?: boolean; className?: string };

function Shell({ id, label, hint, error, required, className, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="t-label text-fog-400">
        {label}
        {required && <span aria-hidden className="ml-1 text-yellow">*</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-fog-500">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="flex items-start gap-2 text-sm text-danger"><span aria-hidden>▲</span>{error}</p>}
    </div>
  );
}

const describe = (id: string, hint?: string, error?: string) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export function Input({ label, hint, error, required, className, ...rest }: FieldShell & Omit<ComponentProps<"input">, "className">) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input id={id} required={required} aria-invalid={Boolean(error)} aria-describedby={describe(id, hint, error)} className={control} {...rest} />
    </Shell>
  );
}

export function Textarea({ label, hint, error, required, className, rows = 4, ...rest }: FieldShell & Omit<ComponentProps<"textarea">, "className">) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea id={id} rows={rows} required={required} aria-invalid={Boolean(error)} aria-describedby={describe(id, hint, error)} className={clsx(control, "resize-y py-3 leading-relaxed")} {...rest} />
    </Shell>
  );
}

export function Select({ label, hint, error, required, className, children, ...rest }: FieldShell & Omit<ComponentProps<"select">, "className">) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative">
        <select id={id} required={required} aria-invalid={Boolean(error)} aria-describedby={describe(id, hint, error)} className={clsx(control, "appearance-none pr-10")} {...rest}>
          {children}
        </select>
        <svg aria-hidden viewBox="0 0 12 8" className="pointer-events-none absolute right-4 top-1/2 h-2 w-3 -translate-y-1/2 text-fog-400" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l5 5 5-5" /></svg>
      </div>
    </Shell>
  );
}

export function Checkbox({ label, className, ...rest }: { label: ReactNode; className?: string } & Omit<ComponentProps<"input">, "className" | "type">) {
  const id = useId();
  return (
    <div className={clsx("relative flex items-start gap-3", className)}>
      <input id={id} type="checkbox" className="peer mt-0.5 h-5 w-5 flex-none appearance-none border border-ink-500 bg-ink-900 transition-colors checked:border-yellow checked:bg-yellow" {...rest} />
      <svg aria-hidden viewBox="0 0 12 10" className="pointer-events-none absolute left-1 top-[0.4rem] hidden h-2.5 w-3 text-ink-950 peer-checked:block" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 5l3.5 3.5L11 1" /></svg>
      <label htmlFor={id} className="text-sm leading-relaxed text-fog-300">{label}</label>
    </div>
  );
}

/** Invisible to people, irresistible to bots. Server rejects any submission that fills it. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>Website<input tabIndex={-1} autoComplete="off" name="website" value={value} onChange={(e) => onChange(e.target.value)} /></label>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 border border-danger/50 bg-danger/10 p-4 text-sm text-fog-50">
      <span aria-hidden className="t-label mt-0.5 text-danger">Attention</span>
      <p>{message}</p>
    </div>
  );
}

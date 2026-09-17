"use client";
import { clsx } from "clsx";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { titleCase } from "@/lib/format";
import { adminInput } from "../ui";

/** Labelled control for dense drawer forms. The render-prop receives the id to wire onto the control. */
export function Labeled({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="t-label text-[0.625rem] text-fog-500">{label}</label>
      {children(id)}
      {hint && !error && <p className="text-xs text-fog-500">{hint}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function PickField<T extends string>({ label, value, options, onChange, disabled, className, labels }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void; disabled?: boolean; className?: string; labels?: Partial<Record<T, string>> }) {
  return (
    <Labeled label={label} className={className}>
      {(id) => (
        <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)} className={clsx(adminInput, "disabled:opacity-50")}>
          {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? titleCase(o)}</option>)}
        </select>
      )}
    </Labeled>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between gap-3 border-b border-ink-700 pb-2 first:mt-0">
      <h3 className="t-label text-fog-300">{children}</h3>
      {action}
    </div>
  );
}

export function Confirm({ open, title, body, confirmLabel, danger = false, pending = false, onConfirm, onClose, children }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; pending?: boolean; onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} size="sm" loading={pending} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="text-sm leading-relaxed text-fog-300">{body}</div>
      {children && <div className="mt-4">{children}</div>}
    </Dialog>
  );
}

/** Horizontal workflow stepper. Steps are buttons when `onPick` is given; state is shown by word + marker, not colour alone. */
export function Stepper<T extends string>({ steps, current, onPick, label, disabled }: { steps: readonly T[]; current: T; onPick?: (s: T) => void; label: string; disabled?: boolean }) {
  const at = steps.indexOf(current);
  return (
    <ol aria-label={label} className="thin-scroll flex overflow-x-auto border border-ink-700 bg-ink-950">
      {steps.map((s, i) => {
        const state = i < at ? "done" : i === at ? "current" : "todo";
        const inner = (
          <>
            <span aria-hidden className={clsx("t-data text-[0.625rem]", state === "current" ? "text-ink-950" : "text-fog-500")}>{String(i + 1).padStart(2, "0")}</span>
            <span className="whitespace-nowrap">{titleCase(s)}</span>
            <span className="sr-only">{state === "done" ? "(done)" : state === "current" ? "(current stage)" : ""}</span>
            {state === "done" && <svg aria-hidden viewBox="0 0 12 10" className="h-2 w-2.5 flex-none text-ok" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 5l3.5 3.5L11 1" /></svg>}
          </>
        );
        const cls = clsx("t-label flex min-h-11 w-full items-center gap-2 px-3 text-[0.625rem] transition-colors", state === "current" ? "bg-yellow text-ink-950" : state === "done" ? "text-fog-300" : "text-fog-500", onPick && state !== "current" && "hover:bg-ink-800 hover:text-fog-50");
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex-1 border-r border-ink-700 last:border-r-0">
            {onPick ? <button type="button" disabled={disabled || state === "current"} onClick={() => onPick(s)} className={cls}>{inner}</button> : <span className={cls}>{inner}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Due-date urgency as words: "3d overdue", "due today", "in 5d". */
export function DueTag({ days, done = false }: { days: number | null; done?: boolean }) {
  if (days == null) return <span className="text-fog-500">—</span>;
  if (done) return <span className="t-data text-xs text-fog-500">closed</span>;
  const tone = days < 0 ? "border-danger/50 text-danger" : days <= 3 ? "border-warn/50 text-warn" : "border-ink-600 text-fog-400";
  const text = days < 0 ? `${-days}d overdue` : days === 0 ? "due today" : `in ${days}d`;
  return <span className={clsx("t-label inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.625rem] whitespace-nowrap", tone)}>{days < 0 && <span aria-hidden>▲</span>}{text}</span>;
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return <input type="search" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={clsx(adminInput, "sm:max-w-xs")} />;
}

export function NoAccess({ what }: { what: string }) {
  return (
    <div className="border border-dashed border-ink-600 p-8">
      <span aria-hidden className="reg mb-4 block h-6 w-6 text-fog-500" />
      <p className="t-heading uppercase text-fog-50">Outside your remit</p>
      <p className="mt-2 max-w-md text-sm text-fog-400">Your role does not include {what}. If it should, ask an SPP administrator to update your role.</p>
    </div>
  );
}

export function SkeletonRows({ n = 4 }: { n?: number }) {
  return <div aria-busy="true" className="flex flex-col gap-2">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>;
}

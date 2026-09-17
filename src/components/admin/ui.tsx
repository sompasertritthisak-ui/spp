"use client";
import { clsx } from "clsx";
import type { ReactNode } from "react";

/* Command Center primitives. Dense, quiet, fast: mono labels, tabular figures, 1px rules. */

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="t-title text-fog-50">{title}</h1>
        {sub && <p className="mt-1.5 text-sm text-fog-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, action, children, className, flush = false }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={clsx("border border-ink-700 bg-ink-900", className)}>
      {(title || action) && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-ink-700 px-4">
          {title && <h2 className="t-label text-fog-300">{title}</h2>}
          {action}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, delta, hint, tone = "neutral" }: { label: string; value: ReactNode; delta?: string; hint?: string; tone?: "neutral" | "yellow" | "ok" | "danger" }) {
  const tones = { neutral: "text-fog-50", yellow: "text-yellow", ok: "text-ok", danger: "text-danger" } as const;
  return (
    <div className="border border-ink-700 bg-ink-900 p-4">
      <p className="t-label text-fog-500">{label}</p>
      <p className={clsx("t-data mt-3 text-3xl font-medium leading-none", tones[tone])}>{value}</p>
      {(delta || hint) && <p className="mt-2 text-xs text-fog-500">{delta && <span className="t-data mr-2 text-fog-300">{delta}</span>}{hint}</p>}
    </div>
  );
}

const pillTones: Record<string, string> = {
  new: "text-yellow border-yellow/50", submitted: "text-yellow border-yellow/50", requested: "text-yellow border-yellow/50", queued: "text-yellow border-yellow/50",
  contacted: "text-cyan border-cyan/40", in_review: "text-cyan border-cyan/40", in_progress: "text-cyan border-cyan/40", artwork_review: "text-cyan border-cyan/40", sent: "text-cyan border-cyan/40", scheduled: "text-cyan border-cyan/40", qc: "text-cyan border-cyan/40", quality_control: "text-cyan border-cyan/40", production: "text-cyan border-cyan/40", in_transit: "text-cyan border-cyan/40",
  qualified: "text-fog-50 border-fog-400", quote: "text-fog-50 border-fog-400", negotiation: "text-fog-50 border-fog-400", approved: "text-ok border-ok/40", saved: "text-fog-50 border-fog-400", draft: "text-fog-400 border-ink-500", reserved: "text-warn border-warn/40",
  won: "text-ok border-ok/40", accepted: "text-ok border-ok/40", confirmed: "text-ok border-ok/40", completed: "text-ok border-ok/40", done: "text-ok border-ok/40", pass: "text-ok border-ok/40", published: "text-ok border-ok/40", available: "text-ok border-ok/40", ready: "text-ok border-ok/40", delivered: "text-ok border-ok/40", installed: "text-ok border-ok/40", paid: "text-ok border-ok/40",
  lost: "text-danger border-danger/40", declined: "text-danger border-danger/40", cancelled: "text-danger border-danger/40", blocked: "text-danger border-danger/40", fail: "text-danger border-danger/40", failed: "text-danger border-danger/40", unavailable: "text-danger border-danger/40", urgent: "text-danger border-danger/40", expired: "text-danger border-danger/40",
  maintenance: "text-warn border-warn/40", needs_review: "text-warn border-warn/40", attention: "text-warn border-warn/40", high: "text-warn border-warn/40", archived: "text-fog-500 border-ink-600", unpaid: "text-warn border-warn/40", deposit: "text-cyan border-cyan/40",
};

/** Status is never colour-only: the word is always shown. */
export function StatusPill({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return null;
  return <span className={clsx("t-label inline-flex items-center border px-2 py-1 text-[0.625rem] whitespace-nowrap", pillTones[status] ?? "text-fog-300 border-ink-500", className)}>{status.replace(/_/g, " ")}</span>;
}

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode; className?: string; hideBelow?: "sm" | "md" | "lg" | "xl" };

export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty = "Nothing to show yet.", loading = false, caption }: { rows: T[] | null; columns: Column<T>[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void; empty?: string; loading?: boolean; caption: string }) {
  const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink-700 text-left">
            {columns.map((c) => <th key={c.key} scope="col" className={clsx("t-label h-10 whitespace-nowrap px-4 font-medium text-fog-500", c.hideBelow && hide[c.hideBelow], c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading && !rows && Array.from({ length: 6 }, (_, i) => (
            <tr key={i} className="border-b border-ink-800"><td colSpan={columns.length} className="px-4 py-3"><div className="skeleton h-5 w-full" /></td></tr>
          ))}
          {rows?.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(r); } } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={clsx("border-b border-ink-800 transition-colors", onRowClick && "cursor-pointer hover:bg-ink-850 focus-visible:bg-ink-850")}
            >
              {columns.map((c) => <td key={c.key} className={clsx("px-4 py-3 align-middle text-fog-100", c.hideBelow && hide[c.hideBelow], c.className)}>{c.cell(r)}</td>)}
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-fog-500">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Right-hand detail drawer for a selected record. */
export function Drawer({ open, onClose, title, sub, children, footer }: { open: boolean; onClose: () => void; title: string; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-ink-600 bg-ink-900 shadow-2xl shadow-black [animation:register_.25s_var(--ease-press)]">
        <header className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
          <div className="min-w-0"><h2 className="t-heading truncate text-fog-50">{title}</h2>{sub && <div className="mt-1 text-sm text-fog-400">{sub}</div>}</div>
          <button type="button" autoFocus onClick={onClose} aria-label="Close" className="flex h-10 w-10 flex-none items-center justify-center text-fog-400 hover:text-fog-50">
            <svg aria-hidden viewBox="0 0 14 14" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l12 12M13 1L1 13" /></svg>
          </button>
        </header>
        <div className="thin-scroll flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-ink-700 px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: string; count?: number | null }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="thin-scroll mb-4 flex gap-1 overflow-x-auto border-b border-ink-700">
      {tabs.map((t) => (
        <button key={t.value} role="tab" type="button" aria-selected={value === t.value} onClick={() => onChange(t.value)} className={clsx("t-label -mb-px flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 transition-colors", value === t.value ? "border-yellow text-fog-50" : "border-transparent text-fog-500 hover:text-fog-200")}>
          {t.label}
          {t.count != null && <span className="t-data text-fog-500">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Meta({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
      {items.map((i) => (
        <div key={i.label} className="contents"><dt className="t-label pt-0.5 text-fog-500">{i.label}</dt><dd className="min-w-0 break-words text-fog-100">{i.value ?? "—"}</dd></div>
      ))}
    </dl>
  );
}

export function ErrorNote({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-fog-50">
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="t-label text-danger hover:text-fog-50">Retry</button>}
    </div>
  );
}

export const adminInput = "min-h-10 w-full border border-ink-600 bg-ink-950 px-3 text-sm text-fog-50 placeholder:text-fog-500 hover:border-ink-500 focus:border-yellow focus:outline-none";

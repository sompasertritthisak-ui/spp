"use client";
import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";

/* My SPP primitives: the public site's language at portal density. */

export function PortalHeader({ title, sub, actions, back }: { title: string; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-8 flex flex-col gap-4">
      {back && <Link href={back.href} className="t-label inline-flex min-h-11 w-fit items-center gap-2 text-fog-400 transition-colors hover:text-yellow"><span aria-hidden>←</span>{back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="t-title break-words text-fog-50">{title}</h1>
          {sub && <div className="mt-2 max-w-2xl text-fog-400">{sub}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Block({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("mb-10", className)}>
      <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-ink-700">
        <h2 className="t-label text-fog-300">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function RowsSkeleton({ rows = 4, tall = false }: { rows?: number; tall?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => <div key={i} className={clsx("skeleton w-full", tall ? "h-24" : "h-14")} />)}
    </div>
  );
}

export function GridSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: items }, (_, i) => <div key={i} className="skeleton aspect-[4/5] w-full" />)}
    </div>
  );
}

/** Horizontal stage stepper. The current stage is named in text, never by colour alone. */
export function Stepper({ steps, current, label, halted }: { steps: readonly { key: string; label: string }[]; current: string; label: string; halted?: string }) {
  const at = steps.findIndex((s) => s.key === current);
  return (
    <div>
      <p className="sr-only">{label}: {halted ?? `step ${at + 1} of ${steps.length}, ${steps[at]?.label ?? current}`}</p>
      <ol aria-hidden className="thin-scroll flex overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const done = !halted && i < at;
          const now = !halted && i === at;
          return (
            <li key={s.key} className="flex min-w-[5.5rem] flex-1 flex-col gap-2 pr-1">
              <span className={clsx("h-1", done ? "bg-fog-300" : now ? "bg-yellow" : "bg-ink-600")} />
              <span className={clsx("t-label text-[0.625rem] leading-snug", now ? "text-yellow" : done ? "text-fog-300" : "text-fog-500")}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A ruled, fully-clickable list row. */
export function RowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={clsx("group flex min-h-16 items-center gap-4 border-b border-ink-700 py-3 transition-colors hover:bg-ink-900 focus-visible:bg-ink-900 sm:px-3", className)}>
      {children}
      <span aria-hidden className="ml-auto flex-none text-fog-500 transition-transform duration-200 ease-[var(--ease-press)] group-hover:translate-x-1 group-hover:text-yellow">→</span>
    </Link>
  );
}

export const PREFLIGHT_DISCLAIMER = "Automated preflight checks are advisory. Final production approval is subject to SPP review.";

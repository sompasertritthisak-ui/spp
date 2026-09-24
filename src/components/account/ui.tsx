"use client";
import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";

/* My SPP primitives: the public site's language at portal density. */

export function PortalHeader({ title, sub, actions, back, glow = false, tone = "ink" }: { title: string; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; glow?: boolean; tone?: "ink" | "gold" }) {
  return (
    <header className={clsx("mb-8 flex flex-col gap-4", glow && "glow-brand relative isolate")}>
      {back && <Link href={back.href} className="t-label inline-flex min-h-11 w-fit items-center gap-2 text-fog-400 transition-colors hover:text-gold"><span aria-hidden>←</span>{back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span aria-hidden className="gold-bar mb-4" />
          <h1 className={clsx("t-title break-words", tone === "gold" ? "text-gold" : "text-fog-50")}>{title}</h1>
          {sub && <div className="mt-2 max-w-2xl text-fog-400">{sub}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Block({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("mb-10", className)}>
      <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-gold/25">
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
              <span className={clsx("h-1", done ? "bg-gold/40" : now ? "bg-gold" : "bg-ink-600")} />
              <span className={clsx("t-label text-[0.625rem] leading-snug", now ? "text-gold" : done ? "text-fog-300" : "text-fog-500")}>{s.label}</span>
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
    <Link href={href} className={clsx("group flex min-h-16 items-center gap-4 border-b border-ink-700 py-3 transition-colors hover:bg-gold/5 focus-visible:bg-gold/5 sm:px-3", className)}>
      {children}
      <span aria-hidden className="ml-auto flex-none text-fog-500 transition-transform duration-200 ease-[var(--ease-press)] group-hover:translate-x-1 group-hover:text-gold">→</span>
    </Link>
  );
}

/** The shared EmptyState is ruled in ink; the portal empties are ruled in gold so an empty screen still carries the brand. */
export function PortalEmpty({ title = "Nothing here yet.", body = "Your next project could start here.", action }: { title?: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-gold/40 p-8 sm:p-12">
      <span aria-hidden className="reg h-6 w-6 text-gold" />
      <p className="t-heading uppercase text-fog-50">{title}</p>
      <p className="max-w-md text-fog-400">{body}</p>
      {action}
    </div>
  );
}

/** Status pill for the one state that is the customer's to act on — gold, unlike the semantic tones of StatusPill. */
export function ActionPill({ children }: { children: ReactNode }) {
  return <span className="t-label inline-flex items-center whitespace-nowrap border border-gold/60 bg-gold/10 px-2 py-1 text-[0.625rem] text-gold">{children}</span>;
}

export const PREFLIGHT_DISCLAIMER = "Automated preflight checks are advisory. Final production approval is subject to SPP review.";

/** Notification links come from the database; only follow same-site relative paths. */
export const internalHref = (href: string | null | undefined, fallback = "/account/notifications/") =>
  href && href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : fallback;

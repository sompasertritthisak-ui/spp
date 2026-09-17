"use client";
import Link from "next/link";
import { Fragment } from "react";
import { clsx } from "clsx";

export type TraceNode = { step: string; label: string; detail?: string; href?: string; state: "done" | "current" | "pending" | "problem" };

/** Lead → Quote → Order → Jobs → QC → Delivery. Every commercial action stays connected to the request that started it. */
export function Traceability({ nodes, reorderOf, reorders }: { nodes: TraceNode[]; reorderOf: { id: string; ref: string } | null; reorders: { id: string; ref: string }[] }) {
  return (
    <section aria-label="Traceability" className="border border-ink-700 bg-ink-950">
      <h3 className="t-label border-b border-ink-700 px-3 py-2 text-[0.625rem] text-fog-500">Traceability</h3>
      <div className="thin-scroll overflow-x-auto">
        <ol className="flex min-w-max items-stretch p-3">
          {nodes.map((n, i) => {
            const body = (
              <>
                <span className="t-label flex items-center gap-1.5 text-[0.5625rem] text-fog-500"><span aria-hidden className={clsx("h-1.5 w-1.5", n.state === "done" ? "bg-ok" : n.state === "current" ? "bg-yellow" : n.state === "problem" ? "bg-danger" : "bg-ink-500")} />{n.step}</span>
                <span className={clsx("t-data mt-1 block whitespace-nowrap text-xs", n.state === "pending" ? "text-fog-500" : "text-fog-50")}>{n.label}</span>
                {n.detail && <span className="mt-0.5 block whitespace-nowrap text-[0.6875rem] text-fog-400">{n.detail}</span>}
              </>
            );
            return (
              <Fragment key={n.step}>
                {i > 0 && <li aria-hidden className="flex items-center px-1.5 text-fog-500"><svg viewBox="0 0 20 10" className="h-2 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M0 5h18M14 1l4 4-4 4" /></svg></li>}
                <li>{n.href ? <Link href={n.href} className={clsx("block min-h-14 border px-3 py-2 transition-colors hover:border-yellow", n.state === "current" ? "border-yellow/60 bg-ink-900" : "border-ink-700")}>{body}</Link> : <div className={clsx("min-h-14 border px-3 py-2", n.state === "current" ? "border-yellow/60 bg-ink-900" : "border-dashed border-ink-700")}>{body}</div>}</li>
              </Fragment>
            );
          })}
        </ol>
      </div>
      {(reorderOf || reorders.length > 0) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-700 px-3 py-2 text-xs text-fog-300">
          {reorderOf && <span>Reorder of <Link href={`/admin/orders/?id=${reorderOf.id}`} className="t-data text-fog-50 underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">{reorderOf.ref}</Link></span>}
          {reorders.length > 0 && <span>Reordered as {reorders.map((r, i) => <Fragment key={r.id}>{i > 0 && ", "}<Link href={`/admin/orders/?id=${r.id}`} className="t-data text-fog-50 underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">{r.ref}</Link></Fragment>)}</span>}
        </p>
      )}
    </section>
  );
}

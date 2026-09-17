"use client";
import { formatNumber } from "@/lib/format";
import { Board } from "../ops/Board";
import { daysUntil } from "../ops/data";
import { DesignMini } from "../ops/DesignArt";
import { DueTag } from "../ops/parts";
import type { ProductionStatus } from "@/lib/backend/db-types";
import { JOB_COLUMNS, type Job, type OrderCtx } from "./shared";

export function JobsBoard({ jobs, loading, orders, staffName, now, onMove, onOpen }: { jobs: Job[] | null; loading: boolean; orders: Record<string, OrderCtx>; staffName: (id: string | null) => string; now: number; onMove: (job: Job, to: ProductionStatus) => void; onOpen: (id: string) => void }) {
  return (
    <Board
      label="Production board" columns={JOB_COLUMNS} items={jobs} loading={loading} statusOf={(j) => j.status} onMove={onMove} emptyHint="No jobs here."
      columnMeta={(key, rows) => { const late = key === "done" ? 0 : rows.filter((j) => (daysUntil(j.deadline, now) ?? 0) < 0).length; return late ? <span className="text-danger">▲ {late} overdue</span> : `${formatNumber(rows.reduce((t, j) => t + j.qty, 0))} pcs`; }}
      renderCard={(j) => {
        const o = orders[j.order_id];
        const late = j.status !== "done" && (daysUntil(j.deadline, now) ?? 0) < 0;
        return (
          <button type="button" onClick={() => onOpen(j.id)} className={`flex w-full gap-3 p-3 text-left hover:bg-ink-800 focus-visible:bg-ink-800 ${late ? "border-l-2 border-danger" : ""}`}>
            <DesignMini designId={j.design_id} version={j.final_artwork_version} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fog-50">{j.product_name} <span className="t-data text-fog-300">× {formatNumber(j.qty)}</span></span>
              <span className="t-data block truncate text-[0.6875rem] text-fog-400">{j.ref.replace("SPP-", "")}{o ? ` · ${o.ref.replace("SPP-", "")}` : ""}</span>
              <span className="block truncate text-[0.6875rem] text-fog-500">{[j.print_method, j.materials, j.final_artwork_version ? `art v${j.final_artwork_version}` : null].filter(Boolean).join(" · ") || "No method set"}</span>
              {j.status === "blocked" && j.blocked_reason && <span className="mt-1 block truncate text-[0.6875rem] text-danger">▲ {j.blocked_reason}</span>}
              <span className="mt-1.5 flex items-center justify-between gap-2 text-[0.6875rem] text-fog-500"><span className="truncate">{staffName(j.assigned_to)}</span><DueTag days={daysUntil(j.deadline, now)} done={j.status === "done"} /></span>
            </span>
          </button>
        );
      }}
    />
  );
}

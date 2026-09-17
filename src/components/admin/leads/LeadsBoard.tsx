"use client";
import { formatLakShort, relativeTime, titleCase } from "@/lib/format";
import { Board } from "../ops/Board";
import { daysUntil } from "../ops/data";
import { DueTag } from "../ops/parts";
import { StatusPill } from "../ui";
import { LEAD_STATUSES, type Lead, type MoveLead } from "./constants";

const COLUMNS = LEAD_STATUSES.map((s) => ({ key: s, label: titleCase(s) }));

export function LeadsBoard({ leads, loading, canEdit, onMove, onOpen, staffName, now }: { leads: Lead[] | null; loading: boolean; canEdit: boolean; onMove: MoveLead; onOpen: (id: string) => void; staffName: (id: string | null) => string; now: number }) {
  return (
    <Board
      label="Lead pipeline" columns={COLUMNS} items={leads} loading={loading} canMove={canEdit} statusOf={(l) => l.status} onMove={onMove} emptyHint="No leads at this stage."
      columnMeta={(_, rows) => { const v = rows.reduce((t, l) => t + Number(l.estimated_value_lak ?? 0), 0); return v > 0 ? formatLakShort(v) : "—"; }}
      renderCard={(l) => (
        <button type="button" onClick={() => onOpen(l.id)} className="block w-full p-3 text-left hover:bg-ink-800 focus-visible:bg-ink-800">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0"><span className="block truncate text-sm font-medium text-fog-50">{l.name}</span>{l.company_name && <span className="block truncate text-xs text-fog-400">{l.company_name}</span>}</span>
            {(l.priority === "high" || l.priority === "urgent") && <StatusPill status={l.priority} />}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-fog-500">
            <span className="t-data">{l.ref.replace("SPP-LEAD-", "")}</span><span>· {titleCase(l.source)}</span>
            {l.estimated_value_lak != null && <span className="t-data text-fog-300">· {formatLakShort(Number(l.estimated_value_lak))}</span>}
          </span>
          <span className="mt-2 flex items-center justify-between gap-2 text-[0.6875rem] text-fog-500">
            <span className="truncate">{staffName(l.assigned_to)}</span>
            {l.follow_up_on && l.status !== "won" && l.status !== "lost" ? <DueTag days={daysUntil(l.follow_up_on, now)} /> : <span>{relativeTime(l.created_at)}</span>}
          </span>
        </button>
      )}
    />
  );
}

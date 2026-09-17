"use client";
import { useMemo, useState } from "react";
import { formatDate, formatLakShort, relativeTime, titleCase } from "@/lib/format";
import { daysUntil, isoDay, type StaffMember } from "../ops/data";
import { DueTag, SearchBox } from "../ops/parts";
import { adminInput, DataTable, StatusPill, type Column } from "../ui";
import { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, PRIORITY_RANK, type Lead } from "./constants";

type Filters = { status: string; source: string; priority: string; assigned: string; due: string; sort: string };
const SORTS = { newest: "Newest first", oldest: "Oldest first", value: "Value, high to low", follow: "Follow-up, soonest", priority: "Priority" } as const;

export function LeadsTable({ leads, loading, filters, setFilter, staff, staffName, myId, onOpen, now }: { leads: Lead[] | null; loading: boolean; filters: Filters; setFilter: (patch: Partial<Filters>) => void; staff: StaffMember[]; staffName: (id: string | null) => string; myId: string | undefined; onOpen: (id: string) => void; now: number }) {
  const [q, setQ] = useState("");
  const today = isoDay(now);
  const rows = useMemo(() => {
    if (!leads) return null;
    const term = q.trim().toLowerCase();
    const out = leads.filter((l) =>
      (!filters.status || l.status === filters.status) && (!filters.source || l.source === filters.source) &&
      (!filters.priority || (filters.priority === "hot" ? (l.priority === "high" || l.priority === "urgent") && l.status !== "won" && l.status !== "lost" : l.priority === filters.priority)) &&
      (!filters.assigned || (filters.assigned === "none" ? !l.assigned_to : filters.assigned === "me" ? l.assigned_to === myId : l.assigned_to === filters.assigned)) &&
      (!filters.due || (Boolean(l.follow_up_on) && l.follow_up_on! <= today && l.status !== "won" && l.status !== "lost")) &&
      (!term || `${l.name} ${l.company_name} ${l.ref} ${l.email ?? ""}`.toLowerCase().includes(term)));
    const by: Record<string, (a: Lead, b: Lead) => number> = {
      newest: (a, b) => b.created_at.localeCompare(a.created_at), oldest: (a, b) => a.created_at.localeCompare(b.created_at),
      value: (a, b) => Number(b.estimated_value_lak ?? -1) - Number(a.estimated_value_lak ?? -1),
      follow: (a, b) => (a.follow_up_on ?? "9999").localeCompare(b.follow_up_on ?? "9999"), priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    };
    return [...out].sort(by[filters.sort] ?? by.newest);
  }, [leads, q, filters, myId, today]);

  const columns: Column<Lead>[] = [
    { key: "lead", header: "Lead", cell: (l) => <span className="block min-w-40"><span className="block font-medium text-fog-50">{l.name}</span><span className="block text-xs text-fog-400">{l.company_name || l.email || l.phone}</span></span> },
    { key: "status", header: "Status", cell: (l) => <span className="flex flex-wrap gap-1"><StatusPill status={l.status} />{(l.priority === "high" || l.priority === "urgent") && <StatusPill status={l.priority} />}</span> },
    { key: "value", header: "Est. value", className: "text-right", hideBelow: "sm", cell: (l) => <span className="t-data">{l.estimated_value_lak != null ? formatLakShort(Number(l.estimated_value_lak)) : "—"}</span> },
    { key: "source", header: "Source", hideBelow: "md", cell: (l) => <span className="text-fog-300">{titleCase(l.source)}</span> },
    { key: "owner", header: "Assigned", hideBelow: "lg", cell: (l) => <span className="text-fog-300">{staffName(l.assigned_to)}</span> },
    { key: "follow", header: "Follow-up", hideBelow: "md", cell: (l) => (l.follow_up_on ? <span className="flex items-center gap-2"><span className="t-data text-xs text-fog-400">{formatDate(l.follow_up_on, { day: "numeric", month: "short" })}</span><DueTag days={daysUntil(l.follow_up_on, now)} done={l.status === "won" || l.status === "lost"} /></span> : <span className="text-fog-500">—</span>) },
    { key: "ref", header: "Ref", hideBelow: "xl", cell: (l) => <span className="t-data text-xs text-fog-400">{l.ref}</span> },
    { key: "age", header: "Created", hideBelow: "lg", cell: (l) => <span className="t-data text-xs text-fog-400">{relativeTime(l.created_at)}</span> },
  ];
  const sel = (label: string, key: keyof Filters, opts: [string, string][]) => (
    <select aria-label={label} value={filters[key]} onChange={(e) => setFilter({ [key]: e.target.value })} className={`${adminInput} w-auto min-w-32 flex-1 sm:flex-none`}>
      {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
  const active = Object.entries(filters).some(([k, v]) => k !== "sort" && v);

  return (
    <div className="border border-ink-700 bg-ink-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3">
        <SearchBox value={q} onChange={setQ} label="Search leads" placeholder="Name, company, ref or email…" />
        {sel("Status", "status", [["", "All statuses"], ...LEAD_STATUSES.map((s): [string, string] => [s, titleCase(s)])])}
        {sel("Source", "source", [["", "All sources"], ...LEAD_SOURCES.map((s): [string, string] => [s, titleCase(s)])])}
        {sel("Priority", "priority", [["", "Any priority"], ["hot", "High + urgent (open)"], ...PRIORITIES.map((s): [string, string] => [s, titleCase(s)])])}
        {sel("Assigned to", "assigned", [["", "Anyone"], ["me", "Me"], ["none", "Unassigned"], ...staff.map((s): [string, string] => [s.id, s.full_name || s.email])])}
        <label className="flex min-h-10 items-center gap-2 border border-ink-600 px-3 text-sm text-fog-300"><input type="checkbox" checked={Boolean(filters.due)} onChange={(e) => setFilter({ due: e.target.checked ? "1" : "" })} className="accent-[var(--color-yellow)]" />Follow-up due</label>
        {sel("Sort", "sort", Object.entries(SORTS))}
        {active && <button type="button" onClick={() => setFilter({ status: "", source: "", priority: "", assigned: "", due: "" })} className="t-label min-h-10 px-2 text-[0.625rem] text-yellow hover:text-fog-50">Clear filters</button>}
        <p className="t-data ml-auto text-xs text-fog-500" aria-live="polite">{rows ? `${rows.length} of ${leads?.length ?? 0}` : ""}</p>
      </div>
      <DataTable caption="Leads" rows={rows} columns={columns} rowKey={(l) => l.id} onRowClick={(l) => onOpen(l.id)} loading={loading} empty={active || q ? "No leads match these filters." : "No leads yet. Enquiries from the site arrive here automatically."} />
    </div>
  );
}

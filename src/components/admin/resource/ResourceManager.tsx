"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { canDo, useAuth } from "@/lib/backend/auth";
import type { TableName, Tables } from "@/lib/backend/db-types";
import { DataTable, Drawer, ErrorNote, Panel, StatusPill, Tabs, type Column } from "../ui";
import { inputCls } from "./fields";
import { ResourceEditor, type EditorActions } from "./ResourceEditor";
import { displayStatus } from "./status";
import type { ResourceConfig, Values } from "./types";
import { useResource } from "./useResource";
import { useSelection } from "./useSelection";

type Tab = "all" | "draft" | "scheduled" | "published" | "archived";

/**
 * List + editor for one table, driven entirely by a ResourceConfig.
 * Must be rendered inside <Suspense> (selection lives in the query string).
 */
export function ResourceManager<K extends TableName>({ config }: { config: ResourceConfig<K> }) {
  type Row = Tables[K] & { id: string };
  const { profile } = useAuth();
  const canWrite = (Array.isArray(config.cap) ? config.cap : [config.cap]).some((c) => canDo(profile?.role, c));
  const sel = useSelection(config.idKey, config.newKey);
  const res = useResource(config.table, { order: config.order, singular: config.singular });
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const sf = config.statusField;

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, draft: 0, scheduled: 0, published: 0, archived: 0 };
    for (const r of res.rows ?? []) { c.all++; if (sf) { const s = displayStatus(r as Values, sf) as Tab; if (s in c) c[s]++; } }
    return c;
  }, [res.rows, sf]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (res.rows ?? []).filter((r) => (tab === "all" || !sf || displayStatus(r as Values, sf) === tab) && (!t || config.search(r).toLowerCase().includes(t)));
  }, [res.rows, q, tab, sf, config]);

  const reorderable = Boolean(config.sortField) && canWrite && tab === "all" && !q.trim();
  const move = async (row: Row, dir: -1 | 1) => {
    const field = config.sortField;
    if (!field || !res.rows) return;
    const list = [...res.rows];
    const i = list.findIndex((r) => r.id === row.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    res.setRows(list.map((r, n) => ({ ...r, [field]: n + 1 })));
    // renumber only what actually changed; roll everything back if any write is refused
    const changed = list.map((r, n) => ({ r, n: n + 1 })).filter(({ r, n }) => (r as Values)[field] !== n);
    const results = await Promise.all(changed.map(({ r, n }) => res.update(r.id, { [field]: n }, { quiet: true })));
    if (results.some((x) => !x)) void res.reload();
  };

  const duplicate = async (row: Row) => {
    const omit = new Set(["id", "created_at", "updated_at", "published_at", "publish_at", ...(config.duplicateOmit ?? [])]);
    const copy: Values = Object.fromEntries(Object.entries(row as Values).filter(([k]) => !omit.has(k)));
    if (typeof copy.slug === "string") { const taken = new Set((res.rows ?? []).map((r) => (r as Values).slug)); let s = `${copy.slug}-copy`; for (let n = 2; taken.has(s); n++) s = `${copy.slug}-copy-${n}`; copy.slug = s; }
    for (const k of ["name", "title", "goal", "q"]) if (typeof copy[k] === "string") { copy[k] = `${copy[k]} (copy)`; break; }
    if (sf) copy[sf] = "draft";
    const made = await res.create(copy, { quiet: false });
    if (made) sel.open(made.id);
  };
  const actions: EditorActions<K> = { create: res.create, update: res.update, remove: res.remove, duplicate };

  const columns = useMemo<Column<Row>[]>(() => [
    ...(config.columns as Column<Row>[]),
    ...(sf ? [{ key: "_status", header: "Status", cell: (r: Row) => <StatusPill status={displayStatus(r as Values, sf)} /> }] : []),
    ...(reorderable ? [{
      key: "_order", header: "Order", className: "w-24",
      cell: (r: Row) => (
        <span className="flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Move up" onClick={() => void move(r, -1)} className="h-9 w-9 text-fog-400 hover:text-yellow">↑</button>
          <button type="button" aria-label="Move down" onClick={() => void move(r, 1)} className="h-9 w-9 text-fog-400 hover:text-yellow">↓</button>
        </span>
      ),
    }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [config.columns, sf, reorderable, res.rows]);

  const selected = sel.id ? res.rows?.find((r) => r.id === sel.id) ?? null : null;
  const tabs = ([["all", "All"], ["draft", "Draft"], ...(config.schedulable ? [["scheduled", "Scheduled"]] : []), ["published", "Published"], ["archived", "Archived"]] as [Tab, string][]).map(([value, label]) => ({ value, label, count: res.rows ? counts[value] : null }));

  return (
    <div>
      {config.intro && <p className="mb-4 max-w-3xl text-sm leading-relaxed text-fog-400">{config.intro}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${config.plural.toLowerCase()}`} placeholder={`Search ${config.plural.toLowerCase()}…`} className={clsx(inputCls, "min-w-0 flex-1 sm:max-w-sm")} />
        {canWrite && <Button size="sm" className="ml-auto min-h-11" onClick={sel.openNew}>New {config.singular.toLowerCase()}</Button>}
      </div>
      {sf && <Tabs label={`${config.plural} by status`} tabs={tabs} value={tab} onChange={setTab} />}
      <ErrorNote message={res.error} onRetry={() => void res.reload()} />
      <Panel flush>
        <DataTable caption={config.plural} rows={res.error ? [] : shown} loading={res.loading} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => !r.id.startsWith("tmp-") && sel.open(r.id)}
          empty={res.rows?.length ? "Nothing matches that filter." : `No ${config.plural.toLowerCase()} yet.${canWrite ? ` Create the first one with “New ${config.singular.toLowerCase()}”.` : ""}`} />
      </Panel>
      {config.sortField && canWrite && !reorderable && <p className="mt-2 text-xs text-fog-500">Clear the search and status filter to reorder.</p>}

      {sel.isNew && canWrite && <ResourceEditor key="new" config={config} row={null} canWrite saving={res.saving} actions={actions} onClose={sel.close} onCreated={sel.close} />}
      {sel.id && selected && <ResourceEditor key={selected.id} config={config} row={selected} canWrite={canWrite} saving={res.saving} actions={actions} onClose={sel.close} onCreated={sel.close} />}
      {sel.id && !selected && res.rows && <Drawer open onClose={sel.close} title="Not found"><p className="text-sm text-fog-400">That {config.singular.toLowerCase()} no longer exists, or your role cannot see it.</p></Drawer>}
    </div>
  );
}

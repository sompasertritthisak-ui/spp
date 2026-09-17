"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { AuditLogRow } from "@/lib/backend/db-types";
import { formatDateTime, titleCase } from "@/lib/format";
import { inputCls } from "../resource/fields";
import { DataTable, Drawer, ErrorNote, Meta, Panel, StatusPill } from "../ui";

const PAGE = 50;
const ENTITIES = ["settings", "feature_flags", "profiles", "companies", "categories", "products", "pricing_rules", "bundles", "billboards", "billboard_availability", "billboard_bookings", "campaigns", "campaign_qr_codes", "pages", "page_sections", "portfolio_projects", "blog_posts", "faqs", "testimonials", "team_members", "services", "solutions", "design_templates", "media", "leads", "quotes", "orders", "consultations", "projects", "designs", "production_jobs", "deliveries"];
type Person = { id: string; full_name: string; email: string };
type Filters = { entity: string; action: string; actor: string; from: string; to: string; entityId: string };
const BLANK: Filters = { entity: "", action: "", actor: "", from: "", to: "", entityId: "" };

export function AuditTab() {
  const [f, setF] = useState<Filters>(BLANK);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<AuditLogRow | null>(null);
  const people = useQuery<Person[]>(() => backend()!.from("profiles").select("id,full_name,email").neq("role", "customer").order("full_name"), []);
  const names = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p.full_name || p.email])), [people.data]);
  const key = JSON.stringify(f);
  const log = useQuery<{ rows: AuditLogRow[]; count: number }>(async () => {
    let q = backend()!.from("audit_log").select("*", { count: "exact" }).order("at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (f.entity) q = q.eq("entity", f.entity);
    if (f.action) q = q.eq("action", f.action);
    if (f.actor === "none") q = q.is("actor", null); else if (f.actor) q = q.eq("actor", f.actor);
    if (f.from) q = q.gte("at", new Date(`${f.from}T00:00:00`).toISOString());
    if (f.to) q = q.lte("at", new Date(`${f.to}T23:59:59.999`).toISOString());
    if (f.entityId.trim()) q = q.eq("entity_id", f.entityId.trim());
    const r = await q;
    return { data: r.error ? null : { rows: (r.data ?? []) as AuditLogRow[], count: r.count ?? 0 }, error: r.error };
  }, [key, page]);
  const set = (patch: Partial<Filters>) => { setF((p) => ({ ...p, ...patch })); setPage(0); };
  const who = (r: AuditLogRow) => (r.actor ? names.get(r.actor) ?? "Customer / unknown account" : "System or anonymous visitor");
  const pages = Math.max(1, Math.ceil((log.data?.count ?? 0) / PAGE));
  const sel = clsx(inputCls, "w-auto pr-8");

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-fog-400">Every change to business data is recorded by the database itself — who, when, and the values before and after. The log is read-only and visible to administrators only.</p>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <select aria-label="Entity" value={f.entity} onChange={(e) => set({ entity: e.target.value })} className={sel}><option value="">All records</option>{ENTITIES.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}</select>
        <select aria-label="Action" value={f.action} onChange={(e) => set({ action: e.target.value })} className={sel}><option value="">All actions</option><option value="insert">Created</option><option value="update">Changed</option><option value="delete">Deleted</option></select>
        <select aria-label="Actor" value={f.actor} onChange={(e) => set({ actor: e.target.value })} className={sel}><option value="">Anyone</option><option value="none">System / anonymous</option>{people.data?.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select>
        <label className="flex flex-col gap-1"><span className="t-label text-[0.625rem] text-fog-500">From</span><input type="date" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} className={clsx(sel, "t-data [color-scheme:dark]")} /></label>
        <label className="flex flex-col gap-1"><span className="t-label text-[0.625rem] text-fog-500">To</span><input type="date" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} className={clsx(sel, "t-data [color-scheme:dark]")} /></label>
        <input aria-label="Record id" value={f.entityId} onChange={(e) => set({ entityId: e.target.value })} placeholder="Record id / key…" className={clsx(inputCls, "t-data w-56 max-w-full")} />
        {key !== JSON.stringify(BLANK) && <button type="button" onClick={() => set(BLANK)} className="t-label min-h-11 px-2 text-fog-400 hover:text-fog-50">Clear</button>}
      </div>
      <ErrorNote message={log.error} onRetry={() => void log.reload()} />
      <Panel flush>
        <DataTable caption="Audit log" rows={log.error ? [] : log.data?.rows ?? null} loading={log.loading} rowKey={(r) => String(r.id)} onRowClick={setOpen} empty="No entries match those filters."
          columns={[
            { key: "at", header: "When", cell: (r) => <span className="t-data whitespace-nowrap text-fog-300">{formatDateTime(r.at)}</span> },
            { key: "action", header: "Action", cell: (r) => <StatusPill status={r.action === "insert" ? "created" : r.action === "delete" ? "deleted" : r.action === "update" ? "changed" : r.action} className={r.action === "delete" ? "border-danger/40 text-danger" : r.action === "insert" ? "border-ok/40 text-ok" : undefined} /> },
            { key: "entity", header: "Record", cell: (r) => <span><span className="block text-fog-50">{titleCase(r.entity)}</span><span className="t-data block max-w-[14rem] truncate text-xs text-fog-500">{r.entity_id ?? "—"}</span></span> },
            { key: "who", header: "By", hideBelow: "sm", cell: (r) => <span className="text-fog-300">{who(r)}{r.actor_role && <span className="t-label ml-2 text-[0.625rem] text-fog-500">{r.actor_role.replace("_", " ")}</span>}</span> },
            { key: "fields", header: "Fields", hideBelow: "lg", cell: (r) => <span className="text-xs text-fog-500">{changedKeys(r).slice(0, 4).join(", ") || "—"}{changedKeys(r).length > 4 && " …"}</span> },
          ]} />
        <div className="flex items-center justify-between gap-3 border-t border-ink-700 px-4 py-2.5 text-sm text-fog-400">
          <span className="t-data">{log.data ? `${log.data.count.toLocaleString("en-US")} entries · page ${page + 1} of ${pages}` : "…"}</span>
          <span className="flex gap-2"><button type="button" disabled={page === 0 || log.loading} onClick={() => setPage((p) => p - 1)} className="t-label min-h-10 border border-ink-600 px-3 hover:text-fog-50 disabled:opacity-30">Newer</button><button type="button" disabled={page + 1 >= pages || log.loading} onClick={() => setPage((p) => p + 1)} className="t-label min-h-10 border border-ink-600 px-3 hover:text-fog-50 disabled:opacity-30">Older</button></span>
        </div>
      </Panel>
      {open && <AuditDetail row={open} who={who(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const NOISE = new Set(["updated_at"]);
function changedKeys(r: AuditLogRow): string[] {
  const b = obj(r.before), a = obj(r.after);
  if (r.action !== "update") return Object.keys(r.action === "delete" ? b : a);
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !NOISE.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k]));
}
const show = (v: unknown) => (v === undefined ? "(not set)" : v === null ? "null" : typeof v === "string" ? v || "(empty)" : JSON.stringify(v, null, 2));

function AuditDetail({ row, who, onClose }: { row: AuditLogRow; who: string; onClose: () => void }) {
  const [all, setAll] = useState(false);
  const b = obj(row.before), a = obj(row.after);
  const changed = changedKeys(row);
  const keys = row.action === "update" && all ? [...new Set([...Object.keys(b), ...Object.keys(a)])] : changed;
  const pre = "t-data mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words border px-2 py-1.5 text-xs";
  return (
    <Drawer open onClose={onClose} title={`${titleCase(row.entity)} ${row.action === "insert" ? "created" : row.action === "delete" ? "deleted" : "changed"}`} sub={formatDateTime(row.at)}>
      <Meta items={[{ label: "By", value: who }, { label: "Role", value: row.actor_role?.replace("_", " ") ?? "—" }, { label: "Record", value: <span className="t-data text-xs">{row.entity_id ?? "—"}</span> }, { label: "IP", value: row.ip ? <span className="t-data">{String(row.ip)}</span> : "—" }]} />
      <div className="mb-3 mt-6 flex items-center justify-between gap-3">
        <h3 className="t-label text-fog-300">{row.action === "update" ? `${changed.length} field${changed.length === 1 ? "" : "s"} changed` : row.action === "insert" ? "Values at creation" : "Values at deletion"}</h3>
        {row.action === "update" && <button type="button" aria-pressed={all} onClick={() => setAll((v) => !v)} className="t-label min-h-10 text-fog-400 hover:text-fog-50">{all ? "Only changes" : "Show all fields"}</button>}
      </div>
      {keys.length === 0 && <p className="text-sm text-fog-500">Nothing but the timestamp changed.</p>}
      <dl className="divide-y divide-ink-800 border-y border-ink-800">
        {keys.map((k) => {
          const diff = row.action === "update" && changed.includes(k);
          return (
            <div key={k} className="py-3">
              <dt className="t-label text-fog-400">{k}</dt>
              <dd>
                {row.action === "update" && diff ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><span className="t-label text-[0.625rem] text-danger">Before</span><pre className={clsx(pre, "border-danger/30 text-fog-400 line-through decoration-danger/50")}>{show(b[k])}</pre></div>
                    <div><span className="t-label text-[0.625rem] text-ok">After</span><pre className={clsx(pre, "border-ok/30 text-fog-50")}>{show(a[k])}</pre></div>
                  </div>
                ) : <pre className={clsx(pre, "border-ink-700 text-fog-300")}>{show(row.action === "delete" ? b[k] : a[k] ?? b[k])}</pre>}
              </dd>
            </div>
          );
        })}
      </dl>
    </Drawer>
  );
}

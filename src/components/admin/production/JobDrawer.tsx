"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { ProductionStatus } from "@/lib/backend/db-types";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/format";
import { daysUntil, db, write, type StaffMember } from "../ops/data";
import { DesignSides } from "../ops/DesignArt";
import { InternalNotes } from "../ops/Notes";
import { DueTag, Labeled, SectionTitle, SkeletonRows } from "../ops/parts";
import { adminInput, Drawer, ErrorNote, Meta, StatusPill } from "../ui";
import { QcPanel } from "./QcPanel";
import { JOB_COLUMNS, loadOrderCtx, type Job, type OrderCtx } from "./shared";

type Bundle = { job: Job; order: OrderCtx | null; config: Record<string, unknown> };
const show = (v: unknown): string => (Array.isArray(v) ? v.map(show).join(" + ") : v && typeof v === "object" ? Object.entries(v as Record<string, unknown>).filter(([, n]) => n !== 0 && n !== "" && n != null).map(([k, n]) => `${k}×${String(n)}`).join("  ") : String(v));

function JobForm({ job, staff, onSaved }: { job: Job; staff: StaffMember[]; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ assigned_to: job.assigned_to ?? "", deadline: job.deadline ?? "", print_method: job.print_method, materials: job.materials, notes: job.notes });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const r = await write(db().from("production_jobs").update({ assigned_to: f.assigned_to || null, deadline: f.deadline || null, print_method: f.print_method.trim(), materials: f.materials.trim(), notes: f.notes.trim() }).eq("id", job.id).select("id"));
    setBusy(false);
    if (r.error) return setErr(r.error);
    toast("Job saved.", "ok"); onSaved();
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorNote message={err} /></div>
      <Labeled label="Assigned to">{(id) => <select id={id} value={f.assigned_to} onChange={(e) => setF((s) => ({ ...s, assigned_to: e.target.value }))} className={adminInput}><option value="">Unassigned</option>{staff.filter((s) => ["production", "designer", "admin", "super_admin"].includes(s.role)).map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email} · {titleCase(s.role)}</option>)}</select>}</Labeled>
      <Labeled label="Deadline">{(id) => <input id={id} type="date" value={f.deadline} onChange={(e) => setF((s) => ({ ...s, deadline: e.target.value }))} className={adminInput} />}</Labeled>
      <Labeled label="Print method">{(id) => <input id={id} value={f.print_method} onChange={(e) => setF((s) => ({ ...s, print_method: e.target.value }))} className={adminInput} />}</Labeled>
      <Labeled label="Materials">{(id) => <input id={id} value={f.materials} onChange={(e) => setF((s) => ({ ...s, materials: e.target.value }))} className={adminInput} />}</Labeled>
      <Labeled label="Production notes" className="sm:col-span-2">{(id) => <textarea id={id} rows={3} value={f.notes} onChange={(e) => setF((s) => ({ ...s, notes: e.target.value }))} placeholder="Machine, ink, screens, anything the next shift needs…" className={`${adminInput} resize-y py-2`} />}</Labeled>
      <div className="flex justify-end sm:col-span-2"><Button type="submit" size="sm" variant="outline" loading={busy}>Save job</Button></div>
    </form>
  );
}

export function JobDrawer({ id, staff, staffName, viaView, canQc, now, version, onMove, onClose, onChanged }: { id: string | null; staff: StaffMember[]; staffName: (id: string | null) => string; viaView: boolean; canQc: boolean; now: number; version: number; onMove: (job: Job, to: ProductionStatus) => void; onClose: () => void; onChanged: () => void }) {
  const q = useQuery<Bundle | null>(async () => {
    const j = await db().from("production_jobs").select("*").eq("id", id ?? "").maybeSingle();
    if (!j.data) return null;
    const job = j.data as Job;
    const [orders, item] = await Promise.all([
      loadOrderCtx([job.order_id], viaView),
      job.order_item_id ? db().from(viaView ? "production_order_items" : "order_items").select("config").eq("id", job.order_item_id).maybeSingle() : null,
    ]);
    const cfg = item?.data?.config;
    return { job, order: orders[job.order_id] ?? null, config: cfg && typeof cfg === "object" && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : {} };
  }, [id, viaView, version], { enabled: Boolean(id) });
  const b = q.data, j = b?.job;
  const reload = () => { void q.reload(); onChanged(); };
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={j ? `${j.product_name} × ${formatNumber(j.qty)}` : "Production job"} sub={j && <span className="flex flex-wrap items-center gap-2"><span className="t-data">{j.ref}</span><StatusPill status={j.status} /><DueTag days={daysUntil(j.deadline, now)} done={j.status === "done"} /></span>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !b && <SkeletonRows n={6} />}
      {!q.loading && !q.error && !b && <p className="text-sm text-fog-400">This job could not be found, or your role cannot view it.</p>}
      {b && j && (
        <>
          {j.status === "blocked" && <p role="status" className="mb-4 border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fog-50"><span className="t-label mr-2 text-[0.625rem] text-danger">▲ Blocked</span>{j.blocked_reason || "No reason recorded."}</p>}
          <div className="flex flex-wrap items-center gap-2 border border-ink-700 bg-ink-950 p-3">
            <label htmlFor="job-status" className="t-label text-[0.625rem] text-fog-500">Status</label>
            <select id="job-status" value={j.status} onChange={(e) => onMove(j, e.target.value as ProductionStatus)} className={`${adminInput} w-auto`}>{JOB_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
            {j.status === "queued" && <Button size="sm" onClick={() => onMove(j, "in_progress")}>Start job</Button>}
            {j.status === "in_progress" && <Button size="sm" onClick={() => onMove(j, "qc")}>Send to QC</Button>}
            {j.status === "blocked" && <Button size="sm" onClick={() => onMove(j, "in_progress")}>Unblock &amp; resume</Button>}
          </div>

          <SectionTitle>Order context <span className="text-fog-500">· no pricing is shown here</span></SectionTitle>
          <Meta items={[
            { label: "Order", value: b.order ? <span className="flex flex-wrap items-center gap-2"><span className="t-data">{b.order.ref}</span><StatusPill status={b.order.status} /></span> : "—" },
            { label: "Customer", value: b.order ? <>{b.order.contact_name ?? "—"}{b.order.contact_company ? ` · ${b.order.contact_company}` : ""}</> : "—" },
            { label: "Order due", value: b.order?.due_on ? formatDate(b.order.due_on) : "—" },
            { label: "Hand-over", value: b.order ? `${titleCase(b.order.delivery_method)}${b.order.delivery_address ? ` — ${b.order.delivery_address}` : ""}` : "—" },
            ...Object.entries(b.config).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length)).map(([k, v]) => ({ label: titleCase(k), value: show(v) })),
            { label: "Started", value: formatDateTime(j.started_at) }, { label: "Finished", value: formatDateTime(j.finished_at) },
          ]} />

          <SectionTitle>Final artwork{j.final_artwork_version ? ` · v${j.final_artwork_version}` : ""}</SectionTitle>
          {j.design_id ? <DesignSides designId={j.design_id} version={j.final_artwork_version} /> : <p className="text-sm text-fog-500">No Studio design on this line — check the production notes and the order&apos;s files.</p>}

          <SectionTitle>Job details</SectionTitle>
          <JobForm key={`${j.id}-${j.updated_at}`} job={j} staff={staff} onSaved={reload} />
          <div className="mt-8"><QcPanel jobId={j.id} canRecord={canQc} staffName={staffName} onRecorded={reload} /></div>
          <div className="mt-8"><InternalNotes entity="job" entityId={j.id} /></div>
        </>
      )}
    </Drawer>
  );
}

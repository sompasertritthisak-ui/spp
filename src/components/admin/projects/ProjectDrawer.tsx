"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { ProjectStage } from "@/lib/backend/db-types";
import { formatDate, titleCase } from "@/lib/format";
import { db, write, type StaffMember } from "../ops/data";
import { InternalNotes } from "../ops/Notes";
import { Labeled, SectionTitle, SkeletonRows, Stepper } from "../ops/parts";
import { CustomerThread } from "../ops/Thread";
import { adminInput, Drawer, ErrorNote, StatusPill } from "../ui";
import { ProjectFiles } from "./Files";
import { Plan } from "./Plan";
import { Requirements, STAGES, type Project } from "./shared";

function Overview({ p, staff, canSales, onSaved }: { p: Project; staff: StaffMember[]; canSales: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: p.name, objective: p.objective, scope: p.scope, due_on: p.due_on ?? "", owner_staff: p.owner_staff ?? "", blocked_reason: p.blocked_reason ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (f.name.trim().length < 2) return setErr("The project needs a name.");
    setBusy(true); setErr(null);
    const r = await write(db().from("projects").update({ name: f.name.trim(), objective: f.objective.trim(), scope: f.scope.trim(), due_on: f.due_on || null, owner_staff: f.owner_staff || null, blocked_reason: f.blocked_reason.trim() || null }).eq("id", p.id).select("id"));
    setBusy(false);
    if (r.error) return setErr(r.error);
    toast("Project saved.", "ok"); onSaved();
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorNote message={err} /></div>
      <Labeled label="Project name" className="sm:col-span-2">{(id) => <input id={id} value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} maxLength={160} className={adminInput} />}</Labeled>
      <Labeled label="Objective" className="sm:col-span-2">{(id) => <textarea id={id} rows={2} value={f.objective} onChange={(e) => setF((s) => ({ ...s, objective: e.target.value }))} className={`${adminInput} resize-y py-2`} />}</Labeled>
      <Labeled label="Scope" className="sm:col-span-2">{(id) => <textarea id={id} rows={4} value={f.scope} onChange={(e) => setF((s) => ({ ...s, scope: e.target.value }))} placeholder="What SPP will deliver, and what is out of scope." className={`${adminInput} resize-y py-2`} />}</Labeled>
      <Labeled label="Due">{(id) => <input id={id} type="date" value={f.due_on} onChange={(e) => setF((s) => ({ ...s, due_on: e.target.value }))} className={adminInput} />}</Labeled>
      <Labeled label="Project owner">{(id) => <select id={id} value={f.owner_staff} onChange={(e) => setF((s) => ({ ...s, owner_staff: e.target.value }))} className={adminInput}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email} · {titleCase(s.role)}</option>)}</select>}</Labeled>
      <Labeled label="Blocked reason" hint="Leave empty when the project is moving. Anything here flags the project as BLOCKED." className="sm:col-span-2">{(id) => <input id={id} value={f.blocked_reason} onChange={(e) => setF((s) => ({ ...s, blocked_reason: e.target.value }))} maxLength={300} className={adminInput} />}</Labeled>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">{canSales && <Button size="sm" variant="outline" href={`/admin/quotes/?new=1${p.lead_id ? `&lead=${p.lead_id}` : ""}`}>Create quote</Button>}<Button type="submit" size="sm" loading={busy}>Save project</Button></div>
    </form>
  );
}

type Linked = { label: string; ref: string; status: string; href: string };
function Links({ p, canSales }: { p: Project; canSales: boolean }) {
  const q = useQuery<Linked[]>(async () => {
    const b = db();
    const [lead, consult, quotes, orders] = await Promise.all([
      canSales && p.lead_id ? b.from("leads").select("id,ref,status").eq("id", p.lead_id).maybeSingle() : null,
      canSales && p.consultation_id ? b.from("consultations").select("id,ref,status").eq("id", p.consultation_id).maybeSingle() : null,
      canSales ? b.from("quotes").select("id,ref,status").eq("project_id", p.id) : null, canSales ? b.from("orders").select("id,ref,status").eq("project_id", p.id) : null,
    ]);
    const one = (r: { id: string; ref: string; status: string } | null | undefined, label: string, path: string): Linked[] => (r ? [{ label, ref: r.ref, status: r.status, href: `/admin/${path}/?id=${r.id}` }] : []);
    return [...one(lead?.data, "Lead", "leads"), ...one(consult?.data, "Consultation", "consultations"), ...((quotes?.data ?? []) as { id: string; ref: string; status: string }[]).flatMap((r) => one(r, "Quote", "quotes")), ...((orders?.data ?? []) as { id: string; ref: string; status: string }[]).flatMap((r) => one(r, "Order", "orders"))];
  }, [p.id, canSales]);
  return (
    <section aria-label="Linked records">
      <SectionTitle>Linked records</SectionTitle>
      {!canSales && <p className="text-sm text-fog-500">Commercial records (lead, quotes, orders) are visible to the sales team only.</p>}
      {canSales && q.loading && !q.data && <div className="skeleton h-10" />}
      {canSales && q.data?.length === 0 && <p className="text-sm text-fog-500">Nothing linked yet.</p>}
      <ul>{q.data?.map((l) => <li key={l.href} className="border-b border-ink-800 last:border-0"><Link href={l.href} className="flex min-h-11 flex-wrap items-center gap-3 py-2 text-sm hover:bg-ink-850"><span className="t-label w-28 text-[0.625rem] text-fog-500">{l.label}</span><span className="t-data text-fog-50">{l.ref}</span><StatusPill status={l.status} /></Link></li>)}</ul>
    </section>
  );
}

export function ProjectDrawer({ id, staff, canSales, now, onClose, onChanged }: { id: string | null; staff: StaffMember[]; canSales: boolean; now: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const q = useQuery<Project | null>(() => db().from("projects").select("*").eq("id", id ?? "").maybeSingle(), [id], { enabled: Boolean(id) });
  const [optimistic, setOptimistic] = useState<{ id: string; stage: ProjectStage } | null>(null);
  const p = q.data;
  const stage = p && optimistic?.id === p.id ? optimistic.stage : p?.stage;
  const setStage = async (to: ProjectStage) => {
    if (!p) return;
    setOptimistic({ id: p.id, stage: to });
    const r = await write(db().from("projects").update({ stage: to }).eq("id", p.id).select("id"));
    if (r.error) { setOptimistic(null); return toast(r.error, "danger"); }
    toast(`Stage → ${titleCase(to)}`, "ok");
    await q.reload(); setOptimistic(null); onChanged();
  };
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={p?.name ?? "Project"} sub={p && <span className="flex flex-wrap items-center gap-2"><span className="t-data">{p.ref}</span><StatusPill status={stage} />{p.blocked_reason && <StatusPill status="blocked" />}{p.due_on && <span>due {formatDate(p.due_on)}</span>}</span>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !p && <SkeletonRows n={6} />}
      {!q.loading && !q.error && !p && <p className="text-sm text-fog-400">This project could not be found, or your role cannot view it.</p>}
      {p && stage && (
        <>
          {p.blocked_reason && <p role="status" className="mb-4 border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fog-50"><span className="t-label mr-2 text-[0.625rem] text-danger">▲ Blocked</span>{p.blocked_reason}</p>}
          <Stepper label="Project stage" steps={STAGES} current={stage} onPick={(s) => void setStage(s)} />
          <SectionTitle>Overview</SectionTitle>
          <Overview key={`${p.id}-${p.updated_at}`} p={p} staff={staff} canSales={canSales} onSaved={() => { void q.reload(); onChanged(); }} />
          <SectionTitle>Requirements <span className="text-fog-500">· from the project brief</span></SectionTitle>
          <Requirements value={p.requirements} />
          <div className="mt-8"><Plan projectId={p.id} staff={staff} now={now} /></div>
          <div className="mt-8"><ProjectFiles projectId={p.id} /></div>
          <div className="mt-8"><CustomerThread entity="project" entityId={p.id} customerId={p.customer_id} /></div>
          <div className="mt-8"><InternalNotes entity="project" entityId={p.id} /></div>
          <div className="mt-8"><Links p={p} canSales={canSales} /></div>
        </>
      )}
    </Drawer>
  );
}

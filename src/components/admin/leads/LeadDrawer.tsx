"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { LeadsRow } from "@/lib/backend/db-types";
import { formatDateTime, titleCase } from "@/lib/format";
import { db, num, write, type StaffMember } from "../ops/data";
import { InternalNotes } from "../ops/Notes";
import { Labeled, PickField, SectionTitle, SkeletonRows } from "../ops/parts";
import { adminInput, Drawer, ErrorNote, Meta, StatusPill } from "../ui";
import { LEAD_SOURCES, LEAD_STATUSES, leadWhatsApp, PRIORITIES, type Lead } from "./constants";
import { LeadLinks } from "./LeadLinks";
import { LeadTimeline } from "./LeadTimeline";

function LeadForm({ lead, staff, canEdit, onSaved }: { lead: Lead; staff: StaffMember[]; canEdit: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ status: lead.status, priority: lead.priority, assigned_to: lead.assigned_to ?? "", follow_up_on: lead.follow_up_on ?? "", value: lead.estimated_value_lak != null ? String(lead.estimated_value_lak) : "", lost_reason: lead.lost_reason ?? "", interest: lead.product_interest.join(", "), source: lead.source, source_detail: lead.source_detail });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (f.status === "lost" && f.lost_reason.trim().length < 3) return setErr("A lost reason is required before closing this lead as lost.");
    if (f.value.trim() && num(f.value) == null) return setErr("Estimated value must be a number in LAK.");
    setErr(null); setBusy(true);
    const patch: Partial<LeadsRow> = {
      status: f.status, priority: f.priority, assigned_to: f.assigned_to || null, follow_up_on: f.follow_up_on || null, estimated_value_lak: num(f.value),
      lost_reason: f.status === "lost" ? f.lost_reason.trim() : null, product_interest: f.interest.split(",").map((s) => s.trim()).filter(Boolean), source: f.source, source_detail: f.source_detail.trim(),
    };
    const r = await write(db().from("leads").update(patch).eq("id", lead.id).select("id"));
    setBusy(false);
    if (r.error) return setErr(r.error);
    toast("Lead updated.", "ok");
    onSaved();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <ErrorNote message={err} />
      <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PickField label="Status" value={f.status} options={LEAD_STATUSES} onChange={(v) => set("status", v)} />
        <PickField label="Priority" value={f.priority} options={PRIORITIES} onChange={(v) => set("priority", v)} />
        <Labeled label="Assigned to">{(id) => <select id={id} value={f.assigned_to} onChange={(e) => set("assigned_to", e.target.value)} className={adminInput}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email} · {titleCase(s.role)}</option>)}</select>}</Labeled>
        <Labeled label="Follow up on">{(id) => <input id={id} type="date" value={f.follow_up_on} onChange={(e) => set("follow_up_on", e.target.value)} className={adminInput} />}</Labeled>
        <Labeled label="Estimated value (LAK)">{(id) => <input id={id} inputMode="numeric" value={f.value} onChange={(e) => set("value", e.target.value)} placeholder="e.g. 25000000" className={`${adminInput} t-data`} />}</Labeled>
        <PickField label="Source" value={f.source} options={LEAD_SOURCES} onChange={(v) => set("source", v)} />
        <Labeled label="Source detail" hint="Campaign, QR code or page">{(id) => <input id={id} value={f.source_detail} onChange={(e) => set("source_detail", e.target.value)} maxLength={200} className={adminInput} />}</Labeled>
        <Labeled label="Product interest" hint="Comma-separated">{(id) => <input id={id} value={f.interest} onChange={(e) => set("interest", e.target.value)} className={adminInput} />}</Labeled>
        {f.status === "lost" && <Labeled label="Lost reason (required)" className="sm:col-span-2">{(id) => <input id={id} value={f.lost_reason} onChange={(e) => set("lost_reason", e.target.value)} maxLength={300} className={adminInput} />}</Labeled>}
      </fieldset>
      {canEdit ? <div className="mt-3 flex justify-end"><Button type="submit" size="sm" loading={busy}>Save changes</Button></div> : <p className="mt-3 text-xs text-fog-500">Read-only: your role can view leads but not edit them.</p>}
    </form>
  );
}

export function LeadDrawer({ id, staff, staffName, canEdit, onClose, onChanged }: { id: string | null; staff: StaffMember[]; staffName: (id: string | null) => string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const q = useQuery<Lead | null>(() => db().from("leads").select("*").eq("id", id ?? "").maybeSingle(), [id], { enabled: Boolean(id) });
  const l = q.data;
  const wa = l ? leadWhatsApp(l) : null;
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={l?.name ?? "Lead"} sub={l && <span className="flex flex-wrap items-center gap-2"><span className="t-data">{l.ref}</span><StatusPill status={l.status} /><StatusPill status={l.priority} />{l.company_name && <span>{l.company_name}</span>}</span>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !l && <SkeletonRows n={6} />}
      {!q.loading && !q.error && !l && <p className="text-sm text-fog-400">This lead could not be found, or your role cannot view it.</p>}
      {l && (
        <>
          <div className="flex flex-wrap gap-2">
            {wa && <Button href={wa} variant="outline" size="sm">WhatsApp</Button>}
            {l.phone && <Button href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} variant="outline" size="sm">Call</Button>}
            {l.email && <Button href={`mailto:${l.email}?subject=${encodeURIComponent(`SPP — your enquiry ${l.ref}`)}`} variant="outline" size="sm">Email</Button>}
            {canEdit && <Button href={`/admin/quotes/?new=1&lead=${l.id}`} size="sm">Create quote</Button>}
            {canEdit && <Button href={`/admin/projects/?new=1&lead=${l.id}`} variant="outline" size="sm">Create project</Button>}
          </div>
          <SectionTitle>Contact</SectionTitle>
          <Meta items={[
            { label: "Name", value: l.name }, { label: "Company", value: l.company_name || "—" }, { label: "Department", value: l.department || "—" },
            { label: "Email", value: l.email ?? "—" }, { label: "Phone", value: l.phone || "—" }, { label: "Social", value: l.social_contact || "—" },
            { label: "Account", value: l.customer_id ? "Has a My SPP account" : "No account (guest enquiry)" },
            { label: "Marketing", value: l.marketing_consent ? "Consented to marketing messages" : "No marketing consent — service messages only" },
            { label: "Created", value: formatDateTime(l.created_at) },
          ]} />
          {l.message && <><SectionTitle>Their message</SectionTitle><p className="whitespace-pre-wrap border-l-2 border-ink-600 pl-3 text-sm text-fog-100">{l.message}</p></>}
          <SectionTitle>Qualification</SectionTitle>
          <LeadForm key={`${l.id}-${l.updated_at}`} lead={l} staff={staff} canEdit={canEdit} onSaved={() => { void q.reload(); onChanged(); }} />
          <div className="mt-8"><LeadTimeline leadId={l.id} canEdit={canEdit} staffName={staffName} version={l.updated_at} /></div>
          <div className="mt-8"><InternalNotes entity="lead" entityId={l.id} /></div>
          <div className="mt-8"><LeadLinks leadId={l.id} /></div>
        </>
      )}
    </Drawer>
  );
}

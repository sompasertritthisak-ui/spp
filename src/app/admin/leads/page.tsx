"use client";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Abandoned } from "@/components/admin/leads/Abandoned";
import type { Lead } from "@/components/admin/leads/constants";
import { LeadDrawer } from "@/components/admin/leads/LeadDrawer";
import { LeadsBoard } from "@/components/admin/leads/LeadsBoard";
import { LeadsTable } from "@/components/admin/leads/LeadsTable";
import { LostDialog } from "@/components/admin/leads/LostDialog";
import { NewLeadDialog } from "@/components/admin/leads/NewLeadDialog";
import { db, useNow, useOptimistic, useStaff, useUrlState, write } from "@/components/admin/ops/data";
import { NoAccess } from "@/components/admin/ops/parts";
import { ErrorNote, PageHeader, Tabs } from "@/components/admin/ui";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { LeadStatus } from "@/lib/backend/db-types";
import { titleCase } from "@/lib/format";

type View = "pipeline" | "table" | "abandoned";

function Leads() {
  const { profile, user } = useAuth();
  const url = useUrlState();
  const toast = useToast();
  const now = useNow();
  const { staff, name } = useStaff();
  const canEdit = canDo(profile?.role, "sales");
  const canRead = canEdit || canDo(profile?.role, "analytics");
  const view = (["pipeline", "table", "abandoned"].includes(url.get("view") ?? "") ? url.get("view") : "pipeline") as View;

  const q = useQuery<Lead[]>(() => db().from("leads").select("*").order("created_at", { ascending: false }).limit(1000), [], { enabled: canRead });
  const { rows, patch, clear } = useOptimistic(q.data);
  const [losing, setLosing] = useState<Lead | null>(null);
  const [pending, setPending] = useState(false);

  const commit = async (lead: Lead, to: LeadStatus, lost_reason: string | null) => {
    patch(lead.id, { status: to, lost_reason });                       // optimistic
    const r = await write(db().from("leads").update({ status: to, lost_reason }).eq("id", lead.id).select("id"));
    if (r.error) { clear(lead.id); toast(`${lead.name} was not moved. ${r.error}`, "danger"); return false; }   // rollback
    toast(`${lead.name} → ${titleCase(to)}`, "ok");
    await q.reload(); clear(lead.id);
    return true;
  };
  const move = (lead: Lead, to: LeadStatus) => { if (to === lead.status) return; if (to === "lost") setLosing(lead); else void commit(lead, to, null); };

  if (!canRead) return <><PageHeader title="Leads" /><NoAccess what="the sales pipeline" /></>;
  const filters = { status: url.get("status") ?? "", source: url.get("source") ?? "", priority: url.get("priority") ?? "", assigned: url.get("assigned") ?? "", due: url.get("due") ?? "", sort: url.get("sort") ?? "newest" };

  return (
    <>
      <PageHeader title="Leads" sub="Every enquiry, from first contact to won. Drag a card, or use “Move to”, to advance it." actions={canEdit && <Button size="sm" onClick={() => url.set({ new: "1" })}>New lead</Button>} />
      <Tabs label="Lead views" value={view} onChange={(v) => url.set({ view: v === "pipeline" ? null : v })} tabs={[{ value: "pipeline", label: "Pipeline", count: rows?.filter((l) => l.status !== "won" && l.status !== "lost").length ?? null }, { value: "table", label: "Table", count: rows?.length ?? null }, { value: "abandoned", label: "Abandoned · high intent" }]} />
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {view === "pipeline" && <LeadsBoard leads={rows} loading={q.loading} canEdit={canEdit} onMove={move} onOpen={(id) => url.set({ id })} staffName={name} now={now} />}
      {view === "table" && <LeadsTable leads={rows} loading={q.loading} filters={filters} setFilter={(p) => url.set(p)} staff={staff} staffName={name} myId={user?.id} onOpen={(id) => url.set({ id })} now={now} />}
      {view === "abandoned" && <Abandoned canEdit={canEdit} />}

      <LeadDrawer id={url.get("id")} staff={staff} staffName={name} canEdit={canEdit} onClose={() => url.set({ id: null })} onChanged={() => void q.reload()} />
      <NewLeadDialog open={canEdit && url.get("new") === "1"} onClose={() => url.set({ new: null })} onCreated={(id) => { url.set({ new: null, id }); void q.reload(); }} />
      <LostDialog key={losing?.id ?? "none"} lead={losing} pending={pending} onClose={() => setLosing(null)} onConfirm={async (reason) => { if (!losing) return; setPending(true); await commit(losing, "lost", reason); setPending(false); setLosing(null); }} />
    </>
  );
}

export default function LeadsPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Leads /></Suspense>;
}

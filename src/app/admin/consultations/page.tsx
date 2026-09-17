"use client";
import { Suspense, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { ConsultationDrawer } from "@/components/admin/consultations/ConsultationDrawer";
import { NewConsultationDialog } from "@/components/admin/consultations/NewConsultationDialog";
import { CHANNELS, effectiveAt, isOpen, type Consultation } from "@/components/admin/consultations/shared";
import { WeekStrip } from "@/components/admin/consultations/WeekStrip";
import { db, useNow, useUrlState } from "@/components/admin/ops/data";
import { NoAccess } from "@/components/admin/ops/parts";
import { vteDateTime } from "@/components/admin/ops/vientiane";
import { DataTable, ErrorNote, PageHeader, StatusPill, Tabs, type Column } from "@/components/admin/ui";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";

const TABS = [{ value: "upcoming", label: "Upcoming" }, { value: "requested", label: "Needs a decision" }, { value: "past", label: "Past & closed" }, { value: "all", label: "All" }] as const;
type Tab = (typeof TABS)[number]["value"];
const inTab = (c: Consultation, t: Tab) => (t === "all" ? true : t === "requested" ? c.status === "requested" : t === "upcoming" ? isOpen(c) : !isOpen(c));

function Consultations() {
  const { profile } = useAuth();
  const url = useUrlState();
  const now = useNow();
  const canEdit = canDo(profile?.role, "sales");
  const tab = (TABS.find((t) => t.value === url.get("status"))?.value ?? "upcoming") as Tab;
  const q = useQuery<Consultation[]>(() => db().from("consultations").select("*").order("preferred_at", { ascending: true }).limit(1000), [], { enabled: canEdit });
  const rows = useMemo(() => {
    const list = q.data?.filter((c) => inTab(c, tab)) ?? null;
    return list && [...list].sort((a, b) => (tab === "past" || tab === "all" ? effectiveAt(b).localeCompare(effectiveAt(a)) : effectiveAt(a).localeCompare(effectiveAt(b))));
  }, [q.data, tab]);

  if (!canEdit) return <><PageHeader title="Consultations" /><NoAccess what="consultation bookings" /></>;
  const columns: Column<Consultation>[] = [
    { key: "when", header: "When (Vientiane)", cell: (c) => <span className="block min-w-40"><span className="t-data block text-fog-50">{vteDateTime(effectiveAt(c))}</span><span className="block text-xs text-fog-500">{c.confirmed_at ? "confirmed" : c.status === "alternative_suggested" ? "suggested by SPP" : "requested"} · {c.duration_mins} min{isOpen(c) && new Date(effectiveAt(c)).getTime() < now ? " · time has passed" : ""}</span></span> },
    { key: "who", header: "With", cell: (c) => <span className="block"><span className="block text-fog-50">{c.name}</span><span className="block text-xs text-fog-400">{c.company_name || c.email}</span></span> },
    { key: "status", header: "Status", cell: (c) => <StatusPill status={c.status} /> },
    { key: "topic", header: "Topic", hideBelow: "md", cell: (c) => <span className="line-clamp-1 text-fog-300">{c.topic}</span> },
    { key: "channel", header: "Channel", hideBelow: "lg", cell: (c) => <span className="text-fog-300">{CHANNELS[c.channel] ?? c.channel}</span> },
    { key: "ref", header: "Ref", hideBelow: "xl", cell: (c) => <span className="t-data text-xs text-fog-400">{c.ref}</span> },
  ];
  return (
    <>
      <PageHeader title="Consultations" sub="Requests are not meetings until you confirm a time. Every time on this screen is Asia/Vientiane (ICT, UTC+7)." actions={<Button size="sm" onClick={() => url.set({ new: "1" })}>New consultation</Button>} />
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.data && <WeekStrip rows={q.data} now={now} onOpen={(id) => url.set({ id })} />}
      <Tabs label="Consultation status" value={tab} onChange={(v) => url.set({ status: v === "upcoming" ? null : v })} tabs={TABS.map((t) => ({ ...t, count: q.data ? q.data.filter((c) => inTab(c, t.value)).length : null }))} />
      <div className="border border-ink-700 bg-ink-900">
        <DataTable caption="Consultations" rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={(c) => url.set({ id: c.id })} loading={q.loading} empty={tab === "requested" ? "No requests waiting for a decision." : "No consultations in this view."} />
      </div>
      <ConsultationDrawer id={url.get("id")} canEdit={canEdit} onClose={() => url.set({ id: null })} onChanged={() => void q.reload()} />
      <NewConsultationDialog open={url.get("new") === "1"} onClose={() => url.set({ new: null })} onCreated={(id) => { url.set({ new: null, id }); void q.reload(); }} />
    </>
  );
}

export default function ConsultationsPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Consultations /></Suspense>;
}

"use client";
import { Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { db, daysUntil, asContact, useNow, useUrlState } from "@/components/admin/ops/data";
import { DueTag, NoAccess, SearchBox } from "@/components/admin/ops/parts";
import { NewQuoteDialog } from "@/components/admin/quotes/NewQuoteDialog";
import { QuoteDrawer } from "@/components/admin/quotes/QuoteDrawer";
import { DataTable, ErrorNote, PageHeader, StatusPill, Tabs, type Column } from "@/components/admin/ui";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { QuotesRow } from "@/lib/backend/db-types";
import { formatLakShort, relativeTime, titleCase } from "@/lib/format";

const TABS = [
  { value: "awaiting", label: "Awaiting SPP", match: ["submitted", "in_review"] }, { value: "draft", label: "Drafts", match: ["draft"] }, { value: "sent", label: "Sent", match: ["sent"] },
  { value: "accepted", label: "Accepted", match: ["accepted"] }, { value: "closed", label: "Declined / expired", match: ["declined", "expired"] }, { value: "all", label: "All", match: null },
] as const;
type Tab = (typeof TABS)[number]["value"];

function Quotes() {
  const { profile } = useAuth();
  const url = useUrlState();
  const now = useNow();
  const canEdit = canDo(profile?.role, "sales");
  const canRead = canEdit || canDo(profile?.role, "designs");
  const [search, setSearch] = useState("");
  const tab = (TABS.find((t) => t.value === url.get("status"))?.value ?? "awaiting") as Tab;
  const q = useQuery<QuotesRow[]>(() => db().from("quotes").select("*").order("created_at", { ascending: false }).limit(1000), [], { enabled: canRead });

  const rows = useMemo(() => {
    const match = TABS.find((t) => t.value === tab)?.match as readonly string[] | null | undefined;
    const term = search.trim().toLowerCase();
    return q.data?.filter((r) => (!match || match.includes(r.status)) && (!term || `${r.ref} ${Object.values(asContact(r.contact)).join(" ")}`.toLowerCase().includes(term))) ?? null;
  }, [q.data, tab, search]);

  if (!canRead) return <><PageHeader title="Quotes" /><NoAccess what="quotations" /></>;
  const columns: Column<QuotesRow>[] = [
    { key: "ref", header: "Quote", cell: (r) => { const c = asContact(r.contact); return <span className="block min-w-44"><span className="t-data block text-fog-50">{r.ref}</span><span className="block text-xs text-fog-400">{c.name}{c.company ? ` · ${c.company}` : ""}</span></span>; } },
    { key: "status", header: "Status", cell: (r) => <span className="flex flex-wrap gap-1"><StatusPill status={r.status} />{r.kind === "reorder" && <StatusPill status="reorder" />}</span> },
    { key: "value", header: "Quoted / estimate", className: "text-right", hideBelow: "sm", cell: (r) => <span className="t-data">{r.total_lak != null ? formatLakShort(Number(r.total_lak)) : r.estimate_low_lak != null ? <span className="text-fog-400">~{formatLakShort(Number(r.estimate_low_lak))}–{formatLakShort(Number(r.estimate_high_lak))}</span> : <span className="text-fog-500">to price</span>}</span> },
    { key: "kind", header: "Kind", hideBelow: "lg", cell: (r) => <span className="text-fog-300">{titleCase(r.kind)}{r.needs_design_help ? " · design help" : ""}</span> },
    { key: "need", header: "Needed by", hideBelow: "md", cell: (r) => <DueTag days={daysUntil(r.needed_by, now)} done={["accepted", "declined", "expired"].includes(r.status)} /> },
    { key: "age", header: "Requested", hideBelow: "md", cell: (r) => <span className="t-data text-xs text-fog-400">{relativeTime(r.created_at)}</span> },
  ];

  return (
    <>
      <PageHeader title="Quotes" sub="Price it, send it, convert it. A sent quote is what the customer sees in My SPP." actions={canEdit && <Button size="sm" onClick={() => url.set({ new: "1" })}>New quote</Button>} />
      <Tabs label="Quote status" value={tab} onChange={(v) => url.set({ status: v === "awaiting" ? null : v })} tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: q.data ? q.data.filter((r) => !t.match || (t.match as readonly string[]).includes(r.status)).length : null }))} />
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <div className="border border-ink-700 bg-ink-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3"><SearchBox value={search} onChange={setSearch} label="Search quotes" placeholder="Ref, name, company, email…" /><p className="t-data ml-auto text-xs text-fog-500" aria-live="polite">{rows ? `${rows.length} shown` : ""}</p></div>
        <DataTable caption="Quotes" rows={rows} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => url.set({ id: r.id })} loading={q.loading} empty={search ? "No quotes match that search." : tab === "awaiting" ? "Nothing waiting on SPP. New quote requests land here." : "No quotes in this view."} />
      </div>
      <QuoteDrawer id={url.get("id")} canEdit={canEdit} onClose={() => url.set({ id: null })} onChanged={() => void q.reload()} />
      {canEdit && url.get("new") === "1" && <NewQuoteDialog open leadId={url.get("lead")} onClose={() => url.set({ new: null, lead: null })} onCreated={(id) => { url.set({ new: null, lead: null, id }); void q.reload(); }} />}
    </>
  );
}

export default function QuotesPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Quotes /></Suspense>;
}

"use client";
import { Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { db, daysUntil, asContact, useNow, useUrlState } from "@/components/admin/ops/data";
import { ExportMenu } from "@/components/admin/ops/ExportMenu";
import { quotesListSheets } from "@/components/admin/ops/exports";
import { DueTag, NoAccess, SearchBox } from "@/components/admin/ops/parts";
import { NewQuoteDialog } from "@/components/admin/quotes/NewQuoteDialog";
import { QuoteDrawer } from "@/components/admin/quotes/QuoteDrawer";
import { adminInput, DataTable, ErrorNote, PageHeader, StatusPill, Tabs, type Column } from "@/components/admin/ui";
import { useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { QuotesRow } from "@/lib/backend/db-types";
import { formatLak, formatLakShort, formatNumber, relativeTime, titleCase } from "@/lib/format";

const TABS = [
  { value: "awaiting", label: "Awaiting SPP", match: ["submitted", "in_review"] }, { value: "draft", label: "Drafts", match: ["draft"] }, { value: "sent", label: "Sent", match: ["sent"] },
  { value: "accepted", label: "Accepted", match: ["accepted"] }, { value: "closed", label: "Declined / expired", match: ["declined", "expired"] }, { value: "all", label: "All", match: null },
] as const;
type Tab = (typeof TABS)[number]["value"];
const KINDS = ["product", "project", "bundle", "campaign", "reorder"] as const;
const PERIODS = [{ value: "", label: "Any time" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }] as const;

function Quotes() {
  const { can, canWrite } = useAuth();
  const url = useUrlState();
  const now = useNow();
  const canEdit = canWrite("sales");
  const canRead = can("sales") || can("designs");
  const [search, setSearch] = useState("");
  const tab = (TABS.find((t) => t.value === url.get("status"))?.value ?? "awaiting") as Tab;
  const kind = url.get("kind") ?? "", period = url.get("days") ?? "";
  const q = useQuery<QuotesRow[]>(() => db().from("quotes").select("*").order("created_at", { ascending: false }).limit(1000), [], { enabled: canRead });

  const rows = useMemo(() => {
    const match = TABS.find((t) => t.value === tab)?.match as readonly string[] | null | undefined;
    const term = search.trim().toLowerCase();
    const since = period ? now - Number(period) * 864e5 : null;
    return q.data?.filter((r) => (!match || match.includes(r.status)) && (!kind || r.kind === kind) && (since == null || new Date(r.created_at).getTime() >= since) && (!term || `${r.ref} ${Object.values(asContact(r.contact)).join(" ")}`.toLowerCase().includes(term))) ?? null;
  }, [q.data, tab, search, kind, period, now]);
  // ERP-style footer: what the visible slice is worth. Quoted totals are prices SPP issued, not invoiced money.
  const totals = useMemo(() => rows ? { quoted: rows.reduce((t, r) => t + Number(r.total_lak ?? 0), 0), priced: rows.filter((r) => r.total_lak != null).length, low: rows.reduce((t, r) => t + Number(r.estimate_low_lak ?? 0), 0), high: rows.reduce((t, r) => t + Number(r.estimate_high_lak ?? 0), 0) } : null, [rows]);

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
      <PageHeader title="Quotes" viewOnly={!canEdit} sub="Price it, send it, convert it. A sent quote is what the customer sees in My SPP." actions={canEdit && <Button size="sm" onClick={() => url.set({ new: "1" })}>New quote</Button>} />
      <Tabs label="Quote status" value={tab} onChange={(v) => url.set({ status: v === "awaiting" ? null : v })} tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: q.data ? q.data.filter((r) => !t.match || (t.match as readonly string[]).includes(r.status)).length : null }))} />
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <div className="border border-ink-700 bg-ink-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3">
          <SearchBox value={search} onChange={setSearch} label="Search quotes" placeholder="Ref, name, company, email…" />
          <select aria-label="Filter by kind" value={kind} onChange={(e) => url.set({ kind: e.target.value || null })} className={`${adminInput} w-auto`}><option value="">All kinds</option>{KINDS.map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}</select>
          <select aria-label="Filter by period" value={period} onChange={(e) => url.set({ days: e.target.value || null })} className={`${adminInput} w-auto`}>{PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          <span className="ml-auto flex flex-wrap items-center gap-3">
            <p className="t-data text-xs text-fog-500" aria-live="polite">{rows ? `${rows.length} shown` : ""}</p>
            <ExportMenu label="Export list" fileName={`spp-quotes-${tab}`} disabled={!rows?.length} build={() => quotesListSheets(rows ?? [])} />
          </span>
        </div>
        <DataTable caption="Quotes" rows={rows} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => url.set({ id: r.id })} loading={q.loading} empty={search ? "No quotes match that search." : tab === "awaiting" ? "Nothing waiting on SPP. New quote requests land here." : "No quotes in this view."} />
        {totals && rows && rows.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-ink-700 px-4 py-3 text-sm sm:grid-cols-4">
            <div><dt className="t-label text-[0.625rem] text-fog-500">Quotes shown</dt><dd className="t-data text-fog-50">{formatNumber(rows.length)}</dd></div>
            <div><dt className="t-label text-[0.625rem] text-fog-500">Quoted total ({formatNumber(totals.priced)} priced)</dt><dd className="t-data text-fog-50">{formatLak(totals.quoted)}</dd></div>
            <div><dt className="t-label text-[0.625rem] text-fog-500">Engine estimate band</dt><dd className="t-data text-fog-300">{totals.high > 0 ? `${formatLakShort(totals.low)} – ${formatLakShort(totals.high)}` : "—"}</dd></div>
            <div><dt className="t-label text-[0.625rem] text-fog-500">Basis</dt><dd className="text-xs text-fog-500">Quoted totals, not invoiced</dd></div>
          </dl>
        )}
      </div>
      <QuoteDrawer id={url.get("id")} canEdit={canEdit} onClose={() => url.set({ id: null })} onChanged={() => void q.reload()} />
      {canEdit && url.get("new") === "1" && <NewQuoteDialog open leadId={url.get("lead")} onClose={() => url.set({ new: null, lead: null })} onCreated={(id) => { url.set({ new: null, lead: null, id }); void q.reload(); }} />}
    </>
  );
}

export default function QuotesPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Quotes /></Suspense>;
}

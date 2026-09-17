"use client";
import { Suspense, useMemo, useState } from "react";
import { db, asContact, daysUntil, useNow, useUrlState } from "@/components/admin/ops/data";
import { DueTag, NoAccess, SearchBox } from "@/components/admin/ops/parts";
import { OrderDrawer } from "@/components/admin/orders/OrderDrawer";
import { isActive, type Order } from "@/components/admin/orders/shared";
import { DataTable, ErrorNote, PageHeader, StatusPill, Tabs, type Column } from "@/components/admin/ui";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate, formatLakShort, relativeTime } from "@/lib/format";

const TABS = [
  { value: "active", label: "Active", match: (o: Order) => isActive(o) }, { value: "pre", label: "Approved · artwork", match: (o: Order) => ["quote", "approved", "artwork_review"].includes(o.status) },
  { value: "making", label: "Production · QC", match: (o: Order) => o.status === "production" || o.status === "quality_control" }, { value: "out", label: "Ready · delivery", match: (o: Order) => o.status === "ready" || o.status === "delivery" },
  { value: "completed", label: "Completed", match: (o: Order) => o.status === "completed" }, { value: "cancelled", label: "Cancelled", match: (o: Order) => o.status === "cancelled" }, { value: "all", label: "All", match: () => true },
] as const;

function Orders() {
  const { profile } = useAuth();
  const url = useUrlState();
  const now = useNow();
  const canEdit = canDo(profile?.role, "sales");
  const [search, setSearch] = useState("");
  const tab = TABS.find((t) => t.value === url.get("status")) ?? TABS[0];
  const urgentOnly = url.get("urgent") === "1";
  const q = useQuery<Order[]>(() => db().from("orders").select("*").order("created_at", { ascending: false }).limit(1000), [], { enabled: canEdit });
  const isUrgent = (o: Order) => isActive(o) && o.due_on != null && (daysUntil(o.due_on, now) ?? 99) <= 3;

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = q.data?.filter((o) => tab.match(o) && (!urgentOnly || (isActive(o) && o.due_on != null && (daysUntil(o.due_on, now) ?? 99) <= 3)) && (!term || `${o.ref} ${Object.values(asContact(o.contact)).join(" ")}`.toLowerCase().includes(term))) ?? null;
    // Active work is ordered by what is due first; history by recency.
    return list && (tab.value === "completed" || tab.value === "cancelled" || tab.value === "all" ? list : [...list].sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999")));
  }, [q.data, tab, urgentOnly, search, now]);

  if (!canEdit) return <><PageHeader title="Orders" /><NoAccess what="orders and their commercial details. Production staff work from Production & QC" /></>;
  const urgentCount = q.data?.filter(isUrgent).length ?? 0;
  const columns: Column<Order>[] = [
    { key: "ref", header: "Order", cell: (o) => { const c = asContact(o.contact); return <span className="flex min-w-44 items-stretch gap-2.5">{isUrgent(o) && <span aria-hidden className="w-0.5 flex-none bg-danger" />}<span><span className="t-data block text-fog-50">{o.ref}{o.reorder_of && <span className="t-label ml-2 text-[0.5625rem] text-sky">Reorder</span>}</span><span className="block text-xs text-fog-400">{c.name}{c.company ? ` · ${c.company}` : ""}</span></span></span>; } },
    { key: "status", header: "Status", cell: (o) => <StatusPill status={o.status} /> },
    { key: "due", header: "Due", cell: (o) => <span className="flex flex-wrap items-center gap-2"><DueTag days={daysUntil(o.due_on, now)} done={!isActive(o)} />{o.due_on && <span className="t-data hidden text-xs text-fog-500 sm:inline">{formatDate(o.due_on, { day: "numeric", month: "short" })}</span>}</span> },
    { key: "pay", header: "Payment", hideBelow: "md", cell: (o) => <StatusPill status={o.payment_status} /> },
    { key: "total", header: "Total", className: "text-right", hideBelow: "sm", cell: (o) => <span className="t-data">{o.total_lak != null ? formatLakShort(Number(o.total_lak)) : "—"}</span> },
    { key: "age", header: "Created", hideBelow: "lg", cell: (o) => <span className="t-data text-xs text-fog-400">{relativeTime(o.created_at)}</span> },
  ];
  return (
    <>
      <PageHeader title="Orders" sub="From accepted quote to delivered goods. Open an order for its full chain: lead → quote → order → jobs → QC → delivery." />
      <Tabs label="Order status" value={tab.value} onChange={(v) => url.set({ status: v === "active" ? null : v })} tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: q.data ? q.data.filter(t.match).length : null }))} />
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <div className="border border-ink-700 bg-ink-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3">
          <SearchBox value={search} onChange={setSearch} label="Search orders" placeholder="Ref, name, company…" />
          <label className={`flex min-h-10 items-center gap-2 border px-3 text-sm ${urgentOnly ? "border-danger/60 text-fog-50" : "border-ink-600 text-fog-300"}`}><input type="checkbox" checked={urgentOnly} onChange={(e) => url.set({ urgent: e.target.checked ? "1" : null })} className="accent-[var(--color-danger)]" />Urgent only <span className="t-data text-xs text-danger">{urgentCount > 0 ? `▲ ${urgentCount}` : ""}</span></label>
          <p className="t-data ml-auto text-xs text-fog-500" aria-live="polite">{rows ? `${rows.length} shown` : ""}</p>
        </div>
        <DataTable caption="Orders" rows={rows} columns={columns} rowKey={(o) => o.id} onRowClick={(o) => url.set({ id: o.id })} loading={q.loading} empty={urgentOnly ? "Nothing urgent. No active order is due within three days." : search ? "No orders match that search." : "No orders in this view. Orders are created by converting an accepted quote."} />
      </div>
      <OrderDrawer id={url.get("id")} canEdit={canEdit} now={now} onClose={() => url.set({ id: null })} onChanged={() => void q.reload()} />
    </>
  );
}

export default function OrdersPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Orders /></Suspense>;
}

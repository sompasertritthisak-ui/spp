"use client";
import { Suspense, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { DesignDrawer } from "@/components/admin/designs/DesignDrawer";
import { ADVISORY } from "@/components/admin/designs/Preflight";
import { db, useStaff, useUrlState } from "@/components/admin/ops/data";
import { DesignMini } from "@/components/admin/ops/DesignArt";
import { NoAccess, SearchBox } from "@/components/admin/ops/parts";
import { ErrorNote, PageHeader, StatusPill, Tabs } from "@/components/admin/ui";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { DesignStatus } from "@/lib/backend/db-types";
import { relativeTime, titleCase } from "@/lib/format";

type Row = { id: string; ref: string; name: string; owner_id: string; product_slug: string; status: DesignStatus; version: number; updated_at: string; owner: string };
const TABS = [{ value: "submitted", label: "Submitted" }, { value: "approved", label: "Approved" }, { value: "all", label: "All" }] as const;
const PAGE = 24;

function Designs() {
  const { profile } = useAuth();
  const url = useUrlState();
  const { name } = useStaff();
  const canReview = canDo(profile?.role, "designs");
  const canRead = canReview || canDo(profile?.role, "production");
  const tab = TABS.find((t) => t.value === url.get("status"))?.value ?? "submitted";
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const q = useQuery<Row[]>(async () => {
    const { data, error } = await db().from("designs").select("id,ref,name,owner_id,product_slug,status,version,updated_at").order("updated_at", { ascending: false }).limit(1000);
    if (error) return { data: null, error };
    const rows = (data ?? []) as Omit<Row, "owner">[];
    const ids = [...new Set(rows.map((r) => r.owner_id))];
    const owners = ids.length ? await db().from("profiles").select("id,full_name,email").in("id", ids) : null;
    const by = new Map(((owners?.data ?? []) as { id: string; full_name: string; email: string }[]).map((p) => [p.id, p.full_name || p.email || "Guest"]));
    return { data: rows.map((r) => ({ ...r, owner: by.get(r.owner_id) ?? "Guest" })), error: null };
  }, [], { enabled: canRead });

  const rows = useMemo(() => { const term = search.trim().toLowerCase(); return q.data?.filter((r) => (tab === "all" || r.status === tab) && (!term || `${r.ref} ${r.name} ${r.owner}`.toLowerCase().includes(term))) ?? null; }, [q.data, tab, search]);
  if (!canRead) return <><PageHeader title="Designs & Artwork" /><NoAccess what="customer artwork" /></>;

  return (
    <>
      <PageHeader title="Designs & Artwork" sub="The artwork review queue. Nothing reaches production until SPP approves it." />
      <Tabs label="Artwork status" value={tab} onChange={(v) => { setLimit(PAGE); url.set({ status: v === "submitted" ? null : v }); }} tabs={TABS.map((t) => ({ ...t, count: q.data ? (t.value === "all" ? q.data.length : q.data.filter((r) => r.status === t.value).length) : null }))} />
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <div className="mb-4 flex flex-wrap items-center gap-3"><SearchBox value={search} onChange={(v) => { setSearch(v); setLimit(PAGE); }} label="Search designs" placeholder="Ref, design name or owner…" /><p className="t-data ml-auto text-xs text-fog-500" aria-live="polite">{rows ? `${rows.length} design${rows.length === 1 ? "" : "s"}` : ""}</p></div>

      {q.loading && !rows && <div aria-busy="true" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-64" />)}</div>}
      {rows?.length === 0 && <EmptyState title={search ? "No designs match." : tab === "submitted" ? "The review queue is clear." : "No designs in this view."} body={search ? "Try the design reference (SPP-DESIGN-…), its name, or the owner's name." : "Designs arrive here when a customer attaches one to a quote request."} />}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {rows?.slice(0, limit).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => url.set({ id: r.id })} className="group block w-full border border-ink-700 bg-ink-900 text-left transition-colors hover:border-yellow focus-visible:border-yellow">
              <DesignMini designId={r.id} className="!h-48 !w-full border-0 border-b !border-ink-700 p-2" />
              <span className="block p-3">
                <span className="flex items-start justify-between gap-2"><span className="min-w-0 truncate text-sm font-medium text-fog-50">{r.name}</span><StatusPill status={r.status} /></span>
                <span className="t-data mt-1 block truncate text-[0.6875rem] text-fog-400">{r.ref} · v{r.version}</span>
                <span className="mt-1 block truncate text-xs text-fog-500">{r.owner} · {titleCase(r.product_slug)} · {relativeTime(r.updated_at)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {rows && rows.length > limit && <div className="mt-4 flex justify-center"><button type="button" onClick={() => setLimit((l) => l + PAGE)} className="t-label min-h-11 border border-ink-500 px-5 text-xs text-fog-50 hover:border-yellow hover:text-yellow">Show {Math.min(PAGE, rows.length - limit)} more</button></div>}
      <p className="mt-6 border-l-2 border-ink-600 pl-3 text-xs italic text-fog-500">{ADVISORY}</p>

      <DesignDrawer id={url.get("id")} canReview={canReview} canSales={canDo(profile?.role, "sales")} staffName={name} onClose={() => url.set({ id: null })} onChanged={() => void q.reload()} />
    </>
  );
}

export default function DesignsPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Designs /></Suspense>;
}

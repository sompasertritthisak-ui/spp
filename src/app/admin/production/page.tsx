"use client";
import { Suspense, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { daysUntil, db, useNow, useOptimistic, useStaff, useUrlState, write } from "@/components/admin/ops/data";
import { NoAccess } from "@/components/admin/ops/parts";
import { Deliveries } from "@/components/admin/production/Deliveries";
import { JobDrawer } from "@/components/admin/production/JobDrawer";
import { JobsBoard } from "@/components/admin/production/JobsBoard";
import { BlockDialog, DoneDialog } from "@/components/admin/production/MoveDialogs";
import { loadOrderCtx, type Job, type OrderCtx } from "@/components/admin/production/shared";
import { adminInput, ErrorNote, PageHeader, Tabs } from "@/components/admin/ui";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { ProductionStatus } from "@/lib/backend/db-types";
import { titleCase } from "@/lib/format";

const FILTERS = [["", "All jobs"], ["mine", "Assigned to me"], ["overdue", "Overdue"], ["urgent", "Due within 3 days"], ["blocked", "Blocked"]] as const;

function Production() {
  const { profile, user } = useAuth();
  const url = useUrlState();
  const toast = useToast();
  const now = useNow();
  const { staff, name } = useStaff();
  const canProduction = canDo(profile?.role, "production");
  const canRead = canProduction || canDo(profile?.role, "sales");
  const tab = url.get("tab") === "deliveries" ? "deliveries" : "board";
  const filter = url.get("filter") ?? "", orderId = url.get("order");

  const flag = useQuery<{ enabled: boolean } | null>(() => db().from("feature_flags").select("enabled").eq("key", "PRODUCTION_WORKFLOW").maybeSingle(), []);
  const q = useQuery<{ jobs: Job[]; orders: Record<string, OrderCtx> }>(async () => {
    const { data, error } = await db().from("production_jobs").select("*").order("deadline", { ascending: true, nullsFirst: false }).limit(1000);
    if (error) return { data: null, error };
    const jobs = (data ?? []) as Job[];
    return { data: { jobs, orders: await loadOrderCtx(jobs.map((j) => j.order_id), canProduction) }, error: null };
  }, [canProduction], { enabled: canRead });
  const { rows, patch, clear } = useOptimistic(q.data?.jobs ?? null);
  const [blocking, setBlocking] = useState<Job | null>(null);
  const [finishing, setFinishing] = useState<Job | null>(null);
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(0);

  const commit = async (job: Job, to: ProductionStatus, reason: string | null) => {
    const p: Partial<Job> = { status: to, blocked_reason: to === "blocked" ? reason : null, ...(to === "in_progress" && !job.started_at ? { started_at: new Date().toISOString() } : {}), ...(to === "done" ? { finished_at: new Date().toISOString() } : job.status === "done" ? { finished_at: null } : {}) };
    patch(job.id, p);                                                   // optimistic
    const r = await write(db().from("production_jobs").update(p).eq("id", job.id).select("id"));
    if (r.error) { clear(job.id); toast(`${job.ref} was not moved. ${r.error}`, "danger"); return; }   // rollback
    toast(`${job.ref} → ${titleCase(to)}`, "ok");
    await q.reload(); clear(job.id); setVersion((v) => v + 1);
  };
  const move = (job: Job, to: ProductionStatus) => { if (to === job.status) return; if (to === "blocked") setBlocking(job); else if (to === "done") setFinishing(job); else void commit(job, to, null); };

  const shown = useMemo(() => rows?.filter((j) => {
    if (orderId && j.order_id !== orderId) return false;
    const d = daysUntil(j.deadline, now);
    return filter === "mine" ? j.assigned_to === user?.id : filter === "overdue" ? j.status !== "done" && d != null && d < 0 : filter === "urgent" ? j.status !== "done" && d != null && d <= 3 : filter === "blocked" ? j.status === "blocked" : true;
  }) ?? null, [rows, filter, orderId, now, user?.id]);

  if (!canRead) return <><PageHeader title="Production & QC" /><NoAccess what="production" /></>;
  if (flag.data && !flag.data.enabled)
    return <><PageHeader title="Production & QC" /><EmptyState title="Production workflow is switched off." body="The PRODUCTION_WORKFLOW feature flag is disabled, so jobs, QC and deliveries are paused in the Command Center. An administrator can switch it on under Settings → Feature flags. No data has been removed." /></>;

  const orderRef = orderId ? q.data?.orders[orderId]?.ref : null;
  return (
    <>
      <PageHeader title="Production & QC" sub="What to make, by when, with which artwork. Pricing never appears on this screen." />
      <Tabs label="Production views" value={tab} onChange={(v) => url.set({ tab: v === "board" ? null : v, id: null, delivery: null })} tabs={[{ value: "board", label: "Job board", count: rows ? rows.filter((j) => j.status !== "done").length : null }, { value: "deliveries", label: "Deliveries" }]} />
      {tab === "board" ? (
        <>
          <ErrorNote message={q.error} onRetry={() => void q.reload()} />
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select aria-label="Filter jobs" value={filter} onChange={(e) => url.set({ filter: e.target.value || null })} className={`${adminInput} w-auto`}>{FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            {orderId && <button type="button" onClick={() => url.set({ order: null })} className="t-label min-h-10 border border-yellow/50 px-3 text-[0.625rem] text-yellow">Order {orderRef ?? "filter"} · clear ✕</button>}
            <p className="t-data ml-auto text-xs text-fog-500" aria-live="polite">{shown ? `${shown.length} job${shown.length === 1 ? "" : "s"}` : ""}</p>
          </div>
          {rows?.length === 0 ? <EmptyState title="No production jobs yet." body="Jobs are created when sales release an order to production — every designed line must have SPP-approved artwork first." /> : <JobsBoard jobs={shown} loading={q.loading} orders={q.data?.orders ?? {}} staffName={name} now={now} onMove={move} onOpen={(id) => url.set({ id })} />}
        </>
      ) : <Deliveries viaView={canProduction} selected={url.get("delivery")} onSelect={(id) => url.set({ delivery: id })} />}

      <JobDrawer id={tab === "board" ? url.get("id") : null} staff={staff} staffName={name} viaView={canProduction} canQc={canProduction} now={now} version={version} onMove={move} onClose={() => url.set({ id: null })} onChanged={() => void q.reload()} />
      <BlockDialog key={blocking?.id ?? "b"} job={blocking} pending={pending} onClose={() => setBlocking(null)} onConfirm={async (reason) => { if (!blocking) return; setPending(true); await commit(blocking, "blocked", reason); setPending(false); setBlocking(null); }} />
      <DoneDialog job={finishing} pending={pending} onClose={() => setFinishing(null)} onConfirm={async () => { if (!finishing) return; setPending(true); await commit(finishing, "done", null); setPending(false); setFinishing(null); }} />
    </>
  );
}

export default function ProductionPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Production /></Suspense>;
}

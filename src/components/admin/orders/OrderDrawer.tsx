"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { DeliveriesRow, OrderItemsRow, OrderStatus, ProductionJobsRow, QualityChecksRow } from "@/lib/backend/db-types";
import { formatDate, formatLak, formatNumber, titleCase } from "@/lib/format";
import { asContact, daysUntil, db, exec, write } from "../ops/data";
import { DesignMini } from "../ops/DesignArt";
import { InternalNotes } from "../ops/Notes";
import { Confirm, DueTag, Labeled, PickField, SectionTitle, SkeletonRows, Stepper } from "../ops/parts";
import { CustomerThread } from "../ops/Thread";
import { adminInput, Drawer, ErrorNote, Meta, StatusPill } from "../ui";
import { isActive, METHODS, ORDER_STEPS, PAYMENTS, type Order } from "./shared";
import { Traceability, type TraceNode } from "./Traceability";

type Ref = { id: string; ref: string };
type Bundle = { order: Order; items: OrderItemsRow[]; jobs: ProductionJobsRow[]; qc: QualityChecksRow[]; deliveries: DeliveriesRow[]; lead: (Ref & { status: string }) | null; quote: (Ref & { status: string }) | null; reorderOf: Ref | null; reorders: Ref[] };

async function loadOrder(id: string): Promise<Bundle | null> {
  const b = db();
  const o = await b.from("orders").select("*").eq("id", id).maybeSingle();
  if (!o.data) return null;
  const order = o.data as Order;
  const [items, jobs, deliveries, lead, quote, reorderOf, reorders] = await Promise.all([
    b.from("order_items").select("*").eq("order_id", id).order("sort"), b.from("production_jobs").select("*").eq("order_id", id).order("created_at"), b.from("deliveries").select("*").eq("order_id", id).order("created_at"),
    order.lead_id ? b.from("leads").select("id,ref,status").eq("id", order.lead_id).maybeSingle() : null, order.quote_id ? b.from("quotes").select("id,ref,status").eq("id", order.quote_id).maybeSingle() : null,
    order.reorder_of ? b.from("orders").select("id,ref").eq("id", order.reorder_of).maybeSingle() : null, b.from("orders").select("id,ref").eq("reorder_of", id),
  ]);
  const jobRows = (jobs.data ?? []) as ProductionJobsRow[];
  const qc = jobRows.length ? await b.from("quality_checks").select("*").in("job_id", jobRows.map((j) => j.id)).order("checked_at", { ascending: false }) : null;
  return { order, items: (items.data ?? []) as OrderItemsRow[], jobs: jobRows, qc: (qc?.data ?? []) as QualityChecksRow[], deliveries: (deliveries.data ?? []) as DeliveriesRow[], lead: lead?.data ?? null, quote: quote?.data ?? null, reorderOf: reorderOf?.data ?? null, reorders: (reorders.data ?? []) as Ref[] };
}

function trace(b: Bundle): TraceNode[] {
  const { order: o, jobs, qc, deliveries } = b;
  const done = jobs.filter((j) => j.status === "done").length, blocked = jobs.filter((j) => j.status === "blocked").length;
  const latest = new Map<string, QualityChecksRow>(); qc.forEach((c) => { if (!latest.has(c.job_id)) latest.set(c.job_id, c); });
  const passes = [...latest.values()].filter((c) => c.result === "pass").length, fails = [...latest.values()].filter((c) => c.result === "fail").length;
  const d = deliveries[0];
  return [
    { step: "Lead", label: b.lead?.ref ?? "No lead", detail: b.lead ? titleCase(b.lead.status) : undefined, href: b.lead ? `/admin/leads/?id=${b.lead.id}` : undefined, state: b.lead ? "done" : "pending" },
    { step: "Quote", label: b.quote?.ref ?? "No quote", detail: b.quote ? titleCase(b.quote.status) : undefined, href: b.quote ? `/admin/quotes/?id=${b.quote.id}` : undefined, state: b.quote ? "done" : "pending" },
    { step: "Order", label: o.ref, detail: titleCase(o.status), state: o.status === "cancelled" ? "problem" : "current" },
    { step: "Jobs", label: jobs.length ? `${done}/${jobs.length} done` : "Not released", detail: blocked ? `${blocked} blocked` : jobs[0]?.ref, href: jobs.length ? `/admin/production/?order=${o.id}` : undefined, state: blocked ? "problem" : jobs.length && done === jobs.length ? "done" : jobs.length ? "current" : "pending" },
    { step: "QC", label: latest.size ? `${passes} pass${fails ? ` · ${fails} fail` : ""}` : "No checks yet", detail: latest.size ? `${qc.length} check${qc.length > 1 ? "s" : ""} recorded` : undefined, href: jobs[0] ? `/admin/production/?id=${jobs[0].id}` : undefined, state: fails ? "problem" : jobs.length && passes === jobs.length ? "done" : latest.size ? "current" : "pending" },
    { step: "Delivery", label: d ? titleCase(d.status) : "Not opened", detail: d ? `${titleCase(d.method)}${d.scheduled_for ? ` · ${formatDate(d.scheduled_for, { day: "numeric", month: "short" })}` : ""}` : undefined, href: d ? `/admin/production/?tab=deliveries&delivery=${d.id}` : undefined, state: d?.status === "failed" ? "problem" : d && (d.status === "delivered" || d.status === "installed") ? "done" : d ? "current" : "pending" },
  ];
}

function Manage({ b, onChanged }: { b: Bundle; onChanged: () => void }) {
  const { order: o, jobs } = b;
  const toast = useToast();
  const [f, setF] = useState({ payment_status: o.payment_status, due_on: o.due_on ?? "", delivery_method: o.delivery_method as (typeof METHODS)[number], delivery_address: o.delivery_address });
  const [ask, setAsk] = useState<{ kind: "status"; to: OrderStatus } | { kind: "release" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finish = (e: string | null, ok: string) => { setBusy(false); setAsk(null); if (e) { setErr(e); return toast(e, "danger"); } setErr(null); toast(ok, "ok"); onChanged(); };
  const save = async () => { setBusy(true); finish((await write(db().from("orders").update({ payment_status: f.payment_status, due_on: f.due_on || null, delivery_method: f.delivery_method, delivery_address: f.delivery_address.trim() }).eq("id", o.id).select("id"))).error, "Order saved."); };
  const setStatus = async (to: OrderStatus) => { setBusy(true); finish((await write(db().from("orders").update({ status: to, ...(to === "completed" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", o.id).select("id"))).error, `Order → ${titleCase(to)}`); };
  const release = async () => { setBusy(true); const r = await exec<number>(db().rpc("release_to_production", { p_order: o.id })); finish(r.error, `${r.data ?? 0} production job${r.data === 1 ? "" : "s"} created. The production team has been notified.`); };
  const canRelease = (o.status === "approved" || o.status === "artwork_review") && jobs.length === 0;

  return (
    <>
      <ErrorNote message={err} />
      {o.status === "cancelled" ? <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fog-50">This order is cancelled. <button type="button" onClick={() => setAsk({ kind: "status", to: "approved" })} className="t-label ml-2 text-[0.625rem] text-yellow">Reopen as approved</button></p>
        : <Stepper label="Order status" steps={ORDER_STEPS} current={o.status as (typeof ORDER_STEPS)[number]} onPick={(s) => setAsk(s === "production" && canRelease ? { kind: "release" } : { kind: "status", to: s })} />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canRelease && <Button size="sm" onClick={() => setAsk({ kind: "release" })}>Release to production</Button>}
        {o.status === "approved" && <Button size="sm" variant="outline" onClick={() => setAsk({ kind: "status", to: "artwork_review" })}>Move to artwork review</Button>}
        {isActive(o) && <Button size="sm" variant="danger" onClick={() => setAsk({ kind: "status", to: "cancelled" })}>Cancel order</Button>}
      </div>

      <SectionTitle>Payment, due date &amp; delivery</SectionTitle>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-3 sm:grid-cols-2">
        <PickField label="Payment status (recorded manually)" value={f.payment_status} options={PAYMENTS} onChange={(v) => setF((s) => ({ ...s, payment_status: v }))} />
        <Labeled label="Due date">{(id) => <input id={id} type="date" value={f.due_on} onChange={(e) => setF((s) => ({ ...s, due_on: e.target.value }))} className={adminInput} />}</Labeled>
        <PickField label="Delivery method" value={f.delivery_method} options={METHODS} onChange={(v) => setF((s) => ({ ...s, delivery_method: v }))} />
        <Labeled label="Delivery / installation address">{(id) => <input id={id} value={f.delivery_address} onChange={(e) => setF((s) => ({ ...s, delivery_address: e.target.value }))} className={adminInput} />}</Labeled>
        <p className="text-xs text-fog-500 sm:col-span-2">SPP does not take payment online. This field records what accounts have received.</p>
        <div className="flex justify-end sm:col-span-2"><Button type="submit" size="sm" variant="outline" loading={busy && !ask}>Save order</Button></div>
      </form>

      <Confirm open={ask?.kind === "release"} title="Release to production?" confirmLabel="Release" pending={busy} onClose={() => setAsk(null)} onConfirm={() => void release()} body={<>Creates one production job per line ({b.items.length}) with the approved artwork version, sets the order to PRODUCTION and notifies the production team and the customer. Every designed line must carry SPP-approved artwork.</>} />
      <Confirm open={ask?.kind === "status"} danger={ask?.kind === "status" && ask.to === "cancelled"} title={ask?.kind === "status" && ask.to === "cancelled" ? "Cancel this order?" : "Change order status?"} confirmLabel={ask?.kind === "status" ? `Set ${titleCase(ask.to)}` : "Confirm"} pending={busy} onClose={() => setAsk(null)} onConfirm={() => ask?.kind === "status" && void setStatus(ask.to)}
        body={ask?.kind === "status" && ask.to === "cancelled" ? <>Cancelling {o.ref} removes it from the active pipeline. The customer sees the cancelled status in My SPP. Production jobs are not deleted — tell the production team.</> : <>The customer sees this status in My SPP. Production normally moves the order forward automatically (release → QC pass → delivery); override it only when the real world is ahead of the system.</>} />
    </>
  );
}

export function OrderDrawer({ id, canEdit, now, onClose, onChanged }: { id: string | null; canEdit: boolean; now: number; onClose: () => void; onChanged: () => void }) {
  const q = useQuery<Bundle | null>(() => loadOrder(id ?? ""), [id], { enabled: Boolean(id) });
  const b = q.data, o = b?.order, c = asContact(o?.contact);
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={o?.ref ?? "Order"} sub={o && <span className="flex flex-wrap items-center gap-2"><StatusPill status={o.status} /><StatusPill status={o.payment_status} />{c.name && <span>{c.name}{c.company ? ` · ${c.company}` : ""}</span>}{o.due_on && <DueTag days={daysUntil(o.due_on, now)} done={!isActive(o)} />}</span>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !b && <SkeletonRows n={6} />}
      {!q.loading && !q.error && !b && <p className="text-sm text-fog-400">This order could not be found, or your role cannot view it.</p>}
      {b && o && (
        <>
          <Traceability nodes={trace(b)} reorderOf={b.reorderOf} reorders={b.reorders} />
          <div className="mt-6">{canEdit && <Manage key={`${o.id}-${o.updated_at}-${b.jobs.length}`} b={b} onChanged={() => { void q.reload(); onChanged(); }} />}</div>

          <SectionTitle action={<span className="t-data text-sm text-fog-50">{formatLak(o.total_lak != null ? Number(o.total_lak) : null)}</span>}>Items</SectionTitle>
          <ol className="flex flex-col gap-2">
            {b.items.map((i) => (
              <li key={i.id} className="flex gap-3 border border-ink-700 bg-ink-950 p-3">
                <DesignMini designId={i.design_id} version={i.design_version} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="flex flex-wrap justify-between gap-x-3"><span className="font-medium text-fog-50">{i.product_name}</span><span className="t-data text-fog-300">× {formatNumber(i.qty)}</span></p>
                  <p className="t-data mt-1 text-xs text-fog-400">{i.unit_price_lak != null ? `${formatLak(Number(i.unit_price_lak))} / unit · ` : ""}{formatLak(i.line_total_lak != null ? Number(i.line_total_lak) : null)}</p>
                  {i.design_id && <Link href={`/admin/designs/?id=${i.design_id}`} className="mt-1 inline-block text-xs text-fog-300 underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">Artwork{i.design_version ? ` v${i.design_version}` : ""} — review &amp; approval</Link>}
                </div>
              </li>
            ))}
            {b.items.length === 0 && <li className="text-sm text-fog-500">No line items.</li>}
          </ol>

          <SectionTitle>Production jobs</SectionTitle>
          {b.jobs.length === 0 ? <p className="text-sm text-fog-500">Not released yet. Jobs appear here once the order is released to production.</p> : (
            <ul>{b.jobs.map((j) => { const last = b.qc.find((x) => x.job_id === j.id); return (
              <li key={j.id} className="border-b border-ink-800 last:border-0"><Link href={`/admin/production/?id=${j.id}`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm hover:bg-ink-850"><span className="t-data text-fog-50">{j.ref}</span><span className="text-fog-300">{j.product_name} × {formatNumber(j.qty)}</span><StatusPill status={j.status} />{last && <span className="flex items-center gap-1 text-xs text-fog-500">QC <StatusPill status={last.result} /></span>}{j.status !== "done" && <span className="ml-auto"><DueTag days={daysUntil(j.deadline, now)} /></span>}</Link></li>); })}</ul>
          )}

          <SectionTitle>Deliveries</SectionTitle>
          {b.deliveries.length === 0 ? <p className="text-sm text-fog-500">A delivery is opened automatically when every job passes QC.</p> : (
            <ul>{b.deliveries.map((d) => <li key={d.id} className="border-b border-ink-800 last:border-0"><Link href={`/admin/production/?tab=deliveries&delivery=${d.id}`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm hover:bg-ink-850"><span className="text-fog-50">{titleCase(d.method)}</span><StatusPill status={d.status} /><span className="text-xs text-fog-400">{d.scheduled_for ? `scheduled ${formatDate(d.scheduled_for)}` : "not scheduled"}{d.carrier ? ` · ${d.carrier}` : ""}{d.tracking ? ` · ${d.tracking}` : ""}</span></Link></li>)}</ul>
          )}

          <SectionTitle>Customer</SectionTitle>
          <Meta items={[{ label: "Contact", value: <>{c.name ?? "—"}{c.company ? ` · ${c.company}` : ""}</> }, { label: "Reach", value: <span className="flex flex-wrap gap-x-3">{c.email && <a href={`mailto:${c.email}`} className="underline decoration-ink-500 underline-offset-4">{c.email}</a>}{c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="underline decoration-ink-500 underline-offset-4">{c.phone}</a>}</span> }, { label: "Confirmed", value: o.customer_confirmed_at ? `Customer confirmed receipt ${formatDate(o.customer_confirmed_at)}` : "—" }, { label: "Created", value: formatDate(o.created_at) }]} />
          <div className="mt-8"><CustomerThread entity="order" entityId={o.id} customerId={o.customer_id} /></div>
          <div className="mt-8"><InternalNotes entity="order" entityId={o.id} /></div>
        </>
      )}
    </Drawer>
  );
}

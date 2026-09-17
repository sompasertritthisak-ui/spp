"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { DeliveriesRow, DeliveryStatus } from "@/lib/backend/db-types";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { db, write } from "../ops/data";
import { Labeled, SectionTitle } from "../ops/parts";
import { adminInput, DataTable, Drawer, ErrorNote, StatusPill, type Column } from "../ui";
import { loadOrderCtx, type OrderCtx } from "./shared";

type Row = DeliveriesRow & { order: OrderCtx | null };
const NEXT: Partial<Record<DeliveryStatus, { to: DeliveryStatus; label: string }[]>> = {
  pending: [{ to: "scheduled", label: "Mark scheduled" }], scheduled: [{ to: "in_transit", label: "Mark in transit" }],
  in_transit: [{ to: "delivered", label: "Mark delivered" }, { to: "installed", label: "Mark installed" }, { to: "failed", label: "Delivery failed" }], failed: [{ to: "scheduled", label: "Reschedule" }],
};

function Editor({ d, onSaved }: { d: Row; onSaved: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ scheduled_for: d.scheduled_for ?? "", address: d.address, carrier: d.carrier, tracking: d.tracking, note: d.note });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fields = () => ({ scheduled_for: f.scheduled_for || null, address: f.address.trim(), carrier: f.carrier.trim(), tracking: f.tracking.trim(), note: f.note.trim() });

  const commit = async (name: string, patch: Partial<DeliveriesRow>, ok: string) => {
    setBusy(name); setErr(null);
    const r = await write(db().from("deliveries").update(patch).eq("id", d.id).select("id"));
    setBusy(null);
    if (r.error) return setErr(r.error);
    toast(ok, "ok"); onSaved();
  };
  const advance = (to: DeliveryStatus) => {
    if (to === "scheduled" && !f.scheduled_for) return setErr("Set the scheduled date first.");
    const closing = to === "delivered" || to === "installed";
    void commit(to, { ...fields(), status: to, completed_at: closing ? new Date().toISOString() : null }, closing ? `Marked ${to}. The order is now completed and the customer is notified.` : `Delivery → ${titleCase(to)}`);
  };
  const proof = async (picked: File | undefined) => {
    if (!picked || !user) return;
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(picked.type) || picked.size > 25 * 1048576) return setErr("Proof must be a PNG, JPG, WebP or PDF up to 25 MB.");
    setBusy("proof"); setErr(null);
    const path = `${user.id}/${crypto.randomUUID()}.${picked.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"}`;
    const up = await db().storage.from("private-artwork").upload(path, picked, { contentType: picked.type });
    if (up.error) { setBusy(null); return setErr("The proof could not be uploaded. Try again."); }
    await commit("proof", { proof_path: path }, "Proof of delivery attached.");
    if (file.current) file.current.value = "";
  };
  const viewProof = async () => {
    if (!d.proof_path) return;
    const { data } = await db().storage.from("private-artwork").createSignedUrl(d.proof_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener"); else toast("The proof could not be opened.", "danger");
  };

  return (
    <>
      <ErrorNote message={err} />
      <div className="flex flex-wrap items-center gap-2 border border-ink-700 bg-ink-950 p-3">
        <p className="t-label mr-auto text-[0.625rem] text-fog-500">Next step</p>
        {(NEXT[d.status] ?? []).map((n) => <Button key={n.to} size="sm" variant={n.to === "failed" ? "danger" : "primary"} loading={busy === n.to} disabled={busy != null} onClick={() => advance(n.to)}>{n.label}</Button>)}
        {!NEXT[d.status] && <p className="text-sm text-fog-300">Closed {formatDateTime(d.completed_at)}.</p>}
      </div>
      <SectionTitle>Schedule &amp; carrier</SectionTitle>
      <form onSubmit={(e) => { e.preventDefault(); void commit("save", fields(), "Delivery saved."); }} className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Scheduled for">{(id) => <input id={id} type="date" value={f.scheduled_for} onChange={(e) => setF((s) => ({ ...s, scheduled_for: e.target.value }))} className={adminInput} />}</Labeled>
        <Labeled label="Carrier / driver">{(id) => <input id={id} value={f.carrier} onChange={(e) => setF((s) => ({ ...s, carrier: e.target.value }))} className={adminInput} />}</Labeled>
        <Labeled label="Tracking / vehicle">{(id) => <input id={id} value={f.tracking} onChange={(e) => setF((s) => ({ ...s, tracking: e.target.value }))} className={adminInput} />}</Labeled>
        <Labeled label="Address">{(id) => <input id={id} value={f.address} onChange={(e) => setF((s) => ({ ...s, address: e.target.value }))} className={adminInput} />}</Labeled>
        <Labeled label="Note" className="sm:col-span-2">{(id) => <textarea id={id} rows={2} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} placeholder="Gate code, who signed, what went wrong…" className={`${adminInput} resize-y py-2`} />}</Labeled>
        <div className="flex justify-end sm:col-span-2"><Button type="submit" size="sm" variant="outline" loading={busy === "save"}>Save</Button></div>
      </form>
      <SectionTitle>Proof of delivery <span className="text-fog-500">· optional</span></SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        {d.proof_path && <Button size="sm" variant="outline" onClick={() => void viewProof()}>View proof</Button>}
        <input ref={file} type="file" aria-label="Upload proof of delivery" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy != null} onChange={(e) => void proof(e.target.files?.[0])} className="max-w-full text-xs text-fog-400 file:mr-3 file:min-h-9 file:border file:border-ink-500 file:bg-transparent file:px-3 file:font-mono file:text-[0.625rem] file:uppercase file:tracking-widest file:text-fog-50" />
        {busy === "proof" && <span aria-live="polite" className="text-xs text-fog-500">Uploading…</span>}
      </div>
    </>
  );
}

export function Deliveries({ viaView, selected, onSelect }: { viaView: boolean; selected: string | null; onSelect: (id: string | null) => void }) {
  const q = useQuery<Row[]>(async () => {
    const { data, error } = await db().from("deliveries").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) return { data: null, error };
    const rows = (data ?? []) as DeliveriesRow[];
    const orders = await loadOrderCtx(rows.map((r) => r.order_id), viaView);
    return { data: rows.map((r) => ({ ...r, order: orders[r.order_id] ?? null })), error: null };
  }, [viaView]);
  const open = q.data?.filter((d) => !["delivered", "installed"].includes(d.status)).length ?? 0;
  const current = q.data?.find((d) => d.id === selected) ?? null;
  const columns: Column<Row>[] = [
    { key: "order", header: "Order", cell: (d) => <span className="block min-w-40"><span className="t-data block text-fog-50">{d.order?.ref ?? "Order"}</span><span className="block text-xs text-fog-400">{d.order?.contact_name}{d.order?.contact_company ? ` · ${d.order.contact_company}` : ""}</span></span> },
    { key: "status", header: "Status", cell: (d) => <StatusPill status={d.status} /> },
    { key: "method", header: "Method", hideBelow: "sm", cell: (d) => <span className="text-fog-300">{titleCase(d.method)}</span> },
    { key: "when", header: "Scheduled", cell: (d) => <span className="t-data text-xs text-fog-300">{d.scheduled_for ? formatDate(d.scheduled_for, { weekday: "short", day: "numeric", month: "short" }) : "not scheduled"}</span> },
    { key: "carrier", header: "Carrier · tracking", hideBelow: "md", cell: (d) => <span className="text-xs text-fog-400">{[d.carrier, d.tracking].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "addr", header: "Address", hideBelow: "lg", cell: (d) => <span className="line-clamp-1 text-xs text-fog-400">{d.address || "—"}</span> },
  ];
  return (
    <>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <div className="border border-ink-700 bg-ink-900">
        <p className="t-label border-b border-ink-700 px-4 py-3 text-[0.625rem] text-fog-500">{q.data ? `${open} open · ${q.data.length - open} closed` : "Loading deliveries…"}</p>
        <DataTable caption="Deliveries" rows={q.data} columns={columns} rowKey={(d) => d.id} onRowClick={(d) => onSelect(d.id)} loading={q.loading} empty="No deliveries yet. One is opened automatically when every job on an order passes QC." />
      </div>
      <Drawer open={Boolean(selected)} onClose={() => onSelect(null)} title={current?.order?.ref ? `Delivery · ${current.order.ref}` : "Delivery"} sub={current && <span className="flex flex-wrap items-center gap-2"><StatusPill status={current.status} /><span>{titleCase(current.method)}</span>{current.order?.contact_name && <span>· {current.order.contact_name}</span>}</span>}>
        {q.loading && !current && <div className="skeleton h-40" />}
        {!q.loading && !current && <p className="text-sm text-fog-400">This delivery could not be found.</p>}
        {current && <Editor key={`${current.id}-${current.updated_at}`} d={current} onSaved={() => void q.reload()} />}
      </Drawer>
    </>
  );
}

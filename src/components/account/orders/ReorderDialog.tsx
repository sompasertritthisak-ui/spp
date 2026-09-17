"use client";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError, Input, Textarea } from "@/components/ui/Field";
import { track } from "@/lib/backend/analytics";
import { requireBackend, toBackendError } from "@/lib/backend/client";
import { formatNumber } from "@/lib/format";
import { configSummary, type OrderItem, type OrderLite } from "./shared";

const today = () => new Date().toISOString().slice(0, 10);

/** Clones the order's lines, configuration and artwork into a new quote request via request_reorder(). */
export function ReorderDialog({ open, onClose, order, items }: { open: boolean; onClose: () => void; order: OrderLite; items: OrderItem[] }) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  const parsed = useMemo(() => items.map((i) => {
    const raw = qty[i.id];
    const n = raw === undefined || raw === "" ? i.qty : Number(raw);
    return { item: i, n, valid: Number.isInteger(n) && n >= 0 && n <= 1000000 };
  }), [items, qty]);
  const kept = parsed.filter((p) => p.valid && p.n > 0);
  const invalid = parsed.some((p) => !p.valid);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return setError("Quantities must be whole numbers. Use 0 to leave a line out.");
    if (!kept.length) return setError("Keep at least one line — every quantity is 0.");
    if (neededBy && neededBy < today()) return setError("The needed-by date is in the past.");
    setBusy(true);
    setError(null);
    // only send lines that differ; the server defaults the rest to the original quantity
    const quantities = Object.fromEntries(parsed.filter((p) => p.n !== p.item.qty).map((p) => [p.item.id, p.n]));
    const { data, error: err } = await requireBackend().rpc("request_reorder", { order_id: order.id, quantities, needed_by: neededBy || null, notes: notes.trim() });
    setBusy(false);
    if (err) return setError(toBackendError(err).message);
    const ref = (data as { ref?: string } | null)?.ref ?? "";
    track("reorder_requested", { ref, source: order.ref });
    setDoneRef(ref);
  };

  const close = () => { if (!busy) { onClose(); if (doneRef) { setDoneRef(null); setQty({}); setNotes(""); setNeededBy(""); } } };

  if (doneRef !== null)
    return (
      <Dialog open={open} onClose={close} title="Reorder requested" footer={<><Button variant="ghost" onClick={close}>Close</Button><Button href="/account/quotes/" arrow>My quotes</Button></>}>
        <div className="flex flex-col gap-4" role="status">
          <p className="t-label text-fog-500">Your reference</p>
          <p className="t-data text-2xl text-yellow">{doneRef || "Sent"}</p>
          <p className="text-fog-300">SPP has your reorder of {order.ref} with the same artwork and configuration. We will check current pricing and send a written quotation — it appears under <Link href="/account/quotes/" className="underline underline-offset-4 hover:text-yellow">My Quotes</Link> for you to accept.</p>
          <p className="text-sm text-fog-500">Nothing is produced until you accept that quotation.</p>
        </div>
      </Dialog>
    );

  return (
    <Dialog open={open} onClose={close} wide title={`Reorder ${order.ref}`}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <p className="text-fog-400">Same products, same artwork, same configuration. Change the quantities you need — set a line to 0 to leave it out.</p>
        <ul className="border-t border-ink-700">
          {parsed.map(({ item: i, n, valid }) => (
            <li key={i.id} className={`flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 py-3 ${valid && n === 0 ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-fog-50">{i.product_name}</p>
                <p className="break-words text-sm text-fog-400">Last time: {formatNumber(i.qty)}{configSummary(i.config) ? ` · ${configSummary(i.config)}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor={`rq-${i.id}`} className="t-label text-fog-500">Qty</label>
                <input id={`rq-${i.id}`} type="number" inputMode="numeric" min={0} max={1000000} step={1} value={qty[i.id] ?? String(i.qty)} onChange={(e) => setQty((s) => ({ ...s, [i.id]: e.target.value }))} aria-invalid={!valid} className="t-data min-h-12 w-28 border border-ink-600 bg-ink-950 px-3 text-right text-base text-fog-50 focus:border-yellow focus:outline-none aria-[invalid=true]:border-danger" />
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Needed by (optional)" type="date" min={today()} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          <p className="self-end text-sm text-fog-500">{kept.length} of {items.length} line{items.length === 1 ? "" : "s"} · {formatNumber(kept.reduce((s, p) => s + p.n, 0))} pieces in total</p>
        </div>
        <Textarea label="Notes for SPP (optional)" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} hint="Anything different this time — sizes, delivery address, a deadline." />
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button type="submit" arrow loading={busy} disabled={!items.length}>Request reorder</Button>
        </div>
        <p className="text-sm text-fog-500">This sends a quote request. Prices may have changed since {order.ref}; SPP confirms them in writing before anything is made.</p>
      </form>
    </Dialog>
  );
}

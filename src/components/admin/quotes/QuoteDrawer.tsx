"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { QuoteItemsRow, QuotesRow } from "@/lib/backend/db-types";
import { formatDate, formatDateTime, formatLak, titleCase } from "@/lib/format";
import { asContact, db, exec, num, write } from "../ops/data";
import { InternalNotes } from "../ops/Notes";
import { Confirm, Labeled, SectionTitle, SkeletonRows } from "../ops/parts";
import { CustomerThread } from "../ops/Thread";
import { adminInput, Drawer, ErrorNote, Meta, StatusPill } from "../ui";
import { draftOf, lineTotal, QuoteItems, type LineDraft } from "./QuoteItems";

type Bundle = { quote: QuotesRow; items: QuoteItemsRow[]; order: { id: string; ref: string } | null; source: { id: string; ref: string } | null };
const EDITABLE = ["draft", "submitted", "in_review", "sent", "expired"];

function Editor({ b, canEdit, onChanged }: { b: Bundle; canEdit: boolean; onChanged: () => void }) {
  const { quote: q, items } = b;
  const toast = useToast();
  const editable = canEdit && EDITABLE.includes(q.status) && !b.order;
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(() => Object.fromEntries(items.map((i) => [i.id, draftOf(i)])));
  const sumOf = (ds: Record<string, LineDraft>) => items.reduce<number | null>((t, i) => { const v = lineTotal(i, ds[i.id]); return t == null || v == null ? null : t + v; }, 0);
  const [head, setHead] = useState(() => { const s = sumOf(Object.fromEntries(items.map((i) => [i.id, draftOf(i)]))); const touched = q.total_lak != null && Number(q.total_lak) !== s; return { total: touched ? String(Number(q.total_lak)) : "", totalTouched: touched, valid_until: q.valid_until ?? "", terms: q.terms }; });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState<"send" | "convert" | "decline" | null>(null);
  const sum = sumOf(drafts);
  const total = head.totalTouched ? num(head.total) : sum;
  const unpriced = items.filter((i) => num(drafts[i.id]?.unit ?? "") == null).length;

  /** Persists every line + the header. Returns a displayable error, or null. */
  const save = async (): Promise<string | null> => {
    for (const i of items) { const d = drafts[i.id]; if (d && ((d.unit.trim() && num(d.unit) == null) || (d.totalTouched && d.total.trim() && num(d.total) == null))) return `Line “${i.product_name}”: prices must be numbers in LAK.`; }
    if (head.totalTouched && head.total.trim() && num(head.total) == null) return "The quoted total must be a number in LAK.";
    const results = await Promise.all([
      ...items.map((i) => write(db().from("quote_items").update({ unit_price_lak: num(drafts[i.id]?.unit ?? ""), line_total_lak: lineTotal(i, drafts[i.id]), note: (drafts[i.id]?.note ?? "").trim() }).eq("id", i.id).select("id"))),
      write(db().from("quotes").update({ total_lak: total, valid_until: head.valid_until || null, terms: head.terms.trim() }).eq("id", q.id).select("id")),
    ]);
    return results.find((r) => r.error)?.error ?? null;
  };
  const act = async (name: string, fn: () => Promise<string | null>, done: string) => {
    setBusy(name); setErr(null);
    const e = await fn();
    setBusy(null); setAsk(null);
    if (e) { setErr(e); return toast(e, "danger"); }
    toast(done, "ok");
    onChanged();
  };
  const onSave = () => act("save", save, "Pricing saved.");
  const setStatus = (status: QuotesRow["status"], done: string) => act(status, async () => (await write(db().from("quotes").update({ status, ...(status === "declined" ? { decided_at: new Date().toISOString() } : {}) }).eq("id", q.id).select("id"))).error, done);
  const send = () => act("send", async () => (await save()) ?? (await exec(db().rpc("send_quote", { quote: q.id }))).error, `Quote ${q.ref} sent${q.customer_id ? " — the customer has been notified in My SPP" : ""}.`);
  const convert = () => act("convert", async () => (await exec(db().rpc("convert_quote_to_order", { quote: q.id }))).error, "Order created. The lead is marked as won.");

  return (
    <>
      <ErrorNote message={err} />
      <SectionTitle>Line items</SectionTitle>
      <QuoteItems items={items} drafts={drafts} editable={editable} setDraft={(id, p) => setDrafts((s) => ({ ...s, [id]: { ...s[id]!, ...p } }))} />

      <SectionTitle>Totals &amp; terms</SectionTitle>
      <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Quoted total (LAK)" hint={head.totalTouched ? `Overridden — lines add up to ${sum != null ? formatLak(sum) : "an incomplete sum"}` : unpriced ? `${unpriced} line${unpriced > 1 ? "s" : ""} still unpriced` : "Sum of the lines; type to override"}>
          {(id) => <input id={id} inputMode="numeric" value={head.totalTouched ? head.total : total != null ? String(total) : ""} onChange={(e) => setHead((h) => ({ ...h, total: e.target.value, totalTouched: true }))} className={`${adminInput} t-data text-base disabled:opacity-60`} />}
        </Labeled>
        <Labeled label="Valid until">{(id) => <input id={id} type="date" value={head.valid_until} onChange={(e) => setHead((h) => ({ ...h, valid_until: e.target.value }))} className={`${adminInput} disabled:opacity-60`} />}</Labeled>
        <Labeled label="Terms (customer sees this)" className="sm:col-span-2">{(id) => <textarea id={id} rows={3} value={head.terms} onChange={(e) => setHead((h) => ({ ...h, terms: e.target.value }))} placeholder="Deposit, lead time, delivery, what is included…" className={`${adminInput} resize-y py-2 disabled:opacity-60`} />}</Labeled>
      </fieldset>
      {head.totalTouched && editable && <button type="button" onClick={() => setHead((h) => ({ ...h, totalTouched: false, total: "" }))} className="t-label mt-2 text-[0.625rem] text-yellow">Reset total to the sum of lines</button>}

      {canEdit && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border border-ink-700 bg-ink-950 p-3">
          <p className="t-label mr-auto text-[0.625rem] text-fog-500">Next step</p>
          {editable && <Button size="sm" variant="outline" loading={busy === "save"} onClick={() => void onSave()}>Save pricing</Button>}
          {(q.status === "draft" || q.status === "submitted") && <Button size="sm" variant="outline" loading={busy === "in_review"} onClick={() => void setStatus("in_review", "Marked in review.")}>Mark in review</Button>}
          {editable && <Button size="sm" disabled={unpriced > 0 || !total} onClick={() => setAsk("send")}>{q.status === "sent" ? "Re-send quote" : "Send quote"}</Button>}
          {q.status === "sent" && !b.order && <Button size="sm" variant="danger" onClick={() => setAsk("decline")}>Mark declined</Button>}
          {(q.status === "accepted" || q.status === "sent") && !b.order && <Button size="sm" variant={q.status === "accepted" ? "primary" : "outline"} onClick={() => setAsk("convert")}>Convert to order</Button>}
          {b.order && <Button size="sm" href={`/admin/orders/?id=${b.order.id}`} arrow>Order {b.order.ref}</Button>}
          {editable && (unpriced > 0 || !total) && <p className="w-full text-xs text-fog-500">To send: price every line and set a total.</p>}
        </div>
      )}

      <Confirm open={ask === "send"} title="Send this quote?" confirmLabel="Send quote" pending={busy === "send"} onClose={() => setAsk(null)} onConfirm={() => void send()}
        body={<>Your pricing is saved, then <strong className="text-fog-50">{q.ref}</strong> is released at <strong className="t-data text-fog-50">{formatLak(total)}</strong>{head.valid_until ? <> valid until {formatDate(head.valid_until)}</> : null}. {q.customer_id ? "The customer is notified and can accept or decline it in My SPP." : "This contact has no My SPP account — send them the figures by WhatsApp or email as well."}</>} />
      <Confirm open={ask === "convert"} title="Convert to order?" confirmLabel="Create order" pending={busy === "convert"} onClose={() => setAsk(null)} onConfirm={() => void convert()}
        body={q.status === "accepted" ? <>The customer accepted {q.ref}. This creates the order, marks the lead as won and notifies the customer.</> : <>The customer has <strong className="text-fog-50">not accepted {q.ref} in the portal</strong>. Only continue if they confirmed another way (signed quote, WhatsApp, phone). This creates the order and marks the lead as won.</>} />
      <Confirm open={ask === "decline"} danger title="Mark quote as declined?" confirmLabel="Mark declined" pending={busy === "declined"} onClose={() => setAsk(null)} onConfirm={() => void setStatus("declined", "Quote marked as declined.")} body={<>Use this when the customer has said no outside the portal. The quote closes and can no longer be accepted.</>} />
    </>
  );
}

export function QuoteDrawer({ id, canEdit, onClose, onChanged }: { id: string | null; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const q = useQuery<Bundle | null>(async () => {
    const b = db();
    const [quote, items, order] = await Promise.all([
      b.from("quotes").select("*").eq("id", id ?? "").maybeSingle(), b.from("quote_items").select("*").eq("quote_id", id ?? "").order("sort"), b.from("orders").select("id,ref").eq("quote_id", id ?? "").limit(1),
    ]);
    if (!quote.data) return null;
    const src = quote.data.reorder_of ? await b.from("orders").select("id,ref").eq("id", quote.data.reorder_of).maybeSingle() : null;
    return { quote: quote.data as QuotesRow, items: (items.data ?? []) as QuoteItemsRow[], order: (order.data?.[0] as Bundle["order"]) ?? null, source: (src?.data as Bundle["source"]) ?? null };
  }, [id], { enabled: Boolean(id) });
  const b = q.data, qu = b?.quote, c = asContact(qu?.contact);
  const stamp = b ? `${b.quote.id}-${b.quote.updated_at}-${b.items.map((i) => `${i.unit_price_lak}:${i.line_total_lak}:${i.note}`).join("|")}-${b.order?.id ?? ""}` : "";
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={qu?.ref ?? "Quote"} sub={qu && <span className="flex flex-wrap items-center gap-2"><StatusPill status={qu.status} /><span>{titleCase(qu.kind)} quote</span>{c.name && <span>· {c.name}</span>}</span>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !b && <SkeletonRows n={6} />}
      {!q.loading && !q.error && !b && <p className="text-sm text-fog-400">This quote could not be found, or your role cannot view it.</p>}
      {b && qu && (
        <>
          {b.source && <p className="mb-4 border border-sky/30 bg-ink-950 px-3 py-2 text-sm text-fog-100">Reorder of <Link href={`/admin/orders/?id=${b.source.id}`} className="t-data underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">{b.source.ref}</Link> — same artwork and configuration, new quantities.</p>}
          <Meta items={[
            { label: "Contact", value: <>{c.name ?? "—"}{c.company ? ` · ${c.company}` : ""}</> },
            { label: "Reach", value: <span className="flex flex-wrap gap-x-3">{c.email && <a href={`mailto:${c.email}`} className="underline decoration-ink-500 underline-offset-4">{c.email}</a>}{c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="underline decoration-ink-500 underline-offset-4">{c.phone}</a>}{!c.email && !c.phone && "—"}</span> },
            { label: "Needed by", value: formatDate(qu.needed_by) },
            { label: "Design help", value: qu.needs_design_help ? "Yes — customer asked for design help" : "No" },
            { label: "Estimate", value: qu.estimate_low_lak != null ? <span className="t-data">{formatLak(Number(qu.estimate_low_lak))} – {formatLak(Number(qu.estimate_high_lak))} <span className="text-xs text-fog-500">(engine band at submit time — context only)</span></span> : "No automatic estimate (quote-only items)" },
            { label: "Timeline", value: <span className="text-fog-300">Requested {formatDateTime(qu.created_at)}{qu.sent_at ? ` · sent ${formatDateTime(qu.sent_at)}` : ""}{qu.decided_at ? ` · decided ${formatDateTime(qu.decided_at)}` : ""}</span> },
            { label: "Lead", value: qu.lead_id ? <Link href={`/admin/leads/?id=${qu.lead_id}`} className="underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">Open lead</Link> : "—" },
          ]} />
          {qu.customer_notes && <><SectionTitle>Customer notes</SectionTitle><p className="whitespace-pre-wrap border-l-2 border-ink-600 pl-3 text-sm text-fog-100">{qu.customer_notes}</p></>}
          <div className="mt-8"><Editor key={stamp} b={b} canEdit={canEdit} onChanged={() => { void q.reload(); onChanged(); }} /></div>
          <div className="mt-8"><CustomerThread entity="quote" entityId={qu.id} customerId={qu.customer_id} /></div>
          <div className="mt-8"><InternalNotes entity="quote" entityId={qu.id} /></div>
        </>
      )}
    </Drawer>
  );
}

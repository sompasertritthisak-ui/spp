"use client";
import Link from "next/link";
import { useState } from "react";
import { ErrorNote, Meta, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/backend/analytics";
import { requireBackend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate, formatLak, titleCase } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";
import { LineItems } from "../LineItems";
import { MessagesThread } from "../MessagesThread";
import { usePortal } from "../PortalShell";
import { ActionPill, Block, PortalEmpty, PortalHeader, RowsSkeleton } from "../ui";
import { isExpired, isPriced, QUOTE_COLS, QUOTE_ITEM_COLS, QUOTE_NOTE, type QuoteItem, type QuoteLite } from "./shared";

type Loaded = { quote: QuoteLite | null; items: QuoteItem[]; order: { id: string; ref: string } | null; source: { id: string; ref: string } | null };

export function QuoteDetail({ id }: { id: string }) {
  const { uid, contact } = usePortal();
  const toast = useToast();
  const q = useQuery<Loaded>(async () => {
    const b = requireBackend();
    const [quote, items, order] = await Promise.all([
      b.from("quotes").select(QUOTE_COLS).eq("id", id).eq("customer_id", uid).neq("status", "draft").maybeSingle(),
      b.from("quote_items").select(QUOTE_ITEM_COLS).eq("quote_id", id).order("sort"),
      b.from("orders").select("id,ref").eq("quote_id", id).eq("customer_id", uid).limit(1).maybeSingle(),
    ]);
    const err = quote.error ?? items.error;
    if (err) return { data: null, error: err };
    const src = quote.data?.reorder_of ? await b.from("orders").select("id,ref").eq("id", quote.data.reorder_of).maybeSingle() : null;
    return { data: { quote: quote.data as QuoteLite | null, items: (items.data ?? []) as QuoteItem[], order: order.data ?? null, source: src?.data ?? null }, error: null };
  }, [id, uid]);
  const [confirm, setConfirm] = useState<"accept" | "decline" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<"accepted" | "declined" | null>(null); // optimistic status

  const back = { href: "/account/quotes/", label: "All quotes" };
  if (q.loading && !q.data) return <><PortalHeader title="Quote" back={back} /><RowsSkeleton rows={4} tall /></>;
  if (q.error) return <><PortalHeader title="Quote" back={back} /><ErrorNote message={q.error} onRetry={q.reload} /></>;
  const quote = q.data?.quote;
  if (!quote) return <><PortalHeader title="Quote not found" back={back} /><PortalEmpty title="We could not find that quote." body="It may belong to a different account, or the link may be incomplete." action={<Button href="/account/quotes/" variant="outline">All quotes</Button>} /></>;

  const status = decided ?? quote.status;
  const expired = !decided && isExpired(quote);
  const priced = isPriced(status);
  const awaiting = status === "sent" && !expired;
  const wa = whatsappHref(contact.whatsapp, { kind: "quote", quoteRef: quote.ref });

  const respond = async (accept: boolean) => {
    setBusy(true);
    setError(null);
    const { error: err } = await requireBackend().rpc("respond_to_quote", { quote: quote.id, accept });
    setBusy(false);
    if (err) return setError(toBackendError(err).message);
    setConfirm(null);
    setDecided(accept ? "accepted" : "declined");
    toast(accept ? `Quotation ${quote.ref} accepted. SPP has been notified.` : `Quotation ${quote.ref} declined.`, "ok");
    void q.reload();
  };

  return (
    <>
      <PortalHeader title={quote.ref} tone="gold" back={back} sub={<span className="flex flex-wrap items-center gap-3">{awaiting ? <ActionPill>sent</ActionPill> : <StatusPill status={expired ? "expired" : status} />}<span>{quote.kind === "reorder" ? "Reorder request" : `${titleCase(quote.kind)} quote`} · requested {formatDate(quote.created_at)}</span></span>} />

      <div aria-live="polite" className={`mb-10 border p-5 ${awaiting ? "border-gold/60 bg-gold/10" : "border-ink-700 bg-ink-900"}`}>
        <p className="text-fog-100">{QUOTE_NOTE[expired ? "expired" : status]}</p>
        {awaiting && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => { setError(null); setConfirm("accept"); }}>Accept quotation</Button>
            <Button size="lg" variant="outline" onClick={() => { setError(null); setConfirm("decline"); }}>Decline</Button>
          </div>
        )}
        {q.data?.order && <p className="mt-4"><Link href={`/account/orders/?id=${q.data.order.id}`} className="text-yellow underline underline-offset-4">View order {q.data.order.ref}</Link></p>}
      </div>

      <Block title={`Items · ${q.data?.items.length ?? 0}`}>
        {q.data?.items.length ? <LineItems lines={q.data.items} showPrices={priced} /> : <p className="text-fog-400">This quote has no line items yet.</p>}
      </Block>

      <Block title={priced ? "Written quotation" : "Estimate"}>
        {priced ? (
          <div className="flex flex-col gap-5">
            <p><span className="t-label mr-3 text-fog-500">Total</span><span className="t-data text-3xl text-gold">{formatLak(quote.total_lak)}</span></p>
            <Meta items={[{ label: "Valid until", value: quote.valid_until ? formatDate(quote.valid_until) : "Not specified" }, { label: "Sent", value: formatDate(quote.sent_at) }, ...(quote.decided_at ? [{ label: "Decided", value: formatDate(quote.decided_at) }] : [])]} />
            {quote.terms && <div><p className="t-label mb-2 text-fog-500">Terms</p><p className="max-w-2xl whitespace-pre-wrap break-words text-fog-300">{quote.terms}</p></div>}
          </div>
        ) : quote.estimate_low_lak != null && quote.estimate_high_lak != null ? (
          <div>
            <p className="t-data text-2xl text-fog-50">{formatLak(quote.estimate_low_lak)} – {formatLak(quote.estimate_high_lak)}</p>
            <p className="mt-2 max-w-2xl text-sm text-fog-400"><span className="t-label mr-2 text-warn">Estimate</span>Calculated automatically when you sent the request. Your written quotation from SPP is the confirmed price and will replace this figure.</p>
          </div>
        ) : <p className="max-w-2xl text-fog-400">This request needs a person to price it. SPP will send a written quotation — there is no automatic estimate for these items.</p>}
      </Block>

      <Block title="Your request">
        <Meta items={[
          { label: "Needed by", value: quote.needed_by ? formatDate(quote.needed_by) : "No date given" },
          { label: "Design help", value: quote.needs_design_help ? "Requested" : "Not requested" },
          ...(q.data?.source ? [{ label: "Reorder of", value: <Link href={`/account/orders/?id=${q.data.source.id}`} className="t-data underline underline-offset-4 hover:text-yellow">{q.data.source.ref}</Link> }] : []),
          ...(quote.customer_notes ? [{ label: "Your notes", value: <span className="whitespace-pre-wrap">{quote.customer_notes}</span> }] : []),
        ]} />
      </Block>

      <MessagesThread entity="quote" entityId={quote.id} refLabel={quote.ref} />

      {wa && (
        <p className="text-fog-400">
          Prefer to talk? <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { ref: quote.ref, step: "quote_followup" })} className="text-fog-50 underline underline-offset-4 hover:text-yellow">Follow up on WhatsApp</a> — the message already carries your quote reference.
        </p>
      )}

      <Dialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} title={confirm === "accept" ? "Accept this quotation?" : "Decline this quotation?"}
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Not yet</Button>{confirm === "accept" ? <Button loading={busy} onClick={() => void respond(true)}>Yes, accept</Button> : <Button variant="danger" loading={busy} onClick={() => void respond(false)}>Yes, decline</Button>}</>}>
        <div className="flex flex-col gap-4">
          <p className="text-fog-300"><span className="t-data text-gold">{quote.ref}</span> · <span className="t-data text-gold">{formatLak(quote.total_lak)}</span>{quote.valid_until ? ` · valid until ${formatDate(quote.valid_until)}` : ""}</p>
          {confirm === "accept"
            ? <p className="text-fog-400">Accepting tells SPP to go ahead on these terms. SPP then confirms the order and checks your artwork before anything is produced. No payment is taken on this site.</p>
            : <p className="text-fog-400">Declining closes this quotation. If the price, quantity or timing is the problem, message SPP instead — we can usually revise it.</p>}
          <FormError message={error} />
        </div>
      </Dialog>
    </>
  );
}

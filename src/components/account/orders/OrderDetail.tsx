"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorNote, Meta, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { track } from "@/lib/backend/analytics";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate, formatLak, titleCase } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";
import { LineItems } from "../LineItems";
import { MessagesThread } from "../MessagesThread";
import { usePortal } from "../PortalShell";
import { Block, PortalHeader, RowsSkeleton, Stepper } from "../ui";
import { ReorderDialog } from "./ReorderDialog";
import { canReorder, DELIVERY_COLS, ORDER_COLS, ORDER_ITEM_COLS, ORDER_STAGE_NOTE, ORDER_STEPS, PAYMENT_LABEL, type Delivery, type OrderItem, type OrderLite } from "./shared";

type Loaded = { order: OrderLite | null; items: OrderItem[]; deliveries: Delivery[]; quote: { id: string; ref: string } | null; source: { id: string; ref: string } | null };

const DELIVERY_NOTE: Record<Delivery["status"], string> = {
  pending: "Not scheduled yet. SPP will agree a time with you.",
  scheduled: "Scheduled.",
  in_transit: "On its way.",
  delivered: "Delivered.",
  installed: "Installed.",
  failed: "The last attempt did not succeed. SPP will contact you to rearrange.",
};

export function OrderDetail({ id, openReorder }: { id: string; openReorder: boolean }) {
  const { uid, contact } = usePortal();
  const q = useQuery<Loaded>(async () => {
    const b = requireBackend();
    const [order, items, deliveries] = await Promise.all([
      b.from("orders").select(ORDER_COLS).eq("id", id).eq("customer_id", uid).maybeSingle(),
      b.from("order_items").select(ORDER_ITEM_COLS).eq("order_id", id).order("sort"),
      b.from("deliveries").select(DELIVERY_COLS).eq("order_id", id).order("created_at"),
    ]);
    const err = order.error ?? items.error;
    if (err) return { data: null, error: err };
    const o = order.data as OrderLite | null;
    const [quote, source] = await Promise.all([
      o?.quote_id ? b.from("quotes").select("id,ref").eq("id", o.quote_id).maybeSingle() : null,
      o?.reorder_of ? b.from("orders").select("id,ref").eq("id", o.reorder_of).maybeSingle() : null,
    ]);
    return { data: { order: o, items: (items.data ?? []) as OrderItem[], deliveries: (deliveries.data ?? []) as Delivery[], quote: quote?.data ?? null, source: source?.data ?? null }, error: null };
  }, [id, uid]);
  const [reorder, setReorder] = useState(false);

  const order = q.data?.order;
  const reorderable = Boolean(order && canReorder(order.status) && q.data?.items.length);
  // Arriving from "Reorder last order": open the dialog once the order has loaded and qualifies.
  useEffect(() => { if (openReorder && reorderable) setReorder(true); }, [openReorder, reorderable]);

  const back = { href: "/account/orders/", label: "All orders" };
  if (q.loading && !q.data) return <><PortalHeader title="Order" back={back} /><RowsSkeleton rows={4} tall /></>;
  if (q.error) return <><PortalHeader title="Order" back={back} /><ErrorNote message={q.error} onRetry={q.reload} /></>;
  if (!order || !q.data) return <><PortalHeader title="Order not found" back={back} /><EmptyState title="We could not find that order." body="It may belong to a different account, or the link may be incomplete." action={<Button href="/account/orders/" variant="outline">All orders</Button>} /></>;

  const cancelled = order.status === "cancelled";
  const wa = whatsappHref(contact.whatsapp, { kind: "order", orderRef: order.ref });

  return (
    <>
      <PortalHeader title={order.ref} back={back}
        sub={<span className="flex flex-wrap items-center gap-3"><StatusPill status={order.status} /><StatusPill status={order.payment_status} /><span>Placed {formatDate(order.created_at)}</span></span>}
        actions={reorderable ? <Button arrow onClick={() => setReorder(true)}>Reorder</Button> : undefined} />

      <section aria-label="Order progress" className="mb-10 border border-ink-700 bg-ink-900 p-5">
        <Stepper steps={ORDER_STEPS} current={order.status} label={`Order ${order.ref}`} halted={cancelled ? "cancelled" : undefined} />
        <p className="mt-4 text-fog-100" aria-live="polite">{ORDER_STAGE_NOTE[order.status]}</p>
        {!reorderable && !cancelled && <p className="mt-2 text-sm text-fog-500">Reorder becomes available once this order is ready, out for delivery or completed.</p>}
      </section>

      <Block title={`Items · ${q.data.items.length}`}>
        {q.data.items.length ? <LineItems lines={q.data.items} showPrices /> : <p className="text-fog-400">No line items are recorded on this order.</p>}
      </Block>

      <div className="grid gap-x-12 lg:grid-cols-2">
        <Block title="Order summary">
          <Meta items={[
            { label: "Total", value: <span className="t-data text-lg text-fog-50">{formatLak(order.total_lak)}</span> },
            { label: "Payment", value: PAYMENT_LABEL[order.payment_status] },
            { label: "Due", value: order.due_on ? formatDate(order.due_on) : "To be agreed" },
            ...(order.completed_at ? [{ label: "Completed", value: formatDate(order.completed_at) }] : []),
            ...(q.data.quote ? [{ label: "From quote", value: <Link href={`/account/quotes/?id=${q.data.quote.id}`} className="t-data underline underline-offset-4 hover:text-yellow">{q.data.quote.ref}</Link> }] : []),
            ...(q.data.source ? [{ label: "Reorder of", value: <Link href={`/account/orders/?id=${q.data.source.id}`} className="t-data underline underline-offset-4 hover:text-yellow">{q.data.source.ref}</Link> }] : []),
          ]} />
          <p className="mt-4 text-sm text-fog-500">Payments are arranged directly with SPP; none are taken on this site.</p>
        </Block>

        <Block title={order.delivery_method === "pickup" ? "Collection" : titleCase(order.delivery_method)}>
          {q.data.deliveries.length === 0 ? (
            <Meta items={[{ label: "Method", value: titleCase(order.delivery_method) }, ...(order.delivery_address ? [{ label: "Address", value: <span className="whitespace-pre-wrap">{order.delivery_address}</span> }] : []), { label: "Status", value: "Arranged once the order is ready." }]} />
          ) : (
            <ul className="flex flex-col gap-5">
              {q.data.deliveries.map((d) => (
                <li key={d.id}>
                  <Meta items={[
                    { label: "Status", value: <span className="flex flex-wrap items-center gap-2"><StatusPill status={d.status} /><span className="text-fog-400">{DELIVERY_NOTE[d.status]}</span></span> },
                    { label: "Method", value: titleCase(d.method) },
                    ...(d.scheduled_for ? [{ label: "Scheduled", value: formatDate(d.scheduled_for) }] : []),
                    ...(d.address ? [{ label: "Address", value: <span className="whitespace-pre-wrap">{d.address}</span> }] : []),
                    ...(d.carrier ? [{ label: "Carrier", value: d.carrier }] : []),
                    ...(d.tracking ? [{ label: "Tracking", value: <span className="t-data break-all">{d.tracking}</span> }] : []),
                    ...(d.completed_at ? [{ label: "Completed", value: formatDate(d.completed_at) }] : []),
                  ]} />
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      <MessagesThread entity="order" entityId={order.id} refLabel={order.ref} />

      {wa && <p className="text-fog-400">Need a quick answer? <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { ref: order.ref, step: "order_question" })} className="text-fog-50 underline underline-offset-4 hover:text-yellow">Ask about this order on WhatsApp</a>.</p>}

      {reorderable && (
        <div className="mt-12 flex flex-wrap items-center justify-between gap-5 border border-ink-600 p-6">
          <div><p className="t-heading uppercase text-fog-50">Need this again?</p><p className="mt-1 text-fog-400">Same artwork and setup — just tell us the new quantities.</p></div>
          <Button size="lg" arrow onClick={() => setReorder(true)}>Reorder</Button>
        </div>
      )}
      <ReorderDialog open={reorder} onClose={() => setReorder(false)} order={order} items={q.data.items} />
    </>
  );
}

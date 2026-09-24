"use client";
import { useSearchParams } from "next/navigation";
import { ErrorNote, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate, formatLak } from "@/lib/format";
import { usePortal } from "../PortalShell";
import { PortalEmpty, PortalHeader, RowLink, RowsSkeleton } from "../ui";
import { OrderDetail } from "./OrderDetail";
import { canReorder, ORDER_COLS, PAYMENT_LABEL, type OrderLite } from "./shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function OrdersPage() {
  const params = useSearchParams();
  const id = params.get("id");
  return id && UUID.test(id) ? <OrderDetail key={id} id={id} openReorder={params.get("reorder") === "1"} /> : <OrderList />;
}

function OrderList() {
  const { uid } = usePortal();
  const q = useQuery<OrderLite[]>(() => requireBackend().from("orders").select(ORDER_COLS).eq("customer_id", uid).order("created_at", { ascending: false }).limit(200), [uid]);
  return (
    <>
      <PortalHeader title="My Orders" sub="Follow each order from approval to delivery, and reorder a finished job with new quantities in a minute." />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <RowsSkeleton rows={5} /> : q.data?.length === 0 ? (
        <PortalEmpty title="No orders yet." body="An order starts when you accept a written quotation from SPP. Once it exists, every stage — artwork review, production, quality control, delivery — shows here." action={<div className="flex flex-wrap gap-3"><Button href="/account/quotes/" arrow>My quotes</Button><Button href="/request-quote/" variant="outline">Request a quote</Button></div>} />
      ) : (
        <ul className="border-t border-gold/25">
          {q.data?.map((o) => (
            <li key={o.id}>
              <RowLink href={`/account/orders/?id=${o.id}`}>
                <span className="min-w-0 flex-1">
                  <span className="t-data block truncate text-gold">{o.ref}</span>
                  <span className="block truncate text-sm text-fog-400">Placed {formatDate(o.created_at)}{o.due_on ? ` · due ${formatDate(o.due_on)}` : ""} · {PAYMENT_LABEL[o.payment_status]}</span>
                </span>
                {canReorder(o.status) && <span className="t-label hidden text-[0.625rem] text-gold md:block">Reorder available</span>}
                <span className="t-data hidden text-fog-50 sm:block">{formatLak(o.total_lak)}</span>
                <StatusPill status={o.status} />
              </RowLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

"use client";
import { useSearchParams } from "next/navigation";
import { loadCompany, type Company } from "@/lib/admin/export/company";
import { orderDocument } from "@/lib/admin/export/documents";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { OrderItemsRow, OrdersRow } from "@/lib/backend/db-types";
import { db } from "../ops/data";
import { designRefs, orderSheets } from "../ops/exports";
import { NoAccess, SkeletonRows } from "../ops/parts";
import { PrintDocument } from "../ops/PrintDocument";
import { ErrorNote } from "../ui";

type Bundle = { order: OrdersRow; items: OrderItemsRow[]; company: Company; refs: Record<string, string>; quoteRef: string | null };

/** /admin/orders/print/?id=… — order confirmation as a paper document. */
export function OrderPrint() {
  const id = useSearchParams().get("id");
  const { profile } = useAuth();
  const canRead = canDo(profile?.role, "sales");
  const q = useQuery<Bundle | null>(async () => {
    const b = db();
    const [order, items, company] = await Promise.all([b.from("orders").select("*").eq("id", id ?? "").maybeSingle(), b.from("order_items").select("*").eq("order_id", id ?? "").order("sort"), loadCompany()]);
    if (order.error) return { data: null, error: order.error };
    if (!order.data) return { data: null, error: null };
    const o = order.data as OrdersRow, rows = (items.data ?? []) as OrderItemsRow[];
    const [refs, quote] = await Promise.all([designRefs(rows), o.quote_id ? b.from("quotes").select("ref").eq("id", o.quote_id).maybeSingle() : null]);
    return { data: { order: o, items: rows, company, refs, quoteRef: (quote?.data as { ref: string } | null)?.ref ?? null }, error: null };
  }, [id], { enabled: Boolean(id) && canRead });
  if (!canRead) return <NoAccess what="orders" />;
  if (!id) return <p className="text-sm text-fog-400">No order selected. Open an order and choose PDF.</p>;
  if (q.loading && !q.data) return <SkeletonRows n={8} />;
  if (q.error) return <ErrorNote message={q.error} onRetry={() => void q.reload()} />;
  if (!q.data) return <p className="text-sm text-fog-400">This order could not be found, or your role cannot view it.</p>;
  const { order, items, company, refs, quoteRef } = q.data;
  return <PrintDocument kind="Order" sheet={orderDocument(order, items, company, refs, quoteRef)} company={company} backHref={`/admin/orders/?id=${order.id}`} exportName={order.ref} exportBuild={() => orderSheets(order, items, quoteRef)} />;
}

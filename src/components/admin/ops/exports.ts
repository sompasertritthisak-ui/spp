"use client";
import { loadCompany } from "@/lib/admin/export/company";
import { orderDocument, ordersList, quoteDocument, quotesList, type DesignRefs } from "@/lib/admin/export/documents";
import type { Sheet } from "@/lib/admin/export/sheet";
import type { OrderItemsRow, OrdersRow, QuoteItemsRow, QuotesRow } from "@/lib/backend/db-types";
import { db } from "./data";

/** design_id → "SPP-DESIGN-…" so exported lines read like the rest of the paperwork. */
export async function designRefs(items: { design_id: string | null }[]): Promise<DesignRefs> {
  const ids = [...new Set(items.flatMap((i) => (i.design_id ? [i.design_id] : [])))];
  if (!ids.length) return {};
  const { data } = await db().from("designs").select("id,ref").in("id", ids);
  return Object.fromEntries(((data ?? []) as { id: string; ref: string }[]).map((d) => [d.id, d.ref]));
}

export async function quoteSheets(q: QuotesRow, items: QuoteItemsRow[]): Promise<Sheet[]> {
  const [co, refs] = await Promise.all([loadCompany(), designRefs(items)]);
  return [quoteDocument(q, items, co, refs)];
}
export async function orderSheets(o: OrdersRow, items: OrderItemsRow[], quoteRef: string | null): Promise<Sheet[]> {
  const [co, refs] = await Promise.all([loadCompany(), designRefs(items)]);
  return [orderDocument(o, items, co, refs, quoteRef)];
}
export const quotesListSheets = async (rows: QuotesRow[]): Promise<Sheet[]> => [quotesList(rows)];
export const ordersListSheets = async (rows: OrdersRow[]): Promise<Sheet[]> => [ordersList(rows)];

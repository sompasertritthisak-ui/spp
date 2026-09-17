import type { ProductionJobsRow, ProductionStatus } from "@/lib/backend/db-types";
import { asContact, db } from "../ops/data";

export type Job = ProductionJobsRow;
export const JOB_COLUMNS: readonly { key: ProductionStatus; label: string }[] = [{ key: "queued", label: "Queued" }, { key: "in_progress", label: "In progress" }, { key: "blocked", label: "Blocked" }, { key: "qc", label: "QC" }, { key: "done", label: "Done" }];
export const QC_ITEMS = [
  { key: "quantity", label: "Quantity" }, { key: "colour", label: "Colour" }, { key: "artwork", label: "Artwork" }, { key: "dimensions", label: "Dimensions" },
  { key: "placement", label: "Print placement" }, { key: "physical", label: "Physical quality" }, { key: "packaging", label: "Packaging" }, { key: "requirements", label: "Customer requirements" },
] as const;
export type QcLine = { key: string; label: string; ok: boolean | null; note: string };

/** What production needs to know about the order — and nothing about money. */
export type OrderCtx = { id: string; ref: string; status: string; due_on: string | null; delivery_method: string; delivery_address: string; contact_name: string | null; contact_company: string | null };

/** Production/designer roles cannot read `orders`; they use the money-free view. Sales (no view access) read the table. */
export async function loadOrderCtx(ids: string[], viaView: boolean): Promise<Record<string, OrderCtx>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return {};
  if (viaView) {
    const { data } = await db().from("production_orders").select("id,ref,status,due_on,delivery_method,delivery_address,contact_name,contact_company").in("id", uniq);
    return Object.fromEntries(((data ?? []) as OrderCtx[]).map((o) => [o.id, o]));
  }
  const { data } = await db().from("orders").select("id,ref,status,due_on,delivery_method,delivery_address,contact").in("id", uniq);
  return Object.fromEntries(((data ?? []) as (Omit<OrderCtx, "contact_name" | "contact_company"> & { contact: unknown })[]).map((o) => { const c = asContact(o.contact); return [o.id, { ...o, contact_name: c.name ?? null, contact_company: c.company ?? null }]; }));
}

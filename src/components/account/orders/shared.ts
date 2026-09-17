import type { DeliveriesRow, OrderItemsRow, OrdersRow, OrderStatus, PaymentStatus } from "@/lib/backend/db-types";

/** What the customer sees. Production jobs and QC detail are internal; only the order's own status is shown. */
export const ORDER_STEPS = [
  { key: "quote", label: "Quote" },
  { key: "approved", label: "Approved" },
  { key: "artwork_review", label: "Artwork review" },
  { key: "production", label: "Production" },
  { key: "quality_control", label: "Quality control" },
  { key: "ready", label: "Ready" },
  { key: "delivery", label: "Delivery" },
  { key: "completed", label: "Completed" },
] as const satisfies readonly { key: OrderStatus; label: string }[];

export const ORDER_STAGE_NOTE: Record<OrderStatus, string> = {
  quote: "Your order is being prepared from the accepted quote.",
  approved: "Order confirmed. Next, SPP checks the artwork on every line.",
  artwork_review: "SPP is reviewing your artwork for print. We will message you here if anything needs changing.",
  production: "In production.",
  quality_control: "Production is finished and the order is being checked before release.",
  ready: "Ready. SPP will arrange collection or delivery with you.",
  delivery: "On its way, or being installed.",
  completed: "Completed. You can reorder this job at any time.",
  cancelled: "This order was cancelled.",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = { unpaid: "Payment due", deposit: "Deposit received", paid: "Paid in full", refunded: "Refunded" };

/** Mirrors request_reorder(): the server re-checks. */
export const canReorder = (s: OrderStatus) => s === "completed" || s === "delivery" || s === "ready";
export const inProgress = (s: OrderStatus) => s !== "completed" && s !== "cancelled";

export const ORDER_COLS = "id,ref,status,payment_status,total_lak,due_on,delivery_method,delivery_address,completed_at,reorder_of,quote_id,created_at";
export type OrderLite = Pick<OrdersRow, "id" | "ref" | "status" | "payment_status" | "total_lak" | "due_on" | "delivery_method" | "delivery_address" | "completed_at" | "reorder_of" | "quote_id" | "created_at">;
export const ORDER_ITEM_COLS = "id,order_id,product_slug,product_name,design_id,design_version,qty,config,unit_price_lak,line_total_lak,sort";
export type OrderItem = Pick<OrderItemsRow, "id" | "order_id" | "product_slug" | "product_name" | "design_id" | "design_version" | "qty" | "config" | "unit_price_lak" | "line_total_lak" | "sort">;
export const DELIVERY_COLS = "id,method,status,scheduled_for,address,carrier,tracking,completed_at";
export type Delivery = Pick<DeliveriesRow, "id" | "method" | "status" | "scheduled_for" | "address" | "carrier" | "tracking" | "completed_at">;

/** Human summary of a line's saved configuration (colour, sizes, method…). Unknown keys are ignored. */
export function configSummary(config: unknown): string {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  const c = config as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of ["colour", "material", "method", "finishing", "size"]) {
    const v = c[k];
    if (typeof v === "string" && v) parts.push(v);
    else if (v && typeof v === "object" && "name" in v && typeof (v as { name: unknown }).name === "string") parts.push((v as { name: string }).name);
  }
  if (c.sizes && typeof c.sizes === "object" && !Array.isArray(c.sizes)) {
    const sizes = Object.entries(c.sizes as Record<string, unknown>).filter(([, n]) => typeof n === "number" && n > 0).map(([s, n]) => `${s}×${n as number}`);
    if (sizes.length) parts.push(sizes.join(" "));
  }
  if (Array.isArray(c.locations) && c.locations.length) parts.push(`${c.locations.filter((l) => typeof l === "string").join(" + ")} print`);
  return parts.join(" · ");
}

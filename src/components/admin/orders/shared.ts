import type { OrderStatus, OrdersRow, PaymentStatus } from "@/lib/backend/db-types";

export type Order = OrdersRow;
export const ORDER_STEPS: readonly Exclude<OrderStatus, "cancelled">[] = ["quote", "approved", "artwork_review", "production", "quality_control", "ready", "delivery", "completed"];
export const PAYMENTS: readonly PaymentStatus[] = ["unpaid", "deposit", "paid", "refunded"];
export const METHODS = ["pickup", "delivery", "installation"] as const;
export const isActive = (o: Pick<Order, "status">) => o.status !== "completed" && o.status !== "cancelled";

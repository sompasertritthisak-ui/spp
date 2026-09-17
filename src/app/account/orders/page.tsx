import type { Metadata } from "next";
import { Suspense } from "react";
import { RowsSkeleton } from "@/components/account/ui";
import { OrdersPage } from "@/components/account/orders/OrdersPage";

export const metadata: Metadata = { title: "My Orders", robots: { index: false, follow: false } };

export default function Page() {
  return <Suspense fallback={<RowsSkeleton />}><OrdersPage /></Suspense>;
}

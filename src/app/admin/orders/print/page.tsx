"use client";
import { Suspense } from "react";
import { OrderPrint } from "@/components/admin/orders/OrderPrint";

export default function OrderPrintPage() {
  return <Suspense fallback={<div className="skeleton h-96 w-full" />}><OrderPrint /></Suspense>;
}

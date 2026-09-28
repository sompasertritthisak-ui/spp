"use client";
import { Suspense } from "react";
import { QuotePrint } from "@/components/admin/quotes/QuotePrint";

export default function QuotePrintPage() {
  return <Suspense fallback={<div className="skeleton h-96 w-full" />}><QuotePrint /></Suspense>;
}

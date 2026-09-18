"use client";
import { Suspense } from "react";
import { PricingScreen } from "@/components/admin/pricing/PricingScreen";
import { PageSkeleton } from "@/components/admin/resource/PageSkeleton";

export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><PricingScreen /></Suspense>;
}

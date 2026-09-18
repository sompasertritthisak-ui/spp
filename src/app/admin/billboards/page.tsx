"use client";
import { Suspense } from "react";
import { BillboardsScreen } from "@/components/admin/billboards/BillboardsScreen";
import { PageSkeleton } from "@/components/admin/resource/PageSkeleton";

export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><BillboardsScreen /></Suspense>;
}

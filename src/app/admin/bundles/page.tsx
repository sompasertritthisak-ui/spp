"use client";
import { Suspense } from "react";
import { BundlesScreen } from "@/components/admin/bundles/BundlesScreen";
import { PageSkeleton } from "@/components/admin/resource/PageSkeleton";

export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><BundlesScreen /></Suspense>;
}

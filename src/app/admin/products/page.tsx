"use client";
import { Suspense } from "react";
import { ProductsScreen } from "@/components/admin/products/ProductsScreen";
import { PageSkeleton } from "@/components/admin/resource/PageSkeleton";

export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><ProductsScreen /></Suspense>;
}

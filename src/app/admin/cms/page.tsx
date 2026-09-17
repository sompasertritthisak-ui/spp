"use client";
import { Suspense } from "react";
import { CmsHub } from "@/components/admin/cms/CmsHub";
import { PageSkeleton } from "@/components/admin/resource/PageSkeleton";

export default function CmsPage() {
  return <Suspense fallback={<PageSkeleton />}><CmsHub /></Suspense>;
}

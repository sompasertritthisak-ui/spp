"use client";
import { Suspense } from "react";
import { HomeEditor } from "@/components/admin/cms/home/HomeEditor";
import { PageSkeleton } from "@/components/admin/resource/PageSkeleton";

export default function CmsHomePage() {
  return <Suspense fallback={<PageSkeleton />}><HomeEditor /></Suspense>;
}

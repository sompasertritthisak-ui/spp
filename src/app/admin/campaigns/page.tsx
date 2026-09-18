"use client";
import { Suspense } from "react";
import { CampaignsScreen } from "@/components/admin/campaigns/CampaignsScreen";
import { PageSkeleton } from "@/components/admin/resource/PageSkeleton";

export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><CampaignsScreen /></Suspense>;
}

"use client";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/resource/PageSkeleton";
import { SettingsScreen } from "@/components/admin/settings/SettingsScreen";

export default function SettingsPage() {
  return <Suspense fallback={<PageSkeleton />}><SettingsScreen /></Suspense>;
}

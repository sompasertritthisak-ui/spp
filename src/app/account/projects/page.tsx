import type { Metadata } from "next";
import { Suspense } from "react";
import { RowsSkeleton } from "@/components/account/ui";
import { ProjectsPage } from "@/components/account/projects/ProjectsPage";

export const metadata: Metadata = { title: "My Projects", robots: { index: false, follow: false } };

export default function Page() {
  return <Suspense fallback={<RowsSkeleton />}><ProjectsPage /></Suspense>;
}

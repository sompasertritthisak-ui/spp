import type { Metadata } from "next";
import { Suspense } from "react";
import { RowsSkeleton } from "@/components/account/ui";
import { QuotesPage } from "@/components/account/quotes/QuotesPage";

export const metadata: Metadata = { title: "My Quotes", robots: { index: false, follow: false } };

export default function Page() {
  return <Suspense fallback={<RowsSkeleton />}><QuotesPage /></Suspense>;
}

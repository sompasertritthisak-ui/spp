import type { Metadata } from "next";
import { BillboardsPage } from "@/components/account/BillboardsPage";

export const metadata: Metadata = { title: "My Billboards", robots: { index: false, follow: false } };

export default function Page() {
  return <BillboardsPage />;
}

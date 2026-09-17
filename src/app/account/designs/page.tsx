import type { Metadata } from "next";
import { DesignsPage } from "@/components/account/designs/DesignsPage";

export const metadata: Metadata = { title: "My Designs", robots: { index: false, follow: false } };

export default function Page() {
  return <DesignsPage />;
}

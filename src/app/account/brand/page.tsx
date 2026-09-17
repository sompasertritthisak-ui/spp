import type { Metadata } from "next";
import { BrandPage } from "@/components/account/brand/BrandPage";

export const metadata: Metadata = { title: "My Brand", robots: { index: false, follow: false } };

export default function Page() {
  return <BrandPage />;
}

import type { Metadata } from "next";
import { Overview } from "@/components/account/Overview";

export const metadata: Metadata = { title: "Overview", robots: { index: false, follow: false } };

export default function Page() {
  return <Overview />;
}

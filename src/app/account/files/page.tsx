import type { Metadata } from "next";
import { FilesPage } from "@/components/account/FilesPage";

export const metadata: Metadata = { title: "My Files", robots: { index: false, follow: false } };

export default function Page() {
  return <FilesPage />;
}

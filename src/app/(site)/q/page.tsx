import type { Metadata } from "next";
import { QrRedirect } from "@/components/catalogue/QrRedirect";

export const metadata: Metadata = { title: "Opening…", robots: { index: false, follow: false } };

export default function QrPage() {
  return <QrRedirect />;
}

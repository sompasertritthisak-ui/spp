import type { Metadata } from "next";
import { ProfilePage } from "@/components/account/ProfilePage";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };

export default function Page() {
  return <ProfilePage />;
}

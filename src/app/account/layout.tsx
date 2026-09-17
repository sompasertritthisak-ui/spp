import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/account/PortalShell";
import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: { default: "My SPP", template: "%s — My SPP" }, description: "Your SPP designs, quotes, orders and projects.", robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { settings, flags } = await getContent();
  return (
    <>
      <Nav />
      <main id="main" tabIndex={-1} className="flex-1 pt-[var(--nav-h)] focus:outline-none">
        {/* PortalShell is the client gate: real (non-guest) session or a redirect to /login/?next=… */}
        <PortalShell contact={{ email: settings.email, phone: settings.phone, whatsapp: settings.whatsapp }} portalEnabled={flags.CUSTOMER_PORTAL}>{children}</PortalShell>
      </main>
      <Footer settings={settings} />
    </>
  );
}

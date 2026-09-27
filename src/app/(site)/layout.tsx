import type { ReactNode } from "react";
import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { WhatsAppFab } from "@/components/site/WhatsAppFab";
import { getContent } from "@/lib/content";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { settings } = await getContent();
  return (
    <div className="theme-light flex flex-1 flex-col">
      <Nav logo={settings.logo} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      <Footer settings={settings} />
      <WhatsAppFab number={settings.whatsapp} />
    </div>
  );
}

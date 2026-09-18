import type { ReactNode } from "react";
import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { getContent } from "@/lib/content";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { settings } = await getContent();
  return (
    <>
      <Nav logo={settings.logo} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      <Footer settings={settings} />
    </>
  );
}

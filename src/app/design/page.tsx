import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Studio } from "@/components/studio/Studio";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "SPP Studio — Design", description: "Design your own custom apparel mockup, front and back.", robots: { index: false, follow: true } };

export default async function DesignPage() {
  const { products, templates, flags, settings } = await getContent();
  const studioProducts = products.filter((p) => p.studio);
  if (!flags.MOCKUP_STUDIO || studioProducts.length === 0)
    return (
      <main id="main" className="grain flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <Logo className="h-8" />
        <h1 className="t-title text-fog-50">SPP Studio is taking a short break.</h1>
        <p className="max-w-md text-fog-300">Online design is switched off at the moment. Tell us what you need and our designers will mock it up for you.</p>
        <div className="flex flex-wrap justify-center gap-3"><Button href="/request-quote/" arrow>Request a quote</Button><Button href="/" variant="outline">Back to SPP</Button></div>
      </main>
    );
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center"><Logo animate className="h-8" /></div>}>
      <Studio products={studioProducts} templates={templates} flags={flags} whatsapp={settings.whatsapp} />
    </Suspense>
  );
}

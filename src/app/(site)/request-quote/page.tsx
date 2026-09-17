import type { Metadata } from "next";
import { toLite } from "@/components/catalogue/lite";
import { ClientOnly, FormSkeleton } from "@/components/forms/ClientOnly";
import { QuoteBuilder } from "@/components/quote/QuoteBuilder";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

const description = "Build a quote request for custom apparel, print, signage or a full campaign. Add products, quantities, colours and your deadline — SPP replies with a written quotation.";

export const metadata: Metadata = {
  title: "Request a Quote",
  description,
  alternates: { canonical: absoluteUrl("/request-quote/") },
  openGraph: { title: "Request a quote from SPP", description, url: absoluteUrl("/request-quote/") },
};

export default async function RequestQuotePage() {
  const { products, categories, bundles, services, settings, flags } = await getContent();
  return (
    <>
      <PageHero
        plate="Q"
        eyebrow="Smart quote builder"
        title={<>Tell us once. <span className="t-feel text-yellow">We quote it.</span></>}
        lede="Add what you need, set what you know, and send. If you came from a product, a bundle or SPP Studio, it is already here."
      />
      <section className="bg-ink-950 py-16 lg:py-24">
        <div className="shell">
          <ClientOnly fallback={<div className="max-w-3xl"><FormSkeleton rows={6} /></div>}>
            <QuoteBuilder
              products={[...products].sort((a, b) => a.order - b.order).map(toLite)}
              categories={categories}
              bundles={bundles.map(({ slug, name, summary, discountPct, items }) => ({ slug, name, summary, discountPct, items }))}
              services={services.map(({ slug, name, products: ps }) => ({ slug, name, products: ps }))}
              onlinePricing={flags.ONLINE_PRICING}
              portal={flags.CUSTOMER_PORTAL}
              email={settings.email}
              whatsapp={settings.whatsapp}
            />
          </ClientOnly>
          <noscript><p className="mt-8 max-w-xl text-fog-300">The quote builder needs JavaScript. You can also email your request to {settings.email}.</p></noscript>
        </div>
      </section>
      <CtaBand title="Rather talk it through first?" body="Book a short consultation and we will shape the brief together." primary={{ href: "/consultation/", label: "Let's talk" }} secondary={{ href: "/solutions/?build=1", label: "Build my project" }} />
    </>
  );
}

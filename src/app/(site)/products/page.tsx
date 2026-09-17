import type { Metadata } from "next";
import { Catalogue } from "@/components/catalogue/Catalogue";
import { toLite } from "@/components/catalogue/lite";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

const description = "Browse everything SPP makes in Laos — custom T-shirts and uniforms, caps and bags, promotional products, print, display, signage, billboards and vehicle branding — with minimum quantities, lead times and price guidance.";

export const metadata: Metadata = {
  title: "Products — Custom Apparel, Print, Signage & Outdoor",
  description,
  alternates: { canonical: absoluteUrl("/products/") },
  openGraph: { title: "The SPP catalogue", description, url: absoluteUrl("/products/") },
};

export default async function ProductsPage() {
  const { categories, products, flags } = await getContent();
  const sorted = [...products].sort((a, b) => a.order - b.order);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: "SPP product catalogue",
    itemListElement: sorted.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: absoluteUrl(`/products/${p.slug}/`) })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero
        plate="01"
        eyebrow="The catalogue"
        title={<>Everything we make, <span className="t-feel text-yellow">indexed</span>.</>}
        lede="Filter by what it is, how it is printed, or whether you can design it online. Every entry shows its minimum order, lead time and how it is priced."
        actions={<><Button href="/request-quote/" arrow>Request a quote</Button><Button href="/solutions/" variant="outline">Start from a goal</Button></>}
      />
      <section className="bg-ink-950 py-16 lg:py-24">
        <div className="shell">
          <Catalogue categories={[...categories].sort((a, b) => a.order - b.order)} products={sorted.map(toLite)} onlinePricing={flags.ONLINE_PRICING} studioOn={flags.MOCKUP_STUDIO} />
        </div>
      </section>
      <CtaBand title="Can't see it? We probably make it." body="The catalogue is the start of the list, not the end. Tell us what you need." primary={{ href: "/request-quote/", label: "Request a quote" }} secondary={{ href: "/consultation/", label: "Let's talk" }} />
    </>
  );
}

import type { Metadata } from "next";
import { toLite } from "@/components/catalogue/lite";
import { SolutionsHub } from "@/components/quote/SolutionsHub";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

const description = "Start from what you want to achieve — open a restaurant, launch a business, outfit a team, promote an event — and SPP recommends the apparel, print, display and outdoor advertising that gets you there.";

export const metadata: Metadata = {
  title: "Solutions — Start From Your Goal",
  description,
  alternates: { canonical: absoluteUrl("/solutions/") },
  openGraph: { title: "What are you trying to achieve?", description, url: absoluteUrl("/solutions/") },
};

export default async function SolutionsPage() {
  const { solutions, products, categories, bundles, services } = await getContent();
  return (
    <>
      <PageHero
        plate="S"
        eyebrow="Solutions"
        title={<>What are you trying to <span className="t-feel text-yellow">achieve</span>?</>}
        lede="You do not need to know what to order. Tell us the goal and we will show you the pieces that usually make it happen — then build it into one project, one quote."
        actions={<><Button href="/solutions/?build=1#builder" arrow>Build my project</Button><Button href="#bundles" variant="outline">See bundles</Button></>}
      />
      <SolutionsHub
        solutions={[...solutions].sort((a, b) => a.order - b.order)}
        products={[...products].sort((a, b) => a.order - b.order).map(toLite)}
        categories={[...categories].sort((a, b) => a.order - b.order)}
        bundles={bundles.map(({ slug, name, summary, discountPct, items }) => ({ slug, name, summary, discountPct, items }))}
        services={services.map(({ slug, name, products: ps }) => ({ slug, name, products: ps }))}
      />
      <CtaBand title="Prefer to think out loud?" body="Fifteen minutes with someone who makes these things every day." primary={{ href: "/consultation/", label: "Let's talk" }} secondary={{ href: "/request-quote/", label: "Request a quote" }} />
    </>
  );
}

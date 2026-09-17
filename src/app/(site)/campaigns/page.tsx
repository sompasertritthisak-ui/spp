import type { Metadata } from "next";
import { CampaignLanding } from "@/components/catalogue/CampaignLanding";
import { toLite } from "@/components/catalogue/lite";
import { CtaBand } from "@/components/site/CtaBand";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

/* Campaign pages are created by marketing without a rebuild, so they are
   addressed by query (/campaigns/?c=<slug>) and fetched in the browser. One
   static shell cannot describe them all, so it stays out of the index. */
export const metadata: Metadata = {
  title: "Campaigns",
  description: "Current SPP campaigns and offers on custom apparel, printing, signage and outdoor advertising in Laos.",
  alternates: { canonical: absoluteUrl("/campaigns/") },
  robots: { index: false, follow: true },
};

export default async function CampaignsPage() {
  const { products, flags } = await getContent();
  return (
    <>
      <CampaignLanding products={products.map(toLite)} onlinePricing={flags.ONLINE_PRICING} />
      <CtaBand title="Make it yours." body="Every campaign item can be customised, bundled and quoted for your quantities." primary={{ href: "/request-quote/", label: "Request a quote" }} secondary={{ href: "/solutions/", label: "Start from a goal" }} />
    </>
  );
}

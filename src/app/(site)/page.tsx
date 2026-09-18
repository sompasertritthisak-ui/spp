import { Hero } from "@/components/hero/Hero";
import { CapabilityIndex } from "@/components/home/CapabilityIndex";
import { FivePlates } from "@/components/home/FivePlates";
import { GoalTeaser } from "@/components/home/GoalTeaser";
import { HomeFaq } from "@/components/home/HomeFaq";
import { Manifesto } from "@/components/home/Manifesto";
import { OutdoorTeaser } from "@/components/home/OutdoorTeaser";
import { SelectedWork } from "@/components/home/SelectedWork";
import { pageMeta } from "@/components/home/seo";
import { StudioTeaser } from "@/components/home/StudioTeaser";
import { Testimonials } from "@/components/home/Testimonials";
import { ConnectBand } from "@/components/site/ConnectBand";
import { CtaBand } from "@/components/site/CtaBand";
import { getContent } from "@/lib/content";

export async function generateMetadata() {
  const { settings } = await getContent();
  return pageMeta({ title: settings.seo.defaultTitle, description: settings.seo.defaultDescription, path: "/", absoluteTitle: true });
}

export default async function Home() {
  const c = await getContent();
  return (
    <>
      <Hero />
      <Manifesto />
      <FivePlates />
      <GoalTeaser solutions={c.solutions} />
      <StudioTeaser templates={c.templates} />
      <OutdoorTeaser billboards={c.billboards} />
      <CapabilityIndex categories={c.categories} products={c.products} />
      <SelectedWork projects={c.portfolio} />
      <Testimonials items={c.testimonials} />
      <HomeFaq faqs={c.faqs} />
      <ConnectBand settings={c.settings} />
      <CtaBand
        title={<>Have an idea? Let&rsquo;s make it real.</>}
        body="Tell us what you are trying to achieve. A person at SPP reads every request and replies with a plan and a written quote."
        primary={{ href: "/request-quote/", label: "Start a project" }}
        secondary={{ href: "/consultation/", label: "Let's talk" }}
      />
    </>
  );
}

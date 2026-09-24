import { SampleBadge } from "@/components/home/CoverArt";
import { pageMeta } from "@/components/home/seo";
import { WorkCard } from "@/components/home/SelectedWork";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero, Section } from "@/components/site/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import { getContent } from "@/lib/content";

export const metadata = pageMeta({
  title: "Selected Work — Case Studies in Apparel, Print & Outdoor",
  description: "How SPP plans and delivers projects across apparel, print, signage and billboards in Laos — from the brief to the result.",
  path: "/portfolio/",
});

export default async function PortfolioPage() {
  const { portfolio } = await getContent();
  const anySample = portfolio.some((p) => p.isSample);
  return (
    <>
      <PageHero
        plate="00"
        eyebrow="Portfolio"
        title={<>Selected <span className="t-feel text-yellow">work.</span></>}
        lede="Each project is told the same way: the client, the challenge, the idea, how it was made and what happened next."
        aside={<p className="t-data text-6xl font-medium leading-none tracking-[-0.05em] text-gold lg:text-8xl">{String(portfolio.length).padStart(2, "0")}<span className="t-label ml-3 align-top text-fog-400">projects</span></p>}
      />

      {anySample && (
        <div className="border-b border-ink-700 bg-ink-900">
          <div className="shell flex flex-wrap items-center gap-x-5 gap-y-3 py-5">
            <SampleBadge className="border border-ink-600" />
            <p className="max-w-3xl text-base text-fog-300">
              Projects carrying this label are illustrative, with fictional clients. They show how SPP structures and reports a job, and will be replaced by real case studies as they are published.
            </p>
          </div>
        </div>
      )}

      <Section>
        {portfolio.length === 0 ? (
          <EmptyState title="Case studies are on the press." body="We are preparing our first published projects. In the meantime, tell us about yours." />
        ) : (
          <ul className="grid gap-x-10 gap-y-20 lg:grid-cols-12">
            {portfolio.map((p, i) => (
              <Reveal as="li" key={p.slug} className={["lg:col-span-7", "lg:col-span-5 lg:mt-40", "lg:col-span-6 lg:col-start-4"][i % 3]}>
                <WorkCard project={p} index={i} headingLevel="h2" />
              </Reveal>
            ))}
          </ul>
        )}
      </Section>

      <CtaBand
        title="Your project could be the next one here."
        body="Tell us the outcome you are after. We will come back with a plan and a quote."
        primary={{ href: "/request-quote/", label: "Start a project" }}
        secondary={{ href: "/solutions/", label: "Build my project" }}
      />
    </>
  );
}

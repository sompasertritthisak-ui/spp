import Link from "next/link";
import { pageMeta } from "@/components/home/seo";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero, Section } from "@/components/site/PageHero";
import { Arrow } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import { getContent } from "@/lib/content";
import { formatDate } from "@/lib/format";

export const metadata = pageMeta({
  title: "Journal — Print, Apparel & Billboard Guides",
  description: "Plain-language guides from the SPP press room: choosing a print method, preparing artwork, and designing billboards people can read.",
  path: "/blog/",
});

export default async function JournalPage() {
  const { posts } = await getContent();
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  const [lead, ...rest] = sorted;
  return (
    <>
      <PageHero
        plate="00"
        eyebrow="Journal"
        title={<>Notes from the <span className="t-feel text-yellow">press room.</span></>}
        lede="Practical guides to getting things made well — written by the people who make them."
      />

      <Section>
        {!lead ? (
          <EmptyState title="The first issue is on the press." body="Guides on print methods, artwork and outdoor advertising are on their way." />
        ) : (
          <>
            <Reveal as="article">
              <Link href={`/blog/${lead.slug}/`} className="group/btn grid gap-x-16 gap-y-6 border-t-2 border-fog-50 pt-8 lg:grid-cols-12 lg:pt-10">
                <p className="t-label flex flex-wrap gap-x-4 gap-y-1 text-fog-400 lg:col-span-3 lg:flex-col lg:gap-y-3">
                  <span className="text-yellow">Latest</span>
                  <span>{lead.tag}</span>
                  <time dateTime={lead.date}>{formatDate(lead.date)}</time>
                  <span>{lead.readMins} min read</span>
                </p>
                <div className="lg:col-span-9">
                  <h2 className="t-display text-[clamp(2rem,4.6vw,4.5rem)] text-fog-50 transition-colors group-hover/btn:text-yellow">{lead.title}</h2>
                  <p className="mt-6 max-w-[60ch] text-xl leading-relaxed text-fog-300">{lead.excerpt}</p>
                  <span className="t-label mt-8 inline-flex min-h-11 items-center gap-3 text-fog-50">Read the guide <Arrow /></span>
                </div>
              </Link>
            </Reveal>

            {rest.length > 0 && (
              <ol className="mt-16 border-b border-ink-700 lg:mt-24">
                {rest.map((p, i) => (
                  <Reveal as="li" key={p.slug} i={i}>
                    <Link href={`/blog/${p.slug}/`} className="group/btn grid gap-x-16 gap-y-3 border-t border-ink-700 py-8 transition-colors hover:bg-ink-900 lg:grid-cols-12 lg:py-10">
                      <p className="t-label flex flex-wrap gap-x-4 gap-y-1 text-fog-400 lg:col-span-3">
                        <span className="text-fog-50">{p.tag}</span>
                        <time dateTime={p.date}>{formatDate(p.date)}</time>
                      </p>
                      <div className="lg:col-span-8">
                        <h2 className="t-title text-fog-50 transition-transform duration-300 ease-[var(--ease-press)] group-hover/btn:translate-x-1.5">{p.title}</h2>
                        <p className="mt-3 max-w-[60ch] text-lg text-fog-400">{p.excerpt}</p>
                      </div>
                      <Arrow className="hidden self-center justify-self-end text-fog-500 group-hover/btn:text-yellow lg:col-span-1 lg:block" />
                    </Link>
                  </Reveal>
                ))}
              </ol>
            )}
          </>
        )}
      </Section>

      <CtaBand
        title="Rather ask a person?"
        body="Send us your artwork or your question. We will tell you what will work — before you order."
        primary={{ href: "/request-quote/", label: "Request a quote" }}
        secondary={{ href: "/contact/", label: "Let's talk" }}
      />
    </>
  );
}

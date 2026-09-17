import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverArt, SampleBadge } from "@/components/home/CoverArt";
import { JsonLd } from "@/components/home/JsonLd";
import { pageMeta } from "@/components/home/seo";
import { CtaBand } from "@/components/site/CtaBand";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { Reveal } from "@/components/ui/Reveal";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

export const dynamicParams = false;

export async function generateStaticParams() {
  const { portfolio } = await getContent();
  return portfolio.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { portfolio } = await getContent();
  const p = portfolio.find((x) => x.slug === slug);
  if (!p) return {};
  return {
    ...pageMeta({ title: `${p.title} — ${p.isSample ? "Sample Case Study" : "Case Study"}`, description: p.summary, path: `/portfolio/${p.slug}/` }),
    // Illustrative projects are for visitors, not for search results.
    ...(p.isSample ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { portfolio } = await getContent();
  const index = portfolio.findIndex((x) => x.slug === slug);
  const p = portfolio[index];
  if (!p) notFound();
  const next = portfolio.length > 1 ? portfolio[(index + 1) % portfolio.length] : undefined;

  return (
    <article>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Selected work", item: absoluteUrl("/portfolio/") },
          { "@type": "ListItem", position: 2, name: p.title, item: absoluteUrl(`/portfolio/${p.slug}/`) },
        ],
      }} />

      <header className="grain relative isolate overflow-hidden pt-[calc(var(--nav-h)+3rem)] lg:pt-[calc(var(--nav-h)+5rem)]">
        <div className="shell">
          <nav aria-label="Breadcrumb" className="t-label mb-10 flex flex-wrap items-center gap-3 text-fog-400">
            <Link href="/portfolio/" className="inline-flex min-h-11 items-center hover:text-yellow">Selected work</Link>
            <span aria-hidden>/</span>
            <span className="text-fog-50">{String(index + 1).padStart(2, "0")}</span>
            {p.isSample && <SampleBadge className="ml-2 border border-ink-600" />}
          </nav>
          <h1 className="t-display max-w-6xl text-fog-50 [animation:ink-in_.9s_var(--ease-sheet)_both]">{p.title}</h1>
          <p className="t-lede mt-7 max-w-2xl">{p.summary}</p>

          <dl className="mt-12 grid grid-cols-2 border-t border-ink-700 lg:grid-cols-4">
            {[["Client", p.client], ["Sector", p.sector], ["Year", String(p.year)], ["Scope", `${p.services.length} ${p.services.length === 1 ? "service" : "services"}`]].map(([k, v]) => (
              <div key={k} className="border-b border-ink-700 py-5 pr-4 lg:border-b-0">
                <dt className="t-label text-fog-500">{k}</dt>
                <dd className="mt-2 text-lg text-fog-50">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="shell mt-6 lg:mt-10">
          <div className="crop relative aspect-[4/3] border border-ink-700 sm:aspect-[16/9] lg:aspect-[21/9]">
            <CoverArt project={p} />
            {p.isSample && <SampleBadge className="absolute left-3 top-3" />}
          </div>
          <p className="t-label mt-4 text-fog-500">Cover composed from the project palette — {p.palette.join(" · ")}</p>
        </div>
      </header>

      {p.isSample && (
        <div className="shell mt-14">
          <p className="max-w-3xl border-l-2 border-yellow pl-5 text-base leading-relaxed text-fog-300">
            <strong className="font-semibold text-fog-50">This is a sample project.</strong> The client is fictional and the figures are illustrative. It is published to show how SPP structures, produces and reports a job of this kind.
          </p>
        </div>
      )}

      <div className="shell py-20 lg:py-28">
        <ol>
          {p.study.map((s, i) => (
            <Reveal as="li" key={s.heading} className="grid gap-x-16 gap-y-4 border-t border-ink-700 py-10 lg:grid-cols-12 lg:py-14">
              <div className="flex items-baseline gap-5 lg:col-span-5">
                <span className="t-data text-xs text-yellow">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="t-title text-fog-50">{s.heading}</h2>
              </div>
              <p className="max-w-[62ch] text-lg leading-relaxed text-fog-300 lg:col-span-7 lg:text-xl lg:leading-relaxed">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>

      {p.impact.length > 0 && (
        <section aria-labelledby="impact-title" className="on-paper">
          <div className="shell py-20 lg:py-28">
            <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
              <Plate tone="paper"><span id="impact-title">In numbers</span></Plate>
              {p.isSample && <span className="t-label text-paper-mute">Illustrative figures — sample project</span>}
            </div>
            <ul className="grid border-t-2 border-paper-ink md:grid-cols-3">
              {p.impact.map((m, i) => (
                <Reveal as="li" key={m.label} i={i} className="border-b border-paper-line py-8 md:border-b-0 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0">
                  <span className="block font-display text-[clamp(3.5rem,8vw,8rem)] font-extrabold leading-[0.85] tracking-[-0.05em] text-paper-ink [font-stretch:80%]">{m.value}</span>
                  <span className="t-label mt-5 block leading-relaxed text-paper-mute">{m.label}</span>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="scope-title" className="shell grid gap-x-16 gap-y-8 py-20 lg:grid-cols-12 lg:py-28">
        <h2 id="scope-title" className="t-title text-fog-50 lg:col-span-5">Services used</h2>
        <ul className="border-b border-ink-700 lg:col-span-7">
          {p.services.map((s, i) => (
            <li key={s} className="flex items-baseline gap-5 border-t border-ink-700 py-4 text-lg text-fog-50">
              <span className="t-data w-6 flex-none text-xs text-fog-500">{String(i + 1).padStart(2, "0")}</span>{s}
            </li>
          ))}
          <li className="border-t border-ink-700">
            <Link href="/services/" className="group/btn t-label flex min-h-14 items-center justify-between gap-4 text-fog-300 transition-colors hover:text-yellow">Explore our services <Arrow /></Link>
          </li>
        </ul>
      </section>

      {next && (
        <Link href={`/portfolio/${next.slug}/`} className="group/btn block border-t border-ink-700 bg-ink-900 transition-colors hover:bg-ink-850">
          <div className="shell flex flex-wrap items-center justify-between gap-6 py-10 lg:py-14">
            <div>
              <p className="t-label mb-3 text-fog-400">Next project{next.isSample ? " · Sample project" : ""}</p>
              <p className="t-title text-fog-50 transition-colors group-hover/btn:text-yellow">{next.title}</p>
            </div>
            <Arrow className="h-4 w-8 text-fog-50 group-hover/btn:text-yellow" />
          </div>
        </Link>
      )}

      <CtaBand
        title="Want a result like this?"
        body="Tell us what you are launching, equipping or promoting. We will plan it as one project."
        primary={{ href: `/request-quote/?project=${p.slug}`, label: "Start a project like this" }}
        secondary={{ href: "/portfolio/", label: "More work" }}
      />
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OutdoorMap } from "@/components/map/OutdoorMap";
import { StatusTag } from "@/components/map/StatusGlyph";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero, Section, SectionHead } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

const description = "Billboard advertising in Vientiane and across Laos. Explore every SPP outdoor location on an interactive map — sizes, lighting, availability and guide prices — then preview your artwork on the structure and request your dates.";

export const metadata: Metadata = {
  title: "Billboard Advertising in Vientiane & Laos — Locations, Availability, Rental",
  description,
  alternates: { canonical: absoluteUrl("/billboards/") },
  openGraph: { title: "SPP Outdoor Network — billboard rental across Laos", description, url: absoluteUrl("/billboards/") },
};

const STEPS = [
  { n: "01", title: "Find the right road", body: "Filter the network by province, size and lighting. Every location page shows the face dimensions, which way it faces and when it is next free." },
  { n: "02", title: "See your artwork on it", body: "Upload your design and preview it on the structure in perspective, by day and by night, from a pedestrian's distance or a driver's." },
  { n: "03", title: "Request your dates", body: "Send the campaign period you want. A request is not a booking — SPP checks the calendar and replies with availability and a written quotation." },
  { n: "04", title: "Print, install, go live", body: "SPP handles large-format printing and installation on site. Design help is available if you do not have finished artwork." },
];

export default async function BillboardsPage() {
  const { billboards, flags, faqs } = await getContent();
  const sorted = [...billboards].sort((a, b) => a.code.localeCompare(b.code));
  const provinces = [...new Set(sorted.map((b) => b.province))];
  const capital = sorted.filter((b) => /vientiane capital/i.test(b.province)).length;
  const bbFaqs = faqs.filter((f) => f.topic === "billboards");

  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Billboards", item: absoluteUrl("/billboards/") }] },
    { "@context": "https://schema.org", "@type": "ItemList", name: "SPP billboard locations in Laos", numberOfItems: sorted.length, itemListElement: sorted.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: `${b.name}, ${b.province}`, url: absoluteUrl(`/billboards/${b.code}/`) })) },
    ...(bbFaqs.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: bbFaqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
  ];

  return (
    <>
      {ld.map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, "\\u003c") }} />)}
      <PageHero
        plate="06"
        eyebrow="SPP Outdoor Network"
        title={<>Billboards across Laos, <span className="t-feel text-yellow">charted</span>.</>}
        lede={`${sorted.length} outdoor locations in ${provinces.length} provinces — ${capital} of them in Vientiane Capital. Check what is free, see your artwork on the structure, and request your dates.`}
        actions={<><Button href="#network" arrow>Explore billboards</Button><Button href="/consultation/" variant="outline">Let&rsquo;s talk</Button></>}
        aside={
          <dl className="grid grid-cols-3 gap-px border border-gold/40 bg-gold/40 text-center lg:w-[22rem]">
            {[["Sites", sorted.length], ["Provinces", provinces.length], ["Open now", sorted.filter((b) => b.status === "available").length]].map(([k, v]) => (
              <div key={k} className="bg-ink-950 px-3 py-4"><dd className="t-data text-2xl text-gold">{String(v).padStart(2, "0")}</dd><dt className="t-label mt-1 text-[0.5625rem] text-fog-500">{k}</dt></div>
            ))}
          </dl>
        }
      />

      <section id="network" aria-label="Billboard location map" className="scroll-mt-[var(--nav-h)] bg-ink-950">
        {/* The fallback is what ships in the static HTML: a complete, linked index for search engines and no-JS visitors. */}
        <Suspense fallback={
          <div className="shell py-12">
            <p className="t-label mb-6 text-fog-400">Loading the interactive map — every location is listed here</p>
            <ul className="grid gap-x-10 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((b) => (
                <li key={b.code} className="border-b border-ink-700">
                  <Link href={`/billboards/${b.code}/`} className="flex min-h-14 items-center justify-between gap-4 py-3 hover:text-gold">
                    <span className="min-w-0"><span className="t-data mr-3 text-xs text-fog-500">{b.code}</span><span className="text-fog-50">{b.name}</span><span className="block text-sm text-fog-400">{b.province} · {b.widthM} × {b.heightM} m</span></span>
                    <StatusTag status={b.status} className="text-[0.5625rem]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        }>
          <OutdoorMap billboards={sorted} showPrices={flags.ONLINE_PRICING} />
        </Suspense>
      </section>

      <Section tone="gold">
        <SectionHead tone="gold" plate="07" eyebrow="How billboard rental works" title={<>From a pin on the map to a face on the <span className="t-feel">road</span>.</>} lede="Outdoor space is often booked without ever seeing the numbers. SPP puts the whole network, its real dimensions and its calendar in one place — and keeps people in the loop where it matters." />
        <ol className="border-t-2 border-ink-950">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} i={i} className="grid gap-3 border-b border-ink-950/30 py-8 md:grid-cols-[8rem_minmax(0,22rem)_1fr] md:gap-10 lg:py-10">
              <span className="t-data text-4xl text-ink-950 lg:text-5xl">{s.n}</span>
              <h3 className="t-heading text-ink-950">{s.title}</h3>
              <p className="max-w-xl text-ink-900">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
          <div>
            <h2 className="t-title text-paper-ink">Billboard advertising in Vientiane — and the roads that lead to it</h2>
            <div className="mt-6 flex flex-col gap-5 text-lg leading-relaxed text-paper-mute">
              <p>Vientiane concentrates the country&rsquo;s commuters, shoppers and visitors on a handful of arteries: Lane Xang Avenue, the airport road, the approaches to That Luang and the university. SPP sites sit on those roads, and each one is documented with its true face size and orientation so you can plan artwork properly.</p>
              <p>Beyond the capital, the network follows Route 13 and the border corridors — Luang Prabang, Savannakhet, Pakse and the northern trade routes — for campaigns that need to be seen province by province rather than only in the city.</p>
              <p>Location details are being re-surveyed by SPP. Until a site is confirmed it is marked &ldquo;unverified&rdquo;, and traffic figures are shown only where they have actually been counted.</p>
            </div>
          </div>
          <div>
            <h3 className="t-label mb-4 text-paper-mute">The network by province</h3>
            <ul className="border-t border-paper-line">
              {provinces.map((p) => {
                const rows = sorted.filter((b) => b.province === p);
                return (
                  <li key={p} className="flex items-baseline justify-between gap-6 border-b border-paper-line py-3.5">
                    <span className="font-medium text-paper-ink">{p}</span>
                    <span className="t-data text-sm text-paper-mute">{rows.length} {rows.length === 1 ? "site" : "sites"} · {rows.filter((b) => b.status === "available").length} available</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Section>

      {bbFaqs.length > 0 && (
        <Section>
          <SectionHead plate="08" eyebrow="Before you request" title="Straight answers" />
          <div className="border-t border-gold/40">
            {bbFaqs.map((f) => (
              <details key={f.q} className="group border-b border-gold/25">
                <summary className="flex min-h-16 list-none items-center justify-between gap-6 py-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="t-heading text-fog-50">{f.q}</h3>
                  <span aria-hidden className="t-data text-xl text-gold transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-3xl pb-7 text-fog-300">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      <CtaBand title="Not sure which road is right?" body="Tell us who you need to reach and for how long. We will recommend locations and quote rental, print and installation together." primary={{ href: "/consultation/", label: "Let's talk" }} secondary={{ href: "/request-quote/", label: "Request a quote" }} />
    </>
  );
}

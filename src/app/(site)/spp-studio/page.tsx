import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero, Section, SectionHead } from "@/components/site/PageHero";
import { DesignThumb } from "@/components/studio/DesignThumb";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";
import { PREFLIGHT_DISCLAIMER } from "@/lib/studio/preflight";
import { normaliseSides } from "@/lib/studio/schema";

export const metadata: Metadata = {
  title: "SPP Studio — Design your own T-shirt, polo, cap or tote online",
  description: "Design custom apparel in your browser: front, back and sleeves, your logo, text and graphics. Preview it in 3D, download a mockup and request a quote from SPP in Laos.",
  alternates: { canonical: absoluteUrl("/spp-studio/") },
  openGraph: { title: "SPP Studio — Design. Visualise. Make it real.", description: "Build a front-and-back mockup in minutes and send it to SPP for a quote.", url: absoluteUrl("/spp-studio/"), images: [absoluteUrl("/og.png")] },
};

const STEPS = [
  { n: "01", verb: "Choose", title: "Pick a product and a colour", body: "T-shirt, polo, jersey, cap or tote — in the fabric colours we actually stock." },
  { n: "02", verb: "Design", title: "Front. Back. Sleeves.", body: "Upload your logo, add text and elements, or start from a template. Drag, resize, rotate, layer, undo." },
  { n: "03", verb: "Check", title: "Automatic artwork preflight", body: "Studio flags low resolution, tiny text, off-area artwork and hard-to-see colours before our team ever opens the file." },
  { n: "04", verb: "Visualise", title: "See it before it exists", body: "Turn it in 3D, line it up as a team, hang it on a rail. Download a watermarked mockup with your Design ID." },
  { n: "05", verb: "Quote", title: "Send it to SPP in one step", body: "Your design travels with the quote request. No re-explaining, no lost attachments — and it is saved for the reorder." },
];

export default async function StudioLanding() {
  const { products, templates, flags } = await getContent();
  const studioProducts = products.filter((p) => p.studio);
  const featured = templates.filter((t) => t.featured).slice(0, 6);
  const app = {
    "@context": "https://schema.org", "@type": "WebApplication", name: "SPP Studio", url: absoluteUrl("/design/"), applicationCategory: "DesignApplication", operatingSystem: "Any (web browser)",
    description: "Online custom apparel mockup designer by SPP, Laos.", offers: { "@type": "Offer", price: "0", priceCurrency: "LAK" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(app).replace(/</g, "\\u003c") }} />
      <PageHero
        plate="S" eyebrow="SPP Studio"
        title={<>Design. Visualise.<br />Make it <span className="t-feel text-gold">real.</span></>}
        lede="A design studio in your browser. Build a front-and-back mockup of your shirt, polo, cap or tote in minutes — then hand it to the people who will actually make it."
        actions={flags.MOCKUP_STUDIO ? <><Button href="/design/" size="lg" arrow>Open SPP Studio</Button><Button href="#templates" size="lg" variant="outline">Start from a template</Button></> : <Button href="/request-quote/" size="lg" arrow>Request a quote</Button>}
        aside={<p className="t-label max-w-[16rem] text-fog-500">Free to use · No account needed to start · Works on phone, tablet and desktop</p>}
      />

      <Section>
        <SectionHead plate="01" eyebrow="How it works" title={<>From idea to quote in <span className="t-feel text-gold">five</span> moves.</>} />
        <ol className="border-t border-ink-700">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} i={i} className="grid gap-3 border-b border-ink-700 py-8 md:grid-cols-[6rem_12rem_1fr] md:items-baseline md:gap-8 lg:py-10">
              <span className="t-data text-4xl text-ink-500 lg:text-5xl">{s.n}</span>
              <span className="t-label text-sky">{s.verb}</span>
              <div><h3 className="t-title text-fog-50">{s.title}</h3><p className="mt-3 max-w-2xl text-lg text-fog-300">{s.body}</p></div>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section tone="raised">
        <SectionHead plate="02" eyebrow="What you can design" title="Every print area, the real size." lede="Each product opens with its true printable areas in millimetres, so what you place is what can be produced." />
        <ul className="grid grid-cols-2 gap-px bg-ink-700 md:grid-cols-3 lg:grid-cols-5">
          {studioProducts.map((p, i) => (
            <Reveal as="li" key={p.slug} i={i} className="bg-ink-900">
              <Link href={`/design/?product=${p.slug}`} className="group flex h-full flex-col p-5 transition-colors hover:bg-ink-850">
                <DesignThumb garment={p.studio!.garment} colour="#eef1f8" layers={[]} showArea className="h-40 w-full transition-transform duration-500 ease-[var(--ease-press)] group-hover:scale-[1.04]" title={p.name} />
                <span className="t-heading mt-4 text-fog-50">{p.name}</span>
                <span className="t-label mt-2 text-fog-500">{p.studio!.areas.map((a) => a.label.replace(" panel", "")).join(" · ")}</span>
                <span className="t-label mt-auto pt-5 text-gold opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Customise this →</span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Section>

      {featured.length > 0 && (
        <Section id="templates">
          <SectionHead plate="03" eyebrow="Templates" title={<>Start with structure. Finish with <span className="t-feel text-gold">yours.</span></>} lede="Layouts by our designers for restaurants, teams, schools, events and brands. Every word, colour and mark is editable." />
          <ul className="grid grid-cols-2 gap-px bg-ink-700 lg:grid-cols-3">
            {featured.map((t, i) => {
              const garment = t.garments[0]!;
              const sides = normaliseSides(t.sides);
              const side = Object.keys(sides).find((k) => k === "front") ?? Object.keys(sides)[0] ?? "front";
              const product = studioProducts.find((p) => p.studio!.garment === garment);
              return (
                <Reveal as="li" key={t.slug} i={i} className="bg-ink-950">
                  <Link href={`/design/?template=${t.slug}${product ? `&product=${product.slug}` : ""}`} className="group block p-5 lg:p-8">
                    <DesignThumb garment={garment} side={side} colour={t.suggestedColour} layers={sides[side] ?? []} className="h-56 w-full transition-transform duration-500 ease-[var(--ease-press)] group-hover:scale-[1.03] lg:h-72" title={`${t.name} template`} />
                    <span className="mt-5 flex items-baseline justify-between gap-3"><span className="t-heading text-fog-50">{t.name}</span><span className="t-label text-fog-500">{t.category}</span></span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </Section>
      )}

      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="t-label mb-6 flex items-center gap-3 text-paper-mute"><span aria-hidden className="reg text-paper-ink" />Honest by design</p>
            <h2 className="t-display text-paper-ink">A mockup is a promise. We keep it <span className="t-feel text-ultra">careful.</span></h2>
          </div>
          <dl className="divide-y divide-paper-line border-y border-paper-line">
            {[
              ["Preflight is advisory", PREFLIGHT_DISCLAIMER],
              ["Colour is indicative", "Screens and fabric show colour differently. SPP confirms final colours and sends a production proof before anything is printed."],
              ["Your files stay yours", "Uploaded artwork is stored privately. Downloads are preview-resolution and watermarked with your Design ID; your originals are never exposed."],
              ["AI suggests, you decide", "The optional design assistant proposes layouts and wording. It never orders, approves artwork or contacts anyone."],
            ].map(([t, d]) => (<div key={t} className="grid gap-2 py-6 sm:grid-cols-[12rem_1fr] sm:gap-8"><dt className="t-label pt-1 text-paper-ink">{t}</dt><dd className="text-lg leading-relaxed text-paper-mute">{d}</dd></div>))}
          </dl>
        </div>
      </Section>

      <CtaBand title={<>Your idea is two minutes from a mockup.</>} body="Open the Studio, type your brand name, and see it on a shirt." primary={flags.MOCKUP_STUDIO ? { href: "/design/", label: "Open SPP Studio" } : { href: "/request-quote/", label: "Request a quote" }} secondary={{ href: "/consultation/", label: "Let's talk" }} />
    </>
  );
}

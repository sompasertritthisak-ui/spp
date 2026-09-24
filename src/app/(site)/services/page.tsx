import Link from "next/link";
import { pageMeta } from "@/components/home/seo";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { Arrow, Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { getContent } from "@/lib/content";

export const metadata = pageMeta({
  title: "Services — Design, Visualisation, Production & Outdoor Advertising",
  description: "Graphic design and mockups, SPP Studio visualisation, apparel and print production, and billboard campaigns across Laos — four services that work as one.",
  path: "/services/",
});

export default async function ServicesPage() {
  const { services, products } = await getContent();
  const list = [...services].sort((a, b) => a.order - b.order);
  const productName = new Map(products.map((p) => [p.slug, p.name]));

  return (
    <>
      <PageHero
        plate="00"
        eyebrow="Services"
        title={<>Four crafts, one <span className="t-feel text-yellow">impression.</span></>}
        lede="Design, visualise, produce, promote. Use one of them or all four — each is built to hand over cleanly to the next, so nothing gets lost between the idea and the street."
        aside={
          <nav aria-label="Services on this page">
            <ol className="min-w-[16rem] border-b border-ink-700">
              {list.map((s, i) => (
                <li key={s.slug}>
                  <a href={`#${s.slug}`} className="group/btn flex min-h-11 items-center justify-between gap-6 border-t border-ink-700 py-2 text-fog-300 transition-colors hover:text-yellow">
                    <span className="t-label"><span className="mr-3 text-gold">{String(i + 1).padStart(2, "0")}</span>{s.verb}</span>
                    <Arrow className="rotate-90" />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        }
      />

      {list.map((s, i) => {
        // ink / gold / ink / paper: the second craft sits on the gold band
        const gold = i === 1;
        const paper = !gold && i % 2 === 1;
        const light = gold || paper;
        const ink = light ? "text-paper-ink" : "text-fog-50";
        const mute = paper ? "text-paper-mute" : gold ? "text-ink-900" : "text-fog-300";
        const line = paper ? "border-paper-line" : gold ? "border-ink-950/30" : "border-gold/25";
        const linked = s.products.filter((slug) => productName.has(slug));
        return (
          <section key={s.slug} id={s.slug} aria-labelledby={`${s.slug}-title`} className={`scroll-mt-[var(--nav-h)] overflow-hidden ${paper ? "on-paper" : gold ? "on-gold" : "border-b border-gold/25 bg-ink-950"}`}>
            <div className="shell py-20 lg:py-32">
              <div className={`flex items-end justify-between gap-6 border-b pb-6 ${light ? "border-paper-ink" : "border-gold"}`}>
                <p aria-hidden className={`font-display text-[clamp(3.5rem,15vw,15rem)] font-extrabold uppercase leading-[0.8] tracking-[-0.05em] [font-stretch:80%] ${ink}`}>
                  {s.verb}
                </p>
                <p className={`t-data pb-1 text-sm ${light ? mute : "text-gold"}`}>{String(i + 1).padStart(2, "0")}/{String(list.length).padStart(2, "0")}</p>
              </div>

              <div className="mt-10 grid gap-x-16 gap-y-12 lg:mt-16 lg:grid-cols-12">
                <div className="lg:col-span-6">
                  <h2 id={`${s.slug}-title`} className={`t-title ${ink}`}>{s.name}</h2>
                  <p className={`mt-6 text-xl leading-snug lg:text-2xl ${light ? "text-paper-ink" : "text-fog-100"}`}>{s.summary}</p>
                  <p className={`mt-6 max-w-[58ch] text-lg leading-relaxed ${mute}`}>{s.body}</p>
                  <div className="mt-10">
                    <Button href={`/request-quote/?service=${s.slug}`} variant={light ? "paper" : "primary"} size="lg" arrow>Request this service</Button>
                  </div>
                </div>

                <div className="lg:col-span-5 lg:col-start-8">
                  <h3 className={`t-label mb-4 ${light ? mute : "text-fog-400"}`}>What you get</h3>
                  <ol className={`border-b ${line}`}>
                    {s.deliverables.map((d, j) => (
                      <Reveal as="li" key={d} i={j} className={`flex items-baseline gap-5 border-t py-4 ${line} ${ink}`}>
                        <span className={`t-data w-6 flex-none text-xs ${light ? mute : "text-gold"}`}>{String(j + 1).padStart(2, "0")}</span>
                        <span className="text-lg">{d}</span>
                      </Reveal>
                    ))}
                  </ol>

                  {linked.length > 0 && (
                    <>
                      <h3 className={`t-label mb-4 mt-12 ${light ? mute : "text-fog-400"}`}>Often used for</h3>
                      <ul className="flex flex-wrap gap-2">
                        {linked.map((slug) => (
                          <li key={slug}>
                            <Link href={`/products/${slug}/`} className={`t-label inline-flex min-h-11 items-center border px-4 transition-colors duration-200 ${paper ? "border-paper-ink text-paper-ink hover:bg-paper-ink hover:text-paper" : gold ? "border-ink-950 text-ink-950 hover:bg-ink-950 hover:text-gold" : "border-gold/50 text-fog-100 hover:border-gold hover:bg-gold hover:text-ink-950"}`}>
                              {productName.get(slug)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <CtaBand
        title="Not sure which service you need?"
        body="Start from what you are trying to achieve and we will recommend the mix."
        primary={{ href: "/solutions/", label: "Build my project" }}
        secondary={{ href: "/consultation/", label: "Let's talk" }}
      />
    </>
  );
}

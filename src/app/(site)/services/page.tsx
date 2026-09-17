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
                    <span className="t-label"><span className="mr-3 text-fog-500">{String(i + 1).padStart(2, "0")}</span>{s.verb}</span>
                    <Arrow className="rotate-90" />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        }
      />

      {list.map((s, i) => {
        const paper = i % 2 === 1;
        const linked = s.products.filter((slug) => productName.has(slug));
        return (
          <section key={s.slug} id={s.slug} aria-labelledby={`${s.slug}-title`} className={`scroll-mt-[var(--nav-h)] overflow-hidden ${paper ? "on-paper" : "border-b border-ink-700 bg-ink-950"}`}>
            <div className="shell py-20 lg:py-32">
              <div className={`flex items-end justify-between gap-6 border-b pb-6 ${paper ? "border-paper-ink" : "border-fog-50"}`}>
                <p aria-hidden className={`font-display text-[clamp(3.5rem,15vw,15rem)] font-extrabold uppercase leading-[0.8] tracking-[-0.05em] [font-stretch:80%] ${paper ? "text-paper-ink" : "text-fog-50"}`}>
                  {s.verb}
                </p>
                <p className={`t-data pb-1 text-sm ${paper ? "text-paper-mute" : "text-fog-400"}`}>{String(i + 1).padStart(2, "0")}/{String(list.length).padStart(2, "0")}</p>
              </div>

              <div className="mt-10 grid gap-x-16 gap-y-12 lg:mt-16 lg:grid-cols-12">
                <div className="lg:col-span-6">
                  <h2 id={`${s.slug}-title`} className={`t-title ${paper ? "text-paper-ink" : "text-fog-50"}`}>{s.name}</h2>
                  <p className={`mt-6 text-xl leading-snug lg:text-2xl ${paper ? "text-paper-ink" : "text-fog-100"}`}>{s.summary}</p>
                  <p className={`mt-6 max-w-[58ch] text-lg leading-relaxed ${paper ? "text-paper-mute" : "text-fog-300"}`}>{s.body}</p>
                  <div className="mt-10">
                    <Button href={`/request-quote/?service=${s.slug}`} variant={paper ? "paper" : "primary"} size="lg" arrow>Request this service</Button>
                  </div>
                </div>

                <div className="lg:col-span-5 lg:col-start-8">
                  <h3 className={`t-label mb-4 ${paper ? "text-paper-mute" : "text-fog-400"}`}>What you get</h3>
                  <ol className={`border-b ${paper ? "border-paper-line" : "border-ink-700"}`}>
                    {s.deliverables.map((d, j) => (
                      <Reveal as="li" key={d} i={j} className={`flex items-baseline gap-5 border-t py-4 ${paper ? "border-paper-line text-paper-ink" : "border-ink-700 text-fog-50"}`}>
                        <span className={`t-data w-6 flex-none text-xs ${paper ? "text-paper-mute" : "text-fog-500"}`}>{String(j + 1).padStart(2, "0")}</span>
                        <span className="text-lg">{d}</span>
                      </Reveal>
                    ))}
                  </ol>

                  {linked.length > 0 && (
                    <>
                      <h3 className={`t-label mb-4 mt-12 ${paper ? "text-paper-mute" : "text-fog-400"}`}>Often used for</h3>
                      <ul className="flex flex-wrap gap-2">
                        {linked.map((slug) => (
                          <li key={slug}>
                            <Link href={`/products/${slug}/`} className={`t-label inline-flex min-h-11 items-center border px-4 transition-colors duration-200 ${paper ? "border-paper-ink text-paper-ink hover:bg-paper-ink hover:text-paper" : "border-ink-500 text-fog-100 hover:border-yellow hover:text-yellow"}`}>
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

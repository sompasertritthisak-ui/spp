"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { clsx } from "clsx";
import { Arrow, Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import type { BundleLite, ProductLite } from "@/components/catalogue/lite";
import { ClientOnly, FormSkeleton } from "@/components/forms/ClientOnly";
import { Section, SectionHead } from "@/components/site/PageHero";
import type { Category, Solution } from "@/content/types";
import { BundleList } from "./BundleList";
import { CampaignBuilder } from "./CampaignBuilder";
import { ProjectBuilder } from "./ProjectBuilder";
import { OTHER_GOAL } from "./project-logic";

type Props = { solutions: Solution[]; products: ProductLite[]; categories: Category[]; bundles: BundleLite[]; services: { slug: string; name: string; products: string[] }[] };

/** Static HTML shows every goal with nothing selected; ?goal= and ?build=1 act in the browser. */
export function SolutionsHub(props: Props) {
  return (
    <Suspense fallback={<Hub {...props} goal="" build={false} />}>
      <FromUrl {...props} />
    </Suspense>
  );
}

function FromUrl(props: Props) {
  const sp = useSearchParams();
  return <Hub {...props} goal={sp.get("goal") ?? ""} build={sp.get("build") === "1"} />;
}

const setUrl = (goal: string, build: boolean) => {
  const qs = new URLSearchParams();
  if (goal) qs.set("goal", goal);
  if (build) qs.set("build", "1");
  const s = qs.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
};
const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));

function Hub({ solutions, products, categories, bundles, services, goal, build }: Props & { goal: string; build: boolean }) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const selected = solutions.find((s) => s.slug === goal);
  // The goal handed to the builder: explicit "Build my project" clicks, or a ?build=1 deep link.
  const [builderGoal, setBuilderGoal] = useState(build ? goal : "");
  const bundle = bundles.find((b) => b.slug === selected?.bundle);

  const pick = (slug: string) => { setUrl(slug, false); scrollTo("goal-detail"); };
  const openBuilder = (slug: string) => { setBuilderGoal(slug); setUrl(slug === OTHER_GOAL ? "" : slug, true); scrollTo("builder"); };

  return (
    <>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
          <nav aria-label="Goals">
            <Plate n="01">Choose a goal</Plate>
            <ul className="mt-8 rule-t">
              {solutions.map((s, i) => {
                const on = s.slug === goal;
                return (
                  <li key={s.slug} className="rule-b">
                    <button type="button" aria-pressed={on} onClick={() => pick(s.slug)} className={clsx("group/goal flex min-h-16 w-full items-center gap-4 py-3 text-left transition-colors duration-200", on ? "text-yellow" : "text-fog-100 hover:text-yellow")}>
                      <span className={clsx("t-data w-7 text-xs", on ? "text-gold" : "text-fog-500")}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1"><span className="t-heading block">{s.goal}</span><span className="block text-sm text-fog-500">{s.prompt}</span></span>
                      <Arrow className={clsx("group-hover/goal:translate-x-1", on ? "text-yellow" : "text-fog-500")} />
                    </button>
                  </li>
                );
              })}
              <li className="rule-b">
                <button type="button" onClick={() => openBuilder(OTHER_GOAL)} className="group/goal flex min-h-16 w-full items-center gap-4 py-3 text-left text-fog-100 transition-colors duration-200 hover:text-yellow">
                  <span className="t-data w-7 text-xs text-fog-500">{String(solutions.length + 1).padStart(2, "0")}</span>
                  <span className="flex-1"><span className="t-heading block">Something else</span><span className="block text-sm text-fog-500">Build it with us, step by step.</span></span>
                  <Arrow className="text-fog-500 group-hover/goal:translate-x-1" />
                </button>
              </li>
            </ul>
          </nav>

          <div id="goal-detail" aria-live="polite" className="scroll-mt-[calc(var(--nav-h)+1rem)]">
            {!selected ? (
              <div className="crop flex h-full min-h-72 flex-col justify-end border border-dashed border-gold/40 p-8 sm:p-12">
                <span aria-hidden className="reg mb-6 h-6 w-6 text-fog-500" />
                <p className="t-title max-w-md text-fog-50">Pick a goal and we will show you what it usually takes.</p>
                <p className="mt-4 max-w-md text-fog-400">Products, print, display and outdoor — recommended as one connected plan, not a shopping list.</p>
              </div>
            ) : (
              <div key={selected.slug} className="[animation:register_.45s_var(--ease-press)_both]">
                <Plate n="02">Recommended for this goal</Plate>
                <h2 className="t-display mt-6 text-fog-50">{selected.goal}</h2>
                <p className="t-lede mt-5 max-w-2xl">{selected.summary}</p>
                <div className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
                  {selected.recommend.map((g) => (
                    <section key={g.group} aria-label={g.group}>
                      <h3 className="t-label flex items-center gap-3 text-fog-400"><span aria-hidden className="h-px w-6 bg-yellow" />{g.group}</h3>
                      <ul className="mt-3 rule-t">
                        {g.items.map((i) => {
                          const p = i.product ? bySlug.get(i.product) : undefined;
                          return (
                            <li key={i.label} className="rule-b">
                              {p ? (
                                <Link href={`/products/${p.slug}/`} className="group/item flex min-h-12 items-center justify-between gap-4 py-2.5 text-fog-100 transition-colors hover:text-yellow">
                                  <span>{i.label}{i.note && <span className="block text-sm text-fog-500">{i.note}</span>}</span>
                                  <Arrow className="text-fog-500 group-hover/item:translate-x-1 group-hover/item:text-yellow" />
                                </Link>
                              ) : (
                                <p className="py-3 text-fog-300">{i.label}{i.note && <span className="block text-sm text-fog-500">{i.note}</span>}</p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
                {bundle && (
                  <p className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border border-gold/40 bg-ink-900 p-5 text-fog-100">
                    <span className="t-label text-yellow">Matching bundle</span>
                    <span className="flex-1">{bundle.name} — {bundle.discountPct}% bundle saving.</span>
                    <a href={`#bundle-${bundle.slug}`} className="t-label inline-flex min-h-11 items-center text-fog-300 underline-offset-4 hover:text-yellow hover:underline">See what is in it</a>
                  </p>
                )}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button size="lg" arrow onClick={() => openBuilder(selected.slug)}>Build my project</Button>
                  <Button size="lg" variant="outline" onClick={() => scrollTo("campaign")}>Build a complete campaign</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section id="builder" tone="raised" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="03" eyebrow="SPP Project Builder" title={<>Nine short questions. One <span className="t-feel text-yellow">clear</span> plan.</>} lede="Answer what you can. You get recommended products and services, an artwork checklist, a realistic timeline — and a quote request that is already filled in. Your progress saves on this device." />
        <ClientOnly fallback={<FormSkeleton rows={4} />}>
          <ProjectBuilder products={products} categories={categories} solutions={solutions} bundles={bundles} services={services} presetGoal={builderGoal} />
        </ClientOnly>
      </Section>

      <Section id="campaign" tone="gold" className="scroll-mt-[var(--nav-h)]">
        <SectionHead tone="gold" plate="04" eyebrow="Campaign Builder" title={<>Build a complete campaign.</>} lede="A shirt, a banner and a billboard are stronger together. Choose a campaign type, then add, remove and resize its components." />
        <CampaignBuilder solutions={solutions} products={products} bundles={bundles} initialType={goal} />
      </Section>

      <Section id="bundles" tone="raised" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="05" eyebrow="Bundles" title={<>Ready-made, <span className="t-feel text-yellow">better</span> value.</>} lede="Proven combinations with a bundle saving. Adjust the quantities to fit, then request a quote — the saving is confirmed in your written quotation." />
        <BundleList bundles={bundles} products={products} />
      </Section>
    </>
  );
}

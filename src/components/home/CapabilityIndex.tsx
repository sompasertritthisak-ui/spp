import Link from "next/link";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import type { Category, Product } from "@/content/types";
import { CategoryMockup } from "./CategoryMockup";
import { Copy, type SectionCopy } from "./Copy";
import { HOME_DEFAULTS } from "./defaults";

const D = HOME_DEFAULTS.capabilities;

/** The catalogue as a wall of mockups: each category shows the thing itself, carrying SPP's mark. */
export function CapabilityIndex({ categories, products, only = [], copy, plate = "06" }: { categories: Category[]; products: Product[]; /** category slugs chosen in the Home page editor, in display order; empty = all */ only?: string[]; copy?: SectionCopy; plate?: string }) {
  const chosen = only.map((slug) => categories.find((c) => c.slug === slug)).filter((c): c is Category => c !== undefined);
  // a choice that matches nothing (categories renamed since) must not empty the section
  const list = chosen.length ? chosen : [...categories].sort((a, b) => a.order - b.order);
  return (
    <section aria-labelledby="capabilities-title" className="border-y border-gold/25 bg-ink-900">
      <div className="shell py-20 lg:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6 lg:mb-16">
          <div>
            <Plate n={plate} className="mb-6"><Copy value={copy?.eyebrow} fallback={D.eyebrow} /></Plate>
            <h2 id="capabilities-title" className="t-display text-fog-50"><Copy value={copy?.title} fallback={D.title} accent="feel" /></h2>
            <span aria-hidden className="gold-bar mt-7" />
          </div>
          <Link href="/products/" className="group/btn t-label inline-flex min-h-11 items-center gap-3 text-fog-50 transition-colors hover:text-yellow">
            All products <Arrow />
          </Link>
        </div>

        <ol className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((c) => {
            const count = products.filter((p) => p.category === c.slug).length;
            return (
              <li key={c.slug} className="flex">
                <Link href={`/products/?category=${c.slug}`} className="group/btn relative flex w-full flex-col overflow-hidden border border-gold/30 bg-ink-950 transition-[border-color,box-shadow,transform] duration-300 ease-[var(--ease-press)] hover:-translate-y-1 hover:border-gold hover:shadow-xl hover:shadow-navy/10">
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gold" />
                  <div className="relative bg-ink-850 px-6 pb-2 pt-8">
                    <div aria-hidden className="halftone pointer-events-none absolute inset-0 text-gold/[0.18] [mask-image:radial-gradient(ellipse_at_80%_10%,black,transparent_65%)]" />
                    <span className="t-data absolute left-5 top-4 text-sm text-gold">{c.plate}</span>
                    {count > 0 && <span className="t-label absolute right-5 top-4 text-[0.625rem] text-fog-400">{count} {count === 1 ? "product" : "products"}</span>}
                    <CategoryMockup slug={c.slug} label={c.name} className="relative mx-auto block h-44 w-full transition-transform duration-500 ease-[var(--ease-press)] group-hover/btn:scale-[1.04]" />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-6">
                    <h3 className="font-display text-2xl font-bold leading-[1.05] tracking-[-0.02em] text-fog-50 [font-stretch:92%]">{c.name}</h3>
                    <p className="flex-1 text-base leading-relaxed text-fog-400">{c.blurb}</p>
                    <span className="t-label mt-2 inline-flex items-center gap-3 text-gold">Explore <Arrow /></span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

import Link from "next/link";
import { hasPriceHint, priceLabel } from "@/components/catalogue/lite";
import { ProductVisual } from "@/components/catalogue/ProductVisual";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { Reveal } from "@/components/ui/Reveal";
import type { Category, Product } from "@/content/types";
import { T } from "@/lib/i18n";
import { FABRIC_META } from "@/lib/studio/fabric";
import { CategoryMockup } from "./CategoryMockup";
import { Copy, type SectionCopy } from "./Copy";
import { HOME_DEFAULTS } from "./defaults";

const D = HOME_DEFAULTS.featured;

/** The chosen products that are actually published, in the order staff put them. */
export function pickProducts(products: Product[], slugs: string[]): Product[] {
  return slugs.map((slug) => products.find((p) => p.slug === slug)).filter((p): p is Product => p !== undefined);
}

/**
 * Products SPP chose for the landing page (CMS → Home page → Featured
 * products). A photo is shown when the product has one; otherwise the drawn
 * garment or category mockup — never a stock image. A price appears only when
 * online pricing is on AND the product carries a public "from" hint.
 * With nothing chosen the section does not exist.
 */
export function FeaturedProducts({ products, categories, slugs, onlinePricing, studioOn, copy, plate }: {
  products: Product[]; categories: Category[]; slugs: string[]; onlinePricing: boolean; studioOn: boolean; copy?: SectionCopy; plate?: string;
}) {
  const list = pickProducts(products, slugs);
  if (!list.length) return null;
  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? "";
  // fill the rows: one or two cards sit side by side, a multiple of four runs four across, anything else three
  const n = list.length;
  const columns = n <= 2 ? "sm:grid-cols-2" : n % 4 === 0 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3";

  return (
    <section aria-labelledby="featured-title" className="relative isolate overflow-hidden border-b border-gold/25 bg-ink-950">
      <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/2 text-gold/[0.10] [mask-image:radial-gradient(ellipse_at_10%_10%,black,transparent_70%)]" />
      <div className="shell py-20 lg:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6 lg:mb-16">
          <div className="max-w-3xl">
            <Plate n={plate} className="mb-6"><Copy value={copy?.eyebrow} fallback={D.eyebrow} /></Plate>
            <h2 id="featured-title" className="t-display text-fog-50"><Copy value={copy?.title} fallback={D.title} accent="feel" /></h2>
            <span aria-hidden className="gold-bar mt-7" />
            <Copy as="p" value={copy?.lede} className="mt-6 max-w-xl text-lg leading-relaxed text-fog-300" />
          </div>
          <Link href="/products/" className="group/btn t-label inline-flex min-h-11 items-center gap-3 text-fog-50 transition-colors hover:text-yellow">
            <T k="home.featured.all" /> <Arrow />
          </Link>
        </div>

        <ul className={`grid gap-5 ${columns}`}>
          {list.map((p, i) => {
            const colour = p.colours.find((c) => c.name === "Navy")?.hex ?? p.colours[0]?.hex;
            const meta = [categoryName(p.category), p.fabric !== "other" ? FABRIC_META[p.fabric].label : ""].filter(Boolean).join(" · ");
            return (
              <Reveal as="li" key={p.slug} i={Math.min(i, 5)} className="flex">
                <article className="group relative flex w-full flex-col border border-gold/30 bg-ink-900 transition-[border-color,transform] duration-300 ease-[var(--ease-press)] hover:-translate-y-1 hover:border-gold">
                  <span aria-hidden className="absolute inset-x-0 top-0 z-10 h-1 bg-gold" />
                  <Link href={`/products/${p.slug}/`} tabIndex={-1} aria-hidden className="relative block aspect-[4/3] overflow-hidden bg-ink-850">
                    {p.cover
                      // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser; dimensions reserve space (CLS)
                      ? <img src={p.cover.url} alt="" width={p.cover.width ?? undefined} height={p.cover.height ?? undefined} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-press)] group-hover:scale-[1.03]" />
                      : p.studio
                        ? <ProductVisual garment={p.studio.garment} colour={colour} category={p.category} name={p.name} className="h-full w-full p-5 transition-transform duration-500 ease-[var(--ease-press)] group-hover:scale-[1.04]" />
                        : <CategoryMockup slug={p.category} label={p.name} className="h-full w-full p-4 transition-transform duration-500 ease-[var(--ease-press)] group-hover:scale-[1.04]" />}
                    <span className="t-data absolute left-5 top-4 text-sm text-gold">{String(i + 1).padStart(2, "0")}</span>
                  </Link>
                  <div className="flex flex-1 flex-col p-6">
                    {meta && <p className="t-label text-fog-400">{meta}</p>}
                    <h3 className="mt-3 font-display text-2xl font-bold leading-[1.05] tracking-[-0.02em] text-fog-50 [font-stretch:92%]">
                      <Link href={`/products/${p.slug}/`} className="transition-colors hover:text-yellow">{p.name}</Link>
                    </h3>
                    <p className="mt-3 flex-1 text-base leading-relaxed text-fog-400">{p.summary}</p>
                    <dl className="mt-6 grid grid-cols-2 gap-x-6 border-t border-gold/25 pt-4">
                      <div>
                        <dt className="t-label text-fog-500"><T k="home.featured.min" /></dt>
                        <dd className="t-data mt-1.5 text-lg text-fog-50">{p.moq.toLocaleString("en-US")}</dd>
                      </div>
                      <div>
                        <dt className="t-label text-fog-500"><T k="home.featured.lead" /></dt>
                        <dd className="mt-1.5 text-base text-fog-100">{p.leadTimeDays ? <T k="home.featured.leadDays" vars={{ from: p.leadTimeDays[0], to: p.leadTimeDays[1] }} /> : <T k="home.featured.leadQuote" />}</dd>
                      </div>
                    </dl>
                    {hasPriceHint(p, onlinePricing) && <p className="t-data mt-4 text-base text-gold">{priceLabel(p, onlinePricing)}</p>}
                    <p className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-1">
                      <Link href={`/products/${p.slug}/`} aria-label={`${p.name} — view product`} className="group/btn t-label inline-flex min-h-11 items-center gap-3 text-fog-50 transition-colors hover:text-yellow"><T k="home.featured.view" /> <Arrow /></Link>
                      {p.studio && studioOn && <Link href={`/design/?product=${p.slug}`} aria-label={`${p.name} — design it in SPP Studio`} className="group/btn t-label inline-flex min-h-11 items-center gap-3 text-gold transition-colors hover:text-fog-50"><T k="home.featured.design" /> <Arrow /></Link>}
                    </p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

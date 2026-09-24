import Link from "next/link";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import type { Category, Product } from "@/content/types";

/** The catalogue as a printer's index: plate number, name, what it covers, how many products sit behind it. */
export function CapabilityIndex({ categories, products }: { categories: Category[]; products: Product[] }) {
  const list = [...categories].sort((a, b) => a.order - b.order);
  return (
    <section aria-labelledby="capabilities-title" className="border-y border-gold/25 bg-ink-900">
      <div className="shell py-20 lg:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6 lg:mb-16">
          <div>
            <Plate n="06" className="mb-6">Capability index</Plate>
            <h2 id="capabilities-title" className="t-display text-fog-50">Everything we make.</h2>
            <span aria-hidden className="gold-bar mt-7" />
          </div>
          <Link href="/products/" className="group/btn t-label inline-flex min-h-11 items-center gap-3 text-fog-50 transition-colors hover:text-yellow">
            All products <Arrow />
          </Link>
        </div>

        <ol className="border-b border-gold/30">
          {list.map((c) => {
            const count = products.filter((p) => p.category === c.slug).length;
            return (
              <li key={c.slug}>
                <Link href={`/products/?category=${c.slug}`} className="group/btn relative grid grid-cols-[3rem_1fr_auto] items-baseline gap-x-4 border-t border-gold/25 py-6 transition-colors duration-200 hover:bg-gold/5 lg:grid-cols-[6rem_minmax(0,5fr)_minmax(0,6fr)_5rem_auto] lg:gap-x-8 lg:py-8">
                  <span className="t-data text-sm text-gold">{c.plate}</span>
                  <span className="font-display text-[clamp(1.5rem,3.4vw,3.25rem)] font-bold leading-none tracking-[-0.03em] text-fog-50 transition-transform duration-300 ease-[var(--ease-press)] [font-stretch:88%] group-hover/btn:translate-x-2">{c.name}</span>
                  <span className="col-start-2 mt-2 text-base text-fog-400 lg:col-start-auto lg:mt-0">{c.blurb}</span>
                  <span className="t-label col-start-2 mt-3 text-sky lg:col-start-auto lg:mt-0 lg:text-right">{count > 0 ? `${count} ${count === 1 ? "product" : "products"}` : ""}</span>
                  <Arrow className="col-start-3 row-start-1 self-center text-fog-500 group-hover/btn:text-yellow lg:col-start-auto" />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

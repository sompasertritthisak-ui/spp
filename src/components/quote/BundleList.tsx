"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Plate";
import type { BundleLite, ProductLite } from "@/components/catalogue/lite";
import { track } from "@/lib/backend/analytics";
import { ItemQtyRow } from "./ItemQtyRow";
import { defaultLocations } from "./LocationsPicker";
import { useStartQuote } from "./useStartQuote";

function BundleRow({ bundle: b, n, bySlug }: { bundle: BundleLite; n: number; bySlug: Map<string, ProductLite> }) {
  const startQuote = useStartQuote();
  const ref = useRef<HTMLLIElement>(null);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(b.items.map((i) => [i.product, i.qty])));

  // "Viewed" means it actually reached the screen, once.
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { track("bundle_viewed", { ref: b.slug }); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [b.slug]);

  return (
    <li ref={ref} id={`bundle-${b.slug}`} className="grid gap-8 rule-b py-10 lg:grid-cols-[4rem_1fr_1.3fr] lg:gap-12">
      <span className="t-data text-3xl text-fog-500">{String(n).padStart(2, "0")}</span>
      <div>
        <h3 className="t-title text-fog-50">{b.name}</h3>
        <p className="mt-3 max-w-md text-fog-300">{b.summary}</p>
        <p className="mt-5"><span className="t-label inline-block bg-yellow px-2.5 py-1.5 text-ink-950">{b.discountPct}% bundle saving</span></p>
      </div>
      <div className="border border-ink-700 bg-ink-950 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><p className="t-label text-fog-400">In the bundle — edit to fit</p><Badge tone="yellow">{b.items.length} items</Badge></div>
        <ul className="mt-3 rule-t">
          {b.items.map((i) => {
            const p = bySlug.get(i.product);
            return p ? <ItemQtyRow key={i.product} product={p} qty={qty[i.product] ?? i.qty} note={i.note} onQty={(v) => setQty({ ...qty, [i.product]: v })} /> : null;
          })}
        </ul>
        <Button className="mt-6" arrow onClick={() => startQuote({
          v: 1, kind: "bundle", source: `bundle:${b.slug}`, bundle: b.slug,
          items: b.items.flatMap((i) => { const p = bySlug.get(i.product); return p ? [{ product: i.product, qty: qty[i.product] ?? i.qty, note: i.note, method: p.printMethods[0], locations: defaultLocations(p.areas) }] : []; }),
        })}>Request a quote</Button>
      </div>
    </li>
  );
}

export function BundleList({ bundles, products }: { bundles: BundleLite[]; products: ProductLite[] }) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  return <ol className="rule-t">{bundles.map((b, i) => <BundleRow key={b.slug} bundle={b} n={i + 1} bySlug={bySlug} />)}</ol>;
}

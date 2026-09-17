"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import type { BundleLite, ProductLite } from "@/components/catalogue/lite";
import type { Solution } from "@/content/types";
import { formatNumber } from "@/lib/format";
import { ItemQtyRow } from "./ItemQtyRow";
import { defaultLocations } from "./LocationsPicker";
import { useStartQuote } from "./useStartQuote";

type Props = { solutions: Solution[]; products: ProductLite[]; bundles: BundleLite[]; initialType: string };

/** Starting quantities: the matching bundle's, else each product's minimum. */
function defaults(s: Solution | undefined, bySlug: Map<string, ProductLite>, bundles: BundleLite[]) {
  const bundle = bundles.find((b) => b.slug === s?.bundle);
  const out: Record<string, number> = {};
  for (const g of s?.recommend ?? []) for (const i of g.items) {
    const p = i.product ? bySlug.get(i.product) : undefined;
    if (p) out[p.slug] = bundle?.items.find((b) => b.product === p.slug)?.qty ?? p.moq;
  }
  return out;
}

export function CampaignBuilder({ solutions, products, bundles, initialType }: Props) {
  const startQuote = useStartQuote();
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const [type, setType] = useState(solutions.some((s) => s.slug === initialType) ? initialType : solutions[0]?.slug ?? "");
  const [seenInitial, setSeenInitial] = useState(initialType);
  const solution = solutions.find((s) => s.slug === type);
  const [picked, setPicked] = useState<Record<string, number>>(() => defaults(solution, bySlug, bundles));

  const change = (slug: string) => { setType(slug); setPicked(defaults(solutions.find((s) => s.slug === slug), bySlug, bundles)); };
  if (initialType !== seenInitial) {
    setSeenInitial(initialType);
    if (solutions.some((s) => s.slug === initialType)) change(initialType);
  }

  const count = Object.keys(picked).length;
  // A bundle saving applies only when every product in that bundle is part of the campaign.
  const bundle = [...bundles].sort((a, b) => b.discountPct - a.discountPct).find((b) => b.items.every((i) => i.product in picked));
  const extras = (solution?.recommend ?? []).flatMap((g) => g.items.filter((i) => !i.product).map((i) => `${i.label}${i.note ? ` (${i.note})` : ""}`));

  return (
    <div className="grid gap-px border border-ink-700 bg-ink-700 lg:grid-cols-[1fr_22rem]">
      <div className="bg-ink-950 p-5 sm:p-8">
        <Select label="Campaign type" value={type} onChange={(e) => change(e.target.value)} className="max-w-md">
          {solutions.map((s) => <option key={s.slug} value={s.slug}>{s.goal}</option>)}
        </Select>
        {solution && <p className="mt-4 max-w-xl text-fog-300">{solution.summary}</p>}

        <div className="mt-10 flex flex-col gap-10">
          {(solution?.recommend ?? []).map((g) => (
            <section key={g.group} aria-label={g.group}>
              <h3 className="t-label flex items-center gap-3 text-fog-400"><span aria-hidden className="h-px w-6 bg-yellow" />{g.group}</h3>
              <ul className="mt-3 rule-t">
                {g.items.map((i) => {
                  const p = i.product ? bySlug.get(i.product) : undefined;
                  if (!p) return <li key={i.label} className="rule-b py-4 text-fog-300">{i.label}{i.note && <span className="block text-sm text-fog-500">{i.note}</span>}</li>;
                  if (!(p.slug in picked)) {
                    return (
                      <li key={i.label} className="rule-b flex items-center justify-between gap-4 py-3">
                        <span className="text-fog-500 line-through decoration-ink-500">{i.label}</span>
                        <button type="button" onClick={() => setPicked({ ...picked, [p.slug]: p.moq })} className="t-label min-h-11 px-1 text-yellow hover:text-fog-50">+ Add back</button>
                      </li>
                    );
                  }
                  return <ItemQtyRow key={i.label} product={p} qty={picked[p.slug] ?? p.moq} note={i.note ?? i.label} onQty={(n) => setPicked({ ...picked, [p.slug]: n })} onRemove={() => setPicked(Object.fromEntries(Object.entries(picked).filter(([k]) => k !== p.slug)))} />;
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <aside aria-label="Campaign summary" className="bg-ink-900 p-5 sm:p-8">
        <div className="lg:sticky lg:top-[calc(var(--nav-h)+2rem)]" aria-live="polite">
          <p className="t-label text-fog-400">Your campaign</p>
          <p className="t-data mt-4 text-5xl text-fog-50">{String(count).padStart(2, "0")}</p>
          <p className="text-fog-300">{count === 1 ? "component" : "components"} · {formatNumber(Object.values(picked).reduce((n, v) => n + v, 0))} pieces</p>
          {bundle ? (
            <p className="mt-6 border border-yellow/50 p-4 text-fog-100"><span className="t-label mb-1 block text-yellow">{bundle.discountPct}% bundle saving</span>This campaign includes everything in the {bundle.name}. The saving is applied in your written quote.</p>
          ) : (
            <p className="mt-6 text-sm text-fog-400">Include every item of a bundle and its saving is applied to your quote.</p>
          )}
          <Button className="mt-8 w-full" size="lg" arrow disabled={count === 0} onClick={() => startQuote({
            v: 1, kind: "campaign", source: `campaign:${type}`, bundle: bundle?.slug,
            notes: [`Campaign type: ${solution?.goal ?? type}.`, extras.length ? `Also of interest: ${extras.join("; ")}.` : ""].filter(Boolean).join("\n"),
            items: Object.entries(picked).flatMap(([slug, qty]) => { const p = bySlug.get(slug); return p ? [{ product: slug, qty, method: p.printMethods[0], locations: defaultLocations(p.areas) }] : []; }),
          })}>Request campaign quote</Button>
          <p className="mt-3 text-sm text-fog-500">Colours, sizes and dates are added on the next screen.</p>
        </div>
      </aside>
    </div>
  );
}

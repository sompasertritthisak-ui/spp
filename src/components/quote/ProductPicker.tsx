"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Field";
import type { ProductLite } from "@/components/catalogue/lite";
import { ProductVisual } from "@/components/catalogue/ProductVisual";
import type { Category } from "@/content/types";
import { useT } from "@/lib/i18n";

/** Searchable product list. Always shows the whole catalogue when the query is empty — nothing to guess. */
export function ProductPicker({ products, categories, onPick, error, suggested = [] }: { products: ProductLite[]; categories: Category[]; onPick: (p: ProductLite) => void; error?: string; suggested?: ProductLite[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? "";
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const results = products.filter((p) => words.every((w) => `${p.name} ${p.summary} ${catName(p.category)}`.toLowerCase().includes(w)));
  return (
    <div className="border border-gold/25 bg-ink-900 p-5 sm:p-6">
      <Input label={t("quote.addProduct")} type="search" placeholder={t("quote.searchPh")} value={q} onChange={(e) => setQ(e.target.value)} error={error} autoComplete="off" />
      {suggested.length > 0 && !q && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="t-label text-fog-500">{t("quote.suggested")}</span>
          {suggested.map((p) => (
            <button key={p.slug} type="button" onClick={() => onPick(p)} className="min-h-11 border border-ink-600 px-3 text-sm text-fog-300 transition-colors hover:border-gold hover:text-gold">+ {p.name}</button>
          ))}
        </div>
      )}
      <ul aria-label={t("quote.products")} className="thin-scroll mt-4 max-h-72 overflow-y-auto rule-t">
        {results.map((p) => (
          <li key={p.slug} className="rule-b">
            <button type="button" onClick={() => { onPick(p); setQ(""); }} className="group/pick flex min-h-14 w-full items-center gap-4 px-1 py-2 text-left transition-colors hover:bg-gold/5">
              <ProductVisual garment={p.garment} colour={p.colours[2]?.hex ?? p.colours[0]?.hex} category={p.category} name={p.name} className="h-10 w-10 flex-none" glyphClassName="h-full w-full text-fog-400" />
              <span className="min-w-0 flex-1"><span className="block text-fog-50 group-hover/pick:text-gold">{p.name}</span><span className="block truncate text-sm text-fog-500">{catName(p.category)}</span></span>
              <span className="t-label text-fog-400 group-hover/pick:text-gold">{t("common.add")}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="py-4 text-fog-400">{t("quote.noProduct")}</li>}
      </ul>
    </div>
  );
}

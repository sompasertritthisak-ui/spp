"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Arrow, Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { Badge, Plate } from "@/components/ui/Plate";
import type { Category, PrintMethod } from "@/content/types";
import { Chip } from "@/components/forms/controls";
import { leadLabel, priceLabel, type ProductLite } from "./lite";
import { METHODS } from "./methods";
import { ProductVisual } from "./ProductVisual";

type Filters = { category: string; method: string; studio: boolean; q: string };
const NONE: Filters = { category: "", method: "", studio: false, q: "" };
type Props = { categories: Category[]; products: ProductLite[]; onlinePricing: boolean; studioOn: boolean };

/** The static HTML carries the full, unfiltered index (the Suspense fallback);
 *  the query string then narrows it in the browser. */
export function Catalogue(props: Props) {
  return (
    <Suspense fallback={<CatalogueView {...props} filters={NONE} onChange={() => {}} />}>
      <UrlSynced {...props} />
    </Suspense>
  );
}

const parse = (sp: URLSearchParams): Filters => ({ category: sp.get("category") ?? "", method: sp.get("method") ?? "", studio: sp.get("studio") === "1", q: sp.get("q") ?? "" });
function serialise(f: Filters) {
  const qs = new URLSearchParams();
  if (f.category) qs.set("category", f.category);
  if (f.method) qs.set("method", f.method);
  if (f.studio) qs.set("studio", "1");
  if (f.q) qs.set("q", f.q);
  return qs.toString();
}

function UrlSynced(props: Props) {
  const sp = useSearchParams();
  const qs = sp.toString();
  // Local state keeps typing instant; the URL follows. If the URL changes from
  // outside (a nav link, back/forward) the filters follow it instead.
  const [filters, setFilters] = useState(() => parse(sp));
  const [seen, setSeen] = useState(qs);
  if (qs !== seen) {
    setSeen(qs);
    if (qs !== serialise(filters)) setFilters(parse(sp));
  }
  const onChange = (next: Filters) => {
    setFilters(next);
    const s = serialise(next);
    // History API keeps useSearchParams in sync without a navigation or scroll jump.
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  };
  return <CatalogueView {...props} filters={filters} onChange={onChange} />;
}

function matches(p: ProductLite, f: Filters, categoryName: string) {
  if (f.category && p.category !== f.category) return false;
  if (f.method && !p.printMethods.includes(f.method as PrintMethod)) return false;
  if (f.studio && !p.garment) return false;
  if (f.q) {
    const hay = `${p.name} ${p.summary} ${categoryName} ${p.printMethods.map((m) => METHODS[m].label).join(" ")}`.toLowerCase();
    return f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }
  return true;
}

function CatalogueView({ categories, products, onlinePricing, studioOn, filters, onChange }: Props & { filters: Filters; onChange: (f: Filters) => void }) {
  const methodsInUse = useMemo(() => [...new Set(products.flatMap((p) => p.printMethods))], [products]);
  const groups = useMemo(
    () => categories
      .map((c) => ({ category: c, items: products.filter((p) => p.category === c.slug && matches(p, filters, c.name)) }))
      .filter((g) => g.items.length > 0),
    [categories, products, filters],
  );
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const active = Boolean(filters.category || filters.method || filters.studio || filters.q);

  return (
    <div className="grid gap-12 lg:grid-cols-[17rem_1fr] lg:gap-16">
      <aside aria-label="Filter the catalogue" className="lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:self-start">
        <div className="flex flex-col gap-6">
          <Input label="Search the catalogue" type="search" name="q" placeholder="polo, banner, embroidery…" value={filters.q} onChange={(e) => onChange({ ...filters, q: e.target.value })} autoComplete="off" />
          <nav aria-label="Categories">
            <p className="t-label mb-2 text-fog-400">Category</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-0 lg:flex-col lg:gap-0">
              {[{ slug: "", name: "Everything", plate: "00" }, ...categories].map((c) => {
                const on = filters.category === c.slug;
                return (
                  <li key={c.slug || "all"} className="lg:rule-b">
                    <button type="button" aria-pressed={on} onClick={() => onChange({ ...filters, category: c.slug })} className={clsx("flex min-h-11 w-full items-center gap-3 text-left text-[0.9375rem] transition-colors duration-150", on ? "text-yellow" : "text-fog-300 hover:text-fog-50")}>
                      <span className="t-data text-xs text-fog-500">{c.plate}</span>
                      <span>{c.name}</span>
                      {on && <span aria-hidden className="ml-auto hidden h-1.5 w-1.5 bg-yellow lg:block" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <Select label="How it is printed" value={filters.method} onChange={(e) => onChange({ ...filters, method: e.target.value })}>
            <option value="">Any method</option>
            {methodsInUse.map((m) => <option key={m} value={m}>{METHODS[m].label}</option>)}
          </Select>
          {studioOn && <Chip checked={filters.studio} onChange={(v) => onChange({ ...filters, studio: v })}>Can design online</Chip>}
          {active && <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange(NONE)}>Clear filters</Button>}
        </div>
      </aside>

      <div>
        <p aria-live="polite" className="t-label mb-8 text-fog-400">
          {total} {total === 1 ? "product" : "products"}{active ? " match" : " in the catalogue"}
        </p>
        {groups.length === 0 ? (
          <EmptyState title="Nothing matches that." body="Try a broader search — or tell us what you need and we will source or make it." action={<div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => onChange(NONE)}>Clear filters</Button><Button href="/request-quote/" arrow>Request a quote</Button></div>} />
        ) : (
          <div className="flex flex-col gap-20">
            {groups.map(({ category, items }) => (
              <section key={category.slug} aria-labelledby={`cat-${category.slug}`}>
                <header className="mb-6 grid gap-4 md:grid-cols-[1fr_1.2fr] md:items-end">
                  <div>
                    <Plate n={category.plate}>{items.length} {items.length === 1 ? "item" : "items"}</Plate>
                    <h2 id={`cat-${category.slug}`} className="t-title mt-4 text-fog-50">{category.name}</h2>
                  </div>
                  <p className="max-w-xl text-fog-300">{category.blurb}</p>
                </header>
                <ol className="rule-t">
                  {items.map((p, i) => <Row key={p.slug} p={p} index={`${category.plate}.${String(i + 1).padStart(2, "0")}`} onlinePricing={onlinePricing} studioOn={studioOn} />)}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ p, index, onlinePricing, studioOn }: { p: ProductLite; index: string; onlinePricing: boolean; studioOn: boolean }) {
  const colour = p.colours.find((c) => c.name === "Navy")?.hex ?? p.colours[0]?.hex;
  return (
    <li className="rule-b">
      <Link href={`/products/${p.slug}/`} className="group/row grid grid-cols-[4.5rem_1fr] items-center gap-x-5 gap-y-3 py-5 transition-colors duration-200 hover:bg-ink-900 sm:grid-cols-[3rem_5.5rem_1fr] lg:grid-cols-[3rem_6rem_1.4fr_1fr_auto] lg:px-3">
        <span className="t-data hidden text-xs text-fog-500 sm:block">{index}</span>
        <ProductVisual garment={p.garment} colour={colour} category={p.category} name={p.name} className="h-[4.5rem] w-[4.5rem] flex-none sm:h-[5.5rem] sm:w-[5.5rem]" glyphClassName="h-full w-full p-2 text-fog-400 transition-colors duration-200 group-hover/row:text-yellow" />
        <div className="min-w-0">
          <h3 className="t-heading text-fog-50 transition-colors duration-200 group-hover/row:text-yellow">{p.name}</h3>
          <p className="mt-1 text-fog-400">{p.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.garment && studioOn && <Badge tone="yellow">Design online</Badge>}
            {p.printMethods.map((m) => <Badge key={m}>{METHODS[m].short}</Badge>)}
          </div>
        </div>
        <dl className="col-span-2 grid grid-cols-3 gap-4 sm:col-span-3 lg:col-span-1 lg:grid-cols-1 lg:gap-1.5">
          <div className="lg:flex lg:gap-3"><dt className="t-label text-fog-500 lg:w-16 lg:pt-0.5">Min.</dt><dd className="t-data text-sm text-fog-100">{p.moq.toLocaleString("en-US")}</dd></div>
          <div className="lg:flex lg:gap-3"><dt className="t-label text-fog-500 lg:w-16 lg:pt-0.5">Lead</dt><dd className="text-sm text-fog-100">{p.leadTimeDays ? `${p.leadTimeDays[0]}–${p.leadTimeDays[1]} days` : leadLabel(null)}</dd></div>
          <div className="lg:flex lg:gap-3"><dt className="t-label text-fog-500 lg:w-16 lg:pt-0.5">Price</dt><dd className="text-sm text-fog-100">{priceLabel(p, onlinePricing)}</dd></div>
        </dl>
        <Arrow className="hidden text-fog-500 group-hover/row:translate-x-1 group-hover/row:text-yellow lg:block" />
      </Link>
    </li>
  );
}

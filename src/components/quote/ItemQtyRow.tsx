"use client";
import Link from "next/link";
import { QtyStepper } from "@/components/forms/controls";
import type { ProductLite } from "@/components/catalogue/lite";
import { ProductVisual } from "@/components/catalogue/ProductVisual";
import { useT } from "@/lib/i18n";

/** One product with an editable quantity — shared by the campaign builder, bundles and the project summary. */
export function ItemQtyRow({ product: p, qty, note, onQty, onRemove }: { product: ProductLite; qty: number; note?: string; onQty: (n: number) => void; onRemove?: () => void }) {
  const t = useT();
  return (
    <li className="rule-b flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
      <ProductVisual garment={p.garment} colour={p.colours[2]?.hex ?? p.colours[0]?.hex} category={p.category} name={p.name} className="h-12 w-12 flex-none" glyphClassName="h-full w-full text-fog-400" />
      <div className="min-w-[9rem] flex-1">
        <Link href={`/products/${p.slug}/`} className="text-fog-50 underline-offset-4 hover:text-yellow hover:underline">{p.name}</Link>
        {note && <p className="text-sm text-fog-500">{note}</p>}
      </div>
      <QtyStepper label={t("quote.quantity", { unit: p.name })} hideLabel size="sm" value={qty} onChange={onQty} />
      {onRemove && <button type="button" onClick={onRemove} aria-label={t("quote.removeX", { name: p.name })} className="t-label flex min-h-11 items-center px-1 text-fog-500 hover:text-danger">{t("common.remove")}</button>}
    </li>
  );
}

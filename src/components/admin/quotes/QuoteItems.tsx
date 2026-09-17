"use client";
import { formatLak, formatNumber } from "@/lib/format";
import type { QuoteItemsRow } from "@/lib/backend/db-types";
import { DesignMini } from "../ops/DesignArt";
import { num } from "../ops/data";
import { adminInput } from "../ui";
import Link from "next/link";

export type LineDraft = { unit: string; total: string; totalTouched: boolean; note: string };
export const draftOf = (i: QuoteItemsRow): LineDraft => {
  const auto = i.unit_price_lak != null ? Number(i.unit_price_lak) * i.qty : null;
  const touched = i.line_total_lak != null && auto != null && Number(i.line_total_lak) !== auto;
  return { unit: i.unit_price_lak != null ? String(Number(i.unit_price_lak)) : "", total: touched ? String(Number(i.line_total_lak)) : "", totalTouched: touched, note: i.note };
};
/** Line total = unit × qty unless sales has typed an override. */
export const lineTotal = (i: QuoteItemsRow, d: LineDraft | undefined) => {
  if (!d) return null;
  if (d.totalTouched) return num(d.total);
  const u = num(d.unit);
  return u == null ? null : u * i.qty;
};

const configSummary = (c: unknown) => {
  if (!c || typeof c !== "object" || Array.isArray(c)) return "";
  return Object.entries(c as Record<string, unknown>).flatMap(([k, v]) => {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return [];
    if (k === "sizes" && typeof v === "object" && !Array.isArray(v)) return [`sizes ${Object.entries(v as Record<string, unknown>).filter(([, n]) => Number(n) > 0).map(([s, n]) => `${s}×${String(n)}`).join(" ")}`];
    return [`${k} ${Array.isArray(v) ? v.join(" + ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`];
  }).join(" · ");
};

export function QuoteItems({ items, drafts, setDraft, editable }: { items: QuoteItemsRow[]; drafts: Record<string, LineDraft>; setDraft: (id: string, patch: Partial<LineDraft>) => void; editable: boolean }) {
  if (!items.length) return <p className="text-sm text-fog-500">This quote has no line items.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {items.map((i, n) => {
        const d = drafts[i.id];
        const total = lineTotal(i, d);
        const cfg = configSummary(i.config);
        return (
          <li key={i.id} className="border border-ink-700 bg-ink-950 p-3">
            <div className="flex gap-3">
              <DesignMini designId={i.design_id} version={i.design_version} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"><span className="font-medium text-fog-50"><span className="t-data mr-2 text-xs text-fog-500">{String(n + 1).padStart(2, "0")}</span>{i.product_name}</span><span className="t-data text-fog-300">× {formatNumber(i.qty)}</span></p>
                {cfg && <p className="mt-1 text-xs leading-relaxed text-fog-400">{cfg}</p>}
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-fog-500">
                  {i.estimate_unit_lak != null && <span>Engine estimate <span className="t-data text-fog-300">{formatLak(Number(i.estimate_unit_lak))}</span> / unit (context only)</span>}
                  {i.design_id && <Link href={`/admin/designs/?id=${i.design_id}`} className="text-fog-300 underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">Open design{i.design_version ? ` v${i.design_version}` : ""}</Link>}
                </p>
              </div>
            </div>
            <fieldset disabled={!editable} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr]">
              <label className="flex flex-col gap-1"><span className="t-label text-[0.5625rem] text-fog-500">Unit price (LAK)</span><input inputMode="numeric" value={d?.unit ?? ""} onChange={(e) => setDraft(i.id, { unit: e.target.value })} className={`${adminInput} t-data disabled:opacity-60`} placeholder="Set price" /></label>
              <label className="flex flex-col gap-1">
                <span className="t-label flex justify-between text-[0.5625rem] text-fog-500">Line total{d?.totalTouched && editable && <button type="button" onClick={() => setDraft(i.id, { totalTouched: false, total: "" })} className="text-yellow">Reset to auto</button>}</span>
                <input inputMode="numeric" value={d?.totalTouched ? d.total : total != null ? String(total) : ""} onChange={(e) => setDraft(i.id, { total: e.target.value, totalTouched: true })} className={`${adminInput} t-data disabled:opacity-60`} placeholder="unit × qty" />
              </label>
              <label className="col-span-2 flex flex-col gap-1 sm:col-span-1"><span className="t-label text-[0.5625rem] text-fog-500">Line note (customer sees this)</span><input value={d?.note ?? ""} onChange={(e) => setDraft(i.id, { note: e.target.value })} maxLength={500} className={`${adminInput} disabled:opacity-60`} /></label>
            </fieldset>
          </li>
        );
      })}
    </ol>
  );
}

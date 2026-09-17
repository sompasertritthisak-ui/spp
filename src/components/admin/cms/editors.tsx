"use client";
import { BRAND } from "@/lib/brand";
import { clsx } from "clsx";
import { useId, useMemo, useRef, useState } from "react";
import { parseBlocks } from "@/app/(site)/blog/_lib/markdown-lite";
import type { CaseHeading, Solution } from "@/content/types";
import { AreaField, FieldShell, inputCls, NumberField } from "../resource/fields";
import { useOptions } from "../resource/pickers";
import { RowsField } from "../resource/rows";

/* Bespoke editors for the jsonb / long-text columns. Each stores exactly the
   shape src/content/types.ts expects, so the static build needs no translation. */

const toolBtn = "t-label min-h-10 border border-ink-600 px-3 text-fog-300 hover:border-yellow hover:text-yellow disabled:opacity-40";

/** Markdown-lite (paragraphs, "## " headings, "- " lists) with a live preview using the site's own parser. */
export function MarkdownLiteField({ value, onChange, error, disabled }: { value: string; onChange: (v: string) => void; error: string | null; disabled: boolean }) {
  const id = useId();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<"write" | "preview">("write");
  const blocks = useMemo(() => parseBlocks(value), [value]);
  const prefixLine = (prefix: string) => {
    const el = ta.current;
    if (!el) return;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    onChange(`${value.slice(0, start)}${prefix}${value.slice(start)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(el.selectionStart + prefix.length, el.selectionStart + prefix.length); });
  };
  return (
    <FieldShell id={id} label="Body" required error={error} hint="Blank line = new paragraph · “## ” starts a heading · “- ” starts a list item. No HTML — it is shown as plain text.">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Body view" className="flex lg:hidden">
          {(["write", "preview"] as const).map((v) => <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={clsx(toolBtn, view === v && "border-yellow text-yellow")}>{v}</button>)}
        </div>
        <button type="button" disabled={disabled} onClick={() => prefixLine("## ")} className={toolBtn}>Heading</button>
        <button type="button" disabled={disabled} onClick={() => prefixLine("- ")} className={toolBtn}>List item</button>
        <span className="t-data ml-auto text-xs text-fog-500">{value.trim() ? value.trim().split(/\s+/).length : 0} words</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <textarea ref={ta} id={id} rows={18} disabled={disabled} aria-invalid={Boolean(error)} value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputCls, "resize-y py-3 font-mono text-[0.8125rem] leading-relaxed", view === "preview" && "hidden lg:block")} />
        <div aria-label="Preview" className={clsx("thin-scroll max-h-[32rem] overflow-y-auto border border-ink-700 bg-ink-950 p-4", view === "write" && "hidden lg:block")}>
          {blocks.length === 0 && <p className="text-sm text-fog-500">The preview appears here as you write.</p>}
          {blocks.map((b, i) => b.type === "h2" ? <h3 key={i} className="t-heading mb-2 mt-6 text-fog-50 first:mt-0">{b.text}</h3> : b.type === "ul" ? <ul key={i} className="mb-3 list-inside list-[square] text-sm leading-relaxed text-fog-300">{b.items.map((t, n) => <li key={n}>{t}</li>)}</ul> : <p key={i} className="mb-3 text-sm leading-relaxed text-fog-300">{b.text}</p>)}
        </div>
      </div>
    </FieldShell>
  );
}

export const estimateReadMins = (body: string) => Math.max(1, Math.round((body.trim() ? body.trim().split(/\s+/).length : 0) / 200));

export function ReadMinsField({ value, onChange, body, disabled }: { value: number | null; onChange: (v: number | null) => void; body: string; disabled: boolean }) {
  const est = estimateReadMins(body);
  return (
    <div className="flex items-end gap-2">
      <NumberField className="flex-1" label="Read time" suffix="min" min={1} max={60} step={1} disabled={disabled} value={value} onChange={onChange} hint={`Estimate from the body: ${est} min (200 words a minute).`} />
      <button type="button" disabled={disabled || value === est} onClick={() => onChange(est)} className={clsx(toolBtn, "mb-[1.625rem] min-h-11")}>Use {est}</button>
    </div>
  );
}

export const DEFAULT_PALETTE = [BRAND.gold, BRAND.ink, BRAND.white] as const;

export const CASE_HEADINGS: CaseHeading[] = ["The Client", "The Challenge", "The Idea", "The Approach", "The Design", "The Production", "The Result", "The Impact"];
type Study = { heading: CaseHeading; body: string }[];

/** Case-study chapters use a FIXED heading set, in a fixed order. Empty chapters are simply left out. */
export function StudyField({ value, onChange, disabled }: { value: unknown; onChange: (v: Study) => void; disabled: boolean }) {
  const study = useMemo<Study>(() => (Array.isArray(value) ? (value as Study).filter((s) => CASE_HEADINGS.includes(s?.heading)) : []), [value]);
  const set = (heading: CaseHeading, body: string) => onChange(CASE_HEADINGS.flatMap((h) => { const b = h === heading ? body : study.find((s) => s.heading === h)?.body ?? ""; return b.trim() ? [{ heading: h, body: b }] : []; }));
  return (
    <div className="grid gap-4">
      <p className="text-xs leading-relaxed text-fog-500">Write only the chapters that apply — {study.length} of {CASE_HEADINGS.length} are filled. They always appear in this order on the case-study page.</p>
      {CASE_HEADINGS.map((h, i) => <AreaField key={h} label={`${String(i + 1).padStart(2, "0")} · ${h}`} rows={3} maxLength={1600} disabled={disabled} value={study.find((s) => s.heading === h)?.body ?? ""} onChange={(v) => set(h, v)} />)}
    </div>
  );
}

export function ImpactField({ value, onChange, disabled }: { value: unknown; onChange: (v: { value: string; label: string }[]) => void; disabled: boolean }) {
  const rows = Array.isArray(value) ? (value as { value: string; label: string }[]).map((r) => ({ value: String(r?.value ?? ""), label: String(r?.label ?? "") })) : [];
  return <RowsField label="Impact figures" disabled={disabled} hint="Real, client-approved numbers only (e.g. “3,200” · “shirts delivered”). Leave empty rather than estimate." max={4} value={rows} onChange={onChange} blank={{ value: "", label: "" }} addLabel="Add figure" columns={[{ key: "value", label: "Figure", placeholder: "3,200" }, { key: "label", label: "What it measures", placeholder: "shirts delivered", grow: 2 }]} />;
}

/** Exactly three colours: the site uses them as the project's cover palette. */
export function PaletteField({ value, onChange, error, disabled }: { value: unknown; onChange: (v: string[]) => void; error: string | null; disabled: boolean }) {
  const id = useId();
  const pal = [0, 1, 2].map((i) => (Array.isArray(value) && typeof value[i] === "string" ? (value[i] as string) : DEFAULT_PALETTE[i]!));
  return (
    <FieldShell id={id} as="legend" label="Palette (3 colours)" error={error} hint="Primary, ground and highlight of the project — used for its cover art.">
      <div role="group" aria-labelledby={`${id}-lbl`} className="flex flex-wrap gap-3">
        {pal.map((c, i) => (
          <div key={i} className="flex gap-1">
            <input type="color" aria-label={`Colour ${i + 1} picker`} disabled={disabled} value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : "#000000"} onChange={(e) => onChange(pal.map((x, n) => (n === i ? e.target.value : x)))} className="h-11 w-11 cursor-pointer border border-ink-600 bg-ink-950 p-1" />
            <input aria-label={`Colour ${i + 1} hex`} disabled={disabled} value={c} maxLength={7} onChange={(e) => onChange(pal.map((x, n) => (n === i ? e.target.value.trim() : x)))} className={clsx(inputCls, "t-data w-28")} />
          </div>
        ))}
      </div>
    </FieldShell>
  );
}

const GROUPS: Solution["recommend"][number]["group"][] = ["Apparel", "Print", "Promotional", "Display", "Outdoor", "Digital"];
type Recommend = Solution["recommend"];

/** Solutions → recommend[]: fixed groups, each with items {label, product?, note?}. */
export function RecommendField({ value, onChange, disabled }: { value: unknown; onChange: (v: Recommend) => void; disabled: boolean }) {
  const rec = useMemo<Recommend>(() => (Array.isArray(value) ? (value as Recommend).filter((g) => GROUPS.includes(g?.group)) : []), [value]);
  const products = useOptions("products", "slug", "name");
  const productOptions = useMemo(() => [{ value: "", label: "— no product link —" }, ...products.options], [products.options]);
  const setGroup = (group: Recommend[number]["group"], rows: { label: string; product: string; note: string }[]) =>
    onChange(GROUPS.flatMap((g) => {
      const items = g === group ? rows.map((r) => ({ label: r.label, ...(r.product ? { product: r.product } : {}), ...(r.note.trim() ? { note: r.note } : {}) })) : rec.find((x) => x.group === g)?.items ?? [];
      return items.length ? [{ group: g, items }] : [];
    }));
  return (
    <div className="grid gap-5">
      <p className="text-xs leading-relaxed text-fog-500">What SPP recommends for this goal, by group. Groups without items are not shown. Link an item to a product so visitors can go straight to it.</p>
      {GROUPS.map((g) => (
        <RowsField key={g} label={g} disabled={disabled} addLabel={`Add to ${g}`} max={12} blank={{ label: "", product: "", note: "" }}
          value={(rec.find((x) => x.group === g)?.items ?? []).map((i) => ({ label: i.label ?? "", product: i.product ?? "", note: i.note ?? "" }))}
          onChange={(rows) => setGroup(g, rows)}
          columns={[{ key: "label", label: "Item", placeholder: "Staff polo shirts", grow: 2 }, { key: "product", label: "Product", options: productOptions, grow: 2 }, { key: "note", label: "Note", placeholder: "Optional note", grow: 2 }]} />
      ))}
    </div>
  );
}

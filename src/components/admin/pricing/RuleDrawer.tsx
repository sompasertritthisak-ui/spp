"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PricingRulesRow, ProductsRow } from "@/lib/backend/db-types";
import { DISCARD, useConfirm } from "../resource/Confirm";
import { DateField, NumberField, SelectField, TextField, ToggleField } from "../resource/fields";
import type { Values } from "../resource/types";
import { Drawer } from "../ui";
import { isMatchKind, KIND_META, matchValue, SENT_BY_SITE, tiersOverlap, type AmountType, type RuleKind } from "./rule-kinds";

type Form = { label: string; amount: number | null; amount_type: AmountType; option: string; min_qty: number | null; max_qty: number | null; starts_at: string | null; ends_at: string | null; active: boolean; asDiscount: boolean };
const METHODS = ["screen", "dtf", "sublimation", "embroidery", "uv", "offset", "large-format", "vinyl-cut"];
const TYPE_LABEL: Record<AmountType, string> = { percent: "Percent of the unit price", per_unit: "LAK per piece", flat: "LAK flat, once per order" };
const list = (p: ProductsRow | null, key: string): string[] => { const d = p?.data as Record<string, unknown> | null; return Array.isArray(d?.[key]) ? (d[key] as unknown[]).filter((x): x is string => typeof x === "string") : []; };

/** One purpose-built form per rule kind. `match` is always generated — never typed as JSON. */
export function RuleDrawer({ kind, rule, product, siblings, canWrite, saving, onSave, onClose }: { kind: RuleKind; rule: PricingRulesRow | null; product: ProductsRow | null; siblings: PricingRulesRow[]; canWrite: boolean; saving: boolean; onSave: (payload: Values) => Promise<boolean>; onClose: () => void }) {
  const meta = KIND_META[kind];
  const initial = useMemo<Form>(() => {
    const amt = rule ? Number(rule.amount) : null;
    const asDiscount = kind === "qty_tier" ? (amt ?? -1) <= 0 : false;
    return { label: rule?.label ?? "", amount: amt === null ? null : asDiscount ? Math.abs(amt) : amt, amount_type: (rule?.amount_type as AmountType | undefined) ?? meta.types[0]!, option: rule ? matchValue(rule) : "", min_qty: rule?.min_qty ?? (kind === "qty_tier" ? product?.moq ?? 1 : null), max_qty: rule?.max_qty ?? null, starts_at: rule?.starts_at ?? null, ends_at: rule?.ends_at ?? null, active: rule?.active ?? true, asDiscount };
  }, [rule, kind, meta.types, product?.moq]);
  const [f, setF] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, confirmUi] = useConfirm();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const close = async () => { if (!dirty || (await confirm(DISCARD))) onClose(); };

  const suggestions = kind === "method" ? (list(product, "printMethods").length ? list(product, "printMethods") : METHODS) : kind === "material" ? list(product, "materials") : kind === "size" ? list(product, "sizes") : [];
  const isPercent = f.amount_type === "percent";

  const save = async () => {
    const e: Record<string, string> = {};
    if (f.label.trim().length < 2) e.label = meta.customerLabel ? "Give the rule a label — customers see it as a line on their estimate." : "Give the rule a short internal label.";
    if (f.amount === null) e.amount = "Enter an amount.";
    else if (kind === "base" && f.amount <= 0) e.amount = "The base price must be more than zero.";
    else if (isPercent && Math.abs(f.amount) > 100) e.amount = "A percentage is between −100 and 100.";
    else if (f.asDiscount && f.amount < 0) e.amount = "Enter the discount as a positive number, e.g. 10 for 10% off.";
    if (isMatchKind(kind) && !f.option.trim()) e.option = "Say which option this rule applies to.";
    if (kind === "qty_tier") {
      if (f.min_qty === null || f.min_qty < 1) e.min_qty = "Enter the quantity the tier starts at.";
      else if (f.max_qty !== null && f.max_qty < f.min_qty) e.max_qty = "The upper limit cannot be below the lower limit.";
      else if (f.active) { const clash = siblings.find((s) => s.kind === "qty_tier" && s.active && s.id !== rule?.id && tiersOverlap({ min_qty: f.min_qty, max_qty: f.max_qty }, s)); if (clash) e.min_qty = `This range overlaps the active tier “${clash.label}” (${clash.min_qty ?? 1}–${clash.max_qty ?? "∞"}). Tiers must not overlap.`; }
    }
    if (kind === "seasonal") {
      if (!f.starts_at || !f.ends_at) e.ends_at = "A seasonal rule needs both a start and an end.";
      else if (new Date(f.ends_at) < new Date(f.starts_at)) e.ends_at = "The end cannot be before the start.";
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    const amount = f.asDiscount ? -Math.abs(f.amount!) : f.amount!;
    const ok = await onSave({ kind, label: f.label.trim(), amount, amount_type: f.amount_type, match: isMatchKind(kind) ? { [kind]: f.option.trim() } : {}, min_qty: kind === "qty_tier" ? f.min_qty : null, max_qty: kind === "qty_tier" ? f.max_qty : null, starts_at: kind === "seasonal" ? f.starts_at : null, ends_at: kind === "seasonal" ? f.ends_at : null, active: f.active });
    if (ok) onClose();
  };

  return (
    <Drawer open onClose={() => void close()} title={`${rule ? "Edit" : "New"} · ${meta.label}`} sub={<span className="flex flex-wrap gap-2"><span>{product ? product.name : "Global rule — every priced product"}</span>{dirty && <span className="t-label text-warn">Unsaved changes</span>}</span>}
      footer={canWrite ? <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>{rule ? "Save rule" : "Create rule"}</Button> : <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}>
      <p className="mb-5 text-sm leading-relaxed text-fog-400">{meta.blurb}{!SENT_BY_SITE.includes(kind) && " The public quote form does not send this option yet, so today this rule only affects the simulator and staff-side estimates."}</p>
      <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <TextField className="sm:col-span-2" label={meta.customerLabel ? "Label (shown to customers)" : "Label (internal)"} required disabled={!canWrite} value={f.label} onChange={(v) => set("label", v)} error={errors.label} maxLength={80} placeholder={kind === "seasonal" ? "Pi Mai offer" : kind === "method" ? "Embroidery" : ""} />
        {isMatchKind(kind) && (suggestions.length
          ? <SelectField className="sm:col-span-2" label={`Which ${kind}`} required disabled={!canWrite} value={f.option} onChange={(v) => set("option", v)} error={errors.option} placeholder="Choose…" options={[...new Set([...suggestions, ...(f.option ? [f.option] : [])])].map((s) => ({ value: s, label: s }))} hint={product ? `From this product's ${kind === "method" ? "print methods" : `${kind}s`}. The value must match exactly.` : undefined} />
          : <TextField className="sm:col-span-2" label={`Which ${kind}`} required disabled={!canWrite} value={f.option} onChange={(v) => set("option", v)} error={errors.option} hint="Must match the option value exactly as the quote form sends it." />)}
        {kind === "qty_tier" && <>
          <NumberField label="From quantity" required min={1} step={1} suffix="pcs" disabled={!canWrite} value={f.min_qty} onChange={(v) => set("min_qty", v)} error={errors.min_qty} />
          <NumberField label="Up to quantity" min={1} step={1} suffix="pcs" disabled={!canWrite} value={f.max_qty} onChange={(v) => set("max_qty", v)} error={errors.max_qty} hint="Leave empty for “and above”." />
        </>}
        {meta.types.length > 1 && <SelectField label="Charged as" disabled={!canWrite} value={f.amount_type} onChange={(v) => set("amount_type", v)} options={meta.types.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />}
        <NumberField label={kind === "base" ? "Unit price at MOQ" : f.asDiscount ? "Discount" : isPercent ? "Percent change" : "Amount"} required disabled={!canWrite} value={f.amount} onChange={(v) => set("amount", v)} error={errors.amount} suffix={isPercent ? "%" : "LAK"} step={isPercent ? 0.1 : 100}
          hint={kind === "base" ? "Confidential. Customers only ever see a ±8% band around the calculated price." : f.asDiscount ? "10 = 10% off the unit price." : isPercent ? "Positive = uplift, negative = discount." : undefined} />
        {kind === "qty_tier" && <ToggleField label="Direction" disabled={!canWrite} value={f.asDiscount} onChange={(v) => set("asDiscount", v)} onLabel="Discount (price goes down)" offLabel="Enter a signed percent instead" />}
        {kind === "seasonal" && <>
          <DateField label="Starts" required withTime disabled={!canWrite} value={f.starts_at} onChange={(v) => set("starts_at", v)} />
          <DateField label="Ends" required withTime disabled={!canWrite} value={f.ends_at} onChange={(v) => set("ends_at", v)} error={errors.ends_at} />
        </>}
        <ToggleField className="sm:col-span-2" label="Active" disabled={!canWrite} value={f.active} onChange={(v) => set("active", v)} onLabel="Active — used by the estimate engine immediately" offLabel="Switched off — kept but ignored" />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
      </form>
      {confirmUi}
    </Drawer>
  );
}

"use client";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { useMemo } from "react";
import { MediaField, MediaListField } from "../media/MediaField";
import { AreaField, DateField, FormSection, NumberField, SelectField, TagsField, TextField, ToggleField } from "../resource/fields";
import { MultiPick, SlugField, type PickOption } from "../resource/pickers";
import { CheckGroupField, RowsField } from "../resource/rows";
import { SeoField } from "../resource/seo";
import { PUBLISH_OPTIONS } from "../resource/status";
import { PRICING_MODES, PRINT_METHODS, type ProductForm } from "./product-form";

export type TabProps = { f: ProductForm; set: <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => void; errors: Record<string, string>; disabled: boolean };
const e = (errors: Record<string, string>, k: string) => errors[k] ?? null;

export function BasicsTab({ f, set, errors, disabled, productId, categories, onName, onSlug }: TabProps & { productId: string | null; categories: PickOption[]; onName: (v: string) => void; onSlug: (v: string) => void }) {
  const mode = PRICING_MODES.find((m) => m.value === f.pricing_mode);
  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Basics">
        <TextField label="Name" required disabled={disabled} value={f.name} onChange={onName} error={e(errors, "name")} maxLength={120} />
        <SelectField label="Category" required disabled={disabled} value={f.category_id} onChange={(v) => set("category_id", v)} options={categories} placeholder="Choose…" error={e(errors, "category_id")} />
        <SlugField className="sm:col-span-2" label="Slug" required disabled={disabled} value={f.slug} onChange={onSlug} source={f.name} table="products" excludeId={productId} prefix="/products/" error={e(errors, "slug")} />
        <AreaField className="sm:col-span-2" label="Summary" rows={2} maxLength={300} disabled={disabled} value={f.summary} onChange={(v) => set("summary", v)} error={e(errors, "summary")} hint="One sentence for cards and search results." />
        <AreaField className="sm:col-span-2" label="Description" rows={7} maxLength={6000} disabled={disabled} value={f.description} onChange={(v) => set("description", v)} error={e(errors, "description")} />
        <NumberField label="Minimum order (MOQ)" required min={1} step={1} suffix="pcs" disabled={disabled} value={f.moq} onChange={(v) => set("moq", v)} error={e(errors, "moq")} />
        <NumberField label="Order in lists" min={0} step={1} disabled={disabled} value={f.sort} onChange={(v) => set("sort", v)} error={e(errors, "sort")} hint="Lower numbers appear first." />
        <NumberField label="Lead time — shortest" min={0} step={1} suffix="days" disabled={disabled} value={f.lead_min_days} onChange={(v) => set("lead_min_days", v)} error={e(errors, "lead_min_days")} />
        <NumberField label="Lead time — longest" min={0} step={1} suffix="days" disabled={disabled} value={f.lead_max_days} onChange={(v) => set("lead_max_days", v)} error={e(errors, "lead_max_days")} hint="The shortest lead time also decides when the rush uplift applies." />
        <ToggleField label="Featured" disabled={disabled} value={f.featured} onChange={(v) => set("featured", v)} onLabel="Featured on the home page and showcases" offLabel="Not featured" />
      </FormSection>
      <FormSection title="Pricing shown to customers" note={<>The confidential rules (base price, tiers, methods, rush…) live in <Link className="text-yellow hover:text-fog-50" href={productId ? `/admin/pricing/?product=${productId}` : "/admin/pricing/"}>Pricing</Link>. Here you choose the mode and the public “from” hint.</>}>
        <SelectField label="Pricing mode" disabled={disabled} value={f.pricing_mode} onChange={(v) => set("pricing_mode", v)} options={PRICING_MODES} hint={mode?.help} />
        <TextField label="Price unit" required disabled={disabled} value={f.price_unit} onChange={(v) => set("price_unit", v)} error={e(errors, "price_unit")} placeholder="per piece" />
        <NumberField label="Public “from” price" min={0} step={100} suffix="LAK" disabled={disabled} value={f.price_from_lak} onChange={(v) => set("price_from_lak", v)} error={e(errors, "price_from_lak")} hint="A hint only (“from 55,000 ₭”). Leave empty to show no figure." />
      </FormSection>
      <FormSection title="Publishing" note="Saving updates the database straight away. The public page changes after the next “Publish site” (about 2–3 minutes).">
        <SelectField label="Status" disabled={disabled} value={f.status === "scheduled" ? "published" : f.status} onChange={(v) => set("status", v)} options={PUBLISH_OPTIONS} />
        {f.status === "published" || f.status === "scheduled" ? <DateField label="Go live from" withTime disabled={disabled} value={f.publish_at} onChange={(v) => set("publish_at", v)} hint="Optional. With a future date the product stays hidden until the first site build after that moment." /> : <div />}
        <p className="text-sm text-fog-400 sm:col-span-2">Public URL: <span className="t-data text-fog-200">/products/{f.slug || "…"}/</span></p>
      </FormSection>
    </div>
  );
}

export function DetailsTab({ f, set, errors, disabled }: TabProps) {
  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Options">
        <TagsField className="sm:col-span-2" label="Materials" disabled={disabled} value={f.materials} onChange={(v) => set("materials", v)} placeholder="e.g. 100% combed cotton, 180 gsm" hint="Pricing rules of kind “material” match these names exactly." />
        <TagsField className="sm:col-span-2" label="Sizes" disabled={disabled} value={f.sizes} onChange={(v) => set("sizes", v)} suggestions={["XS", "S", "M", "L", "XL", "2XL", "3XL"]} />
        <CheckGroupField className="sm:col-span-2" label="Print methods" disabled={disabled} options={PRINT_METHODS} value={f.printMethods} onChange={(v) => set("printMethods", v)} />
        <RowsField className="sm:col-span-2" label="Colours" addLabel="Add colour" disabled={disabled} value={f.colours} onChange={(v) => set("colours", v)} blank={{ name: "", hex: BRAND.garmentWhite }} error={e(errors, "colours")}
          columns={[{ key: "name", label: "Name", placeholder: "Navy" }, { key: "hex", label: "Hex", type: "colour" }]} hint="The first colour is the default in SPP Studio and in previews." />
        {f.colours.length > 0 && <div className="flex flex-wrap gap-1.5 sm:col-span-2" aria-label="Colour swatches">{f.colours.map((c, i) => <span key={i} title={`${c.name} ${c.hex}`} className="h-7 w-7 border border-ink-500" style={{ background: /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "transparent" }} />)}</div>}
      </FormSection>
      <FormSection title="Selling points">
        <TagsField className="sm:col-span-2" label="Customisation options" disabled={disabled} value={f.customisation} onChange={(v) => set("customisation", v)} placeholder="e.g. Individual names & numbers" />
        <TagsField className="sm:col-span-2" label="Use cases" disabled={disabled} value={f.useCases} onChange={(v) => set("useCases", v)} placeholder="e.g. Staff uniforms" />
      </FormSection>
    </div>
  );
}

export function MediaTab({ f, set, disabled, productId, products }: TabProps & { productId: string | null; products: PickOption[] }) {
  const others = useMemo(() => products.filter((p) => p.value !== productId), [products, productId]);
  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Images">
        <MediaField className="sm:col-span-2" label="Cover image" disabled={disabled} category="products" value={f.cover_media_id} onChange={(v) => set("cover_media_id", v)} />
        <MediaListField className="sm:col-span-2" label="Gallery" disabled={disabled} category="products" value={f.gallery} onChange={(v) => set("gallery", v)} hint="Shown in this order on the product page." />
      </FormSection>
      <FormSection title="Related products">
        <MultiPick className="sm:col-span-2" label="Customers also look at" disabled={disabled} max={8} options={others} value={f.related} onChange={(v) => set("related", v)} emptyText="No related products chosen." />
      </FormSection>
    </div>
  );
}

export function SeoTab({ f, set, errors, disabled }: TabProps) {
  return (
    <div>
      {errors.seo && <p role="alert" className="mb-3 text-sm text-danger">{errors.seo}</p>}
      <SeoField value={f.seo} onChange={(v) => set("seo", v)} disabled={disabled} fallbackTitle={f.name} fallbackDescription={f.summary} path={`/products/${f.slug || "…"}/`} />
    </div>
  );
}

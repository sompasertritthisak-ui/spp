"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { BundleItemsRow, BundlesRow, PublishStatus } from "@/lib/backend/db-types";
import { DISCARD, useConfirm } from "../resource/Confirm";
import { adminError } from "../resource/errors";
import { AreaField, FormSection, NumberField, SelectField, TextField, ToggleField } from "../resource/fields";
import { SlugField, type PickOption } from "../resource/pickers";
import { RowsField } from "../resource/rows";
import { PUBLISH_OPTIONS, SLUG_RE, slugify } from "../resource/status";
import type { Values } from "../resource/types";
import { Drawer, ErrorNote, StatusPill } from "../ui";

type Item = { product_id: string; qty: number; note: string };
type Form = { name: string; slug: string; summary: string; discount_pct: number | null; featured: boolean; status: PublishStatus; items: Item[] };
export type BundleActions = { create: (v: Values, o?: { quiet?: boolean }) => Promise<BundlesRow | null>; update: (id: string, v: Values, o?: { quiet?: boolean; message?: string }) => Promise<BundlesRow | null>; remove: (id: string) => Promise<boolean>; duplicate: (b: BundlesRow) => Promise<void> };

const schema = z.object({
  name: z.string().trim().min(2, "Give the bundle a name.").max(120),
  slug: z.string().regex(SLUG_RE, "Lowercase letters, numbers and single hyphens only."),
  discount_pct: z.number({ error: "Enter a discount between 0 and 100." }).min(0, "The discount cannot be negative.").max(100, "The discount cannot exceed 100%."),
  items: z.array(z.object({ product_id: z.string().min(1, "Choose a product on every row — or remove the empty row."), qty: z.number().int("Quantities are whole numbers.").min(1, "Quantities must be at least 1.") })).min(1, "A bundle needs at least one product."),
});

export function BundleDrawer({ bundle, ...rest }: { bundle: BundlesRow | null; canWrite: boolean; saving: boolean; products: PickOption[]; actions: BundleActions; onClose: () => void; onChanged: () => void }) {
  const items = useQuery<BundleItemsRow[]>(() => (bundle ? backend()!.from("bundle_items").select("*").eq("bundle_id", bundle.id).order("sort") : Promise.resolve([] as BundleItemsRow[])), [bundle?.id]);
  if (!items.data) return <Drawer open onClose={rest.onClose} title={bundle?.name ?? "New bundle"}>{items.error ? <ErrorNote message={items.error} onRetry={() => void items.reload()} /> : <div className="skeleton h-64" />}</Drawer>;
  return <BundleForm key={bundle?.id ?? "new"} bundle={bundle} stored={items.data} {...rest} />;
}

function BundleForm({ bundle, stored, canWrite, saving, products, actions, onClose, onChanged }: { bundle: BundlesRow | null; stored: BundleItemsRow[]; canWrite: boolean; saving: boolean; products: PickOption[]; actions: BundleActions; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const initial = useMemo<Form>(() => ({ name: bundle?.name ?? "", slug: bundle?.slug ?? "", summary: bundle?.summary ?? "", discount_pct: bundle ? Number(bundle.discount_pct) : 0, featured: bundle?.featured ?? false, status: bundle?.status ?? "draft", items: stored.map((i) => ({ product_id: i.product_id, qty: i.qty, note: i.note })) }), [bundle, stored]);
  const [f, setF] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(bundle !== null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmUi] = useConfirm();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const close = async () => { if (!dirty || (await confirm(DISCARD))) onClose(); };
  const options = useMemo(() => [{ value: "", label: "Choose a product…" }, ...products], [products]);

  const save = async () => {
    const r = schema.safeParse(f);
    const e: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
    if (new Set(f.items.map((i) => i.product_id)).size !== f.items.length) e.items ??= "A product appears twice — combine the rows into one quantity.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const payload = { name: f.name.trim(), slug: f.slug, summary: f.summary.trim(), discount_pct: f.discount_pct ?? 0, featured: f.featured, status: f.status };
    const saved = bundle ? await actions.update(bundle.id, payload, { quiet: true }) : await actions.create(payload, { quiet: true });
    if (!saved) return setBusy(false);
    // items are replaced as a set: the list is short, and order/qty/note may all have changed
    const b = backend()!;
    const del = stored.length ? await b.from("bundle_items").delete().eq("bundle_id", saved.id) : { error: null };
    const ins = del.error ? del : await b.from("bundle_items").insert(f.items.map((i, n) => ({ bundle_id: saved.id, product_id: i.product_id, qty: i.qty, note: i.note.trim(), sort: n })));
    setBusy(false);
    if (ins.error) { toast(`The bundle was saved, but its items were not: ${adminError(ins.error)}`, "danger"); onChanged(); return; }
    toast(bundle ? "Bundle saved. It reaches the site at the next publish." : "Bundle created.", "ok");
    onChanged();
    onClose();
  };
  const archive = async () => {
    if (!bundle) return;
    const to = bundle.status === "archived" ? "draft" : "archived";
    if (to === "archived" && !(await confirm({ title: "Archive this bundle?", body: "It disappears from the site at the next publish. Nothing is deleted.", confirmLabel: "Archive" }))) return;
    if (await actions.update(bundle.id, { status: to }, { message: to === "archived" ? "Bundle archived." : "Restored as a draft." })) onClose();
  };
  const del = async () => {
    if (!bundle || !(await confirm({ title: "Delete this bundle?", danger: true, confirmLabel: "Delete permanently", body: <>“{bundle.name}” and its item list will be permanently deleted. Solutions that point at it will lose their suggested bundle.</> }))) return;
    if (await actions.remove(bundle.id)) onClose();
  };

  return (
    <Drawer open onClose={() => void close()} title={bundle ? bundle.name : "New bundle"} sub={<span className="flex flex-wrap items-center gap-2">{bundle && <StatusPill status={bundle.status} />}{dirty && <span className="t-label text-warn">Unsaved changes</span>}{!canWrite && <span className="t-label text-fog-500">Read-only for your role</span>}</span>}
      footer={canWrite ? <>{bundle && <Button variant="danger" size="sm" className="mr-auto" onClick={() => void del()}>Delete</Button>}{bundle && <Button variant="ghost" size="sm" onClick={() => void archive()}>{bundle.status === "archived" ? "Restore" : "Archive"}</Button>}{bundle && <Button variant="ghost" size="sm" disabled={dirty} title={dirty ? "Save first, then duplicate" : undefined} onClick={() => void actions.duplicate(bundle)}>Duplicate</Button>}<Button size="sm" loading={busy || saving} disabled={!dirty} onClick={() => void save()}>{bundle ? "Save changes" : "Create bundle"}</Button></> : <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}>
      <form noValidate className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <FormSection title="Bundle">
          <TextField label="Name" required disabled={!canWrite} value={f.name} error={errors.name} onChange={(v) => { set("name", v); if (!slugTouched) setF((p) => ({ ...p, slug: slugify(v) })); }} />
          <NumberField label="Bundle discount" required min={0} max={100} step={0.5} suffix="%" disabled={!canWrite} value={f.discount_pct} onChange={(v) => set("discount_pct", v)} error={errors.discount_pct} />
          <SlugField className="sm:col-span-2" label="Slug" required disabled={!canWrite} value={f.slug} onChange={(v) => { setSlugTouched(true); set("slug", v); }} source={f.name} table="bundles" excludeId={bundle?.id} error={errors.slug} />
          <AreaField className="sm:col-span-2" label="Summary" rows={3} maxLength={400} disabled={!canWrite} value={f.summary} onChange={(v) => set("summary", v)} />
          <ToggleField label="Featured" disabled={!canWrite} value={f.featured} onChange={(v) => set("featured", v)} onLabel="Featured" offLabel="Not featured" />
          <SelectField label="Status" disabled={!canWrite} value={f.status === "scheduled" ? "draft" : f.status} onChange={(v) => set("status", v)} options={PUBLISH_OPTIONS} />
        </FormSection>
        <FormSection title="What is in it" note={<>The discount is shown to customers as “save {f.discount_pct ?? 0}% as a bundle” and is applied by staff when the quote is written — the online estimate engine prices products one by one. Product prices are managed in <Link href="/admin/pricing/" className="text-yellow hover:text-fog-50">Pricing</Link>.</>}>
          <RowsField className="sm:col-span-2" label="Items" required addLabel="Add product" max={20} disabled={!canWrite} value={f.items} onChange={(v) => set("items", v)} blank={{ product_id: "", qty: 1, note: "" }} error={errors.items}
            columns={[{ key: "product_id", label: "Product", options, grow: 3 }, { key: "qty", label: "Qty", type: "number" }, { key: "note", label: "Note", placeholder: "Optional note", grow: 2 }]} />
        </FormSection>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
      </form>
      {confirmUi}
    </Drawer>
  );
}

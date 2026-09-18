"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { ProductsRow } from "@/lib/backend/db-types";
import { DISCARD, useConfirm } from "../resource/Confirm";
import type { PickOption } from "../resource/pickers";
import { displayStatus, slugify } from "../resource/status";
import type { Values } from "../resource/types";
import { ErrorNote, Panel, StatusPill, Tabs } from "../ui";
import { FIELD_TAB, loadLinks, saveLinks, toForm, toRow, validateProduct, type ProductForm, type TabKey } from "./product-form";
import { BasicsTab, DetailsTab, MediaTab, SeoTab } from "./ProductTabs";
import { StudioTab } from "./StudioTab";
import { VariantsPanel } from "./VariantsPanel";

export type ProductActions = {
  create: (v: Values) => Promise<ProductsRow | null>;
  update: (id: string, v: Values, o?: { quiet?: boolean; message?: string }) => Promise<ProductsRow | null>;
  remove: (id: string) => Promise<boolean>;
  duplicate: (row: ProductsRow) => Promise<void>;
};
type Shared = { canWrite: boolean; saving: boolean; actions: ProductActions; categories: PickOption[]; products: PickOption[]; onBack: () => void; onCreated: (id: string) => void };

/** Loads the product's gallery + relations, then mounts the form with complete initial state. */
export function ProductEditor({ row, ...rest }: Shared & { row: ProductsRow | null }) {
  const links = useQuery(() => (row ? loadLinks(row.id) : Promise.resolve({ gallery: [], related: [] })), [row?.id]);
  if (links.error) return <ErrorNote message={links.error} onRetry={() => void links.reload()} />;
  if (!links.data) return <div className="skeleton h-96" />;
  return <EditorForm key={row?.id ?? "new"} row={row} links={links.data} reloadLinks={() => void links.reload()} {...rest} />;
}

const TABS: { value: TabKey; label: string }[] = [{ value: "basics", label: "Basics & pricing" }, { value: "details", label: "Options & colours" }, { value: "media", label: "Media & related" }, { value: "variants", label: "Variants" }, { value: "seo", label: "SEO" }, { value: "studio", label: "Studio" }];

function EditorForm({ row, links, reloadLinks, canWrite, saving, actions, categories, products, onBack, onCreated }: Shared & { row: ProductsRow | null; links: { gallery: string[]; related: string[] }; reloadLinks: () => void }) {
  const toast = useToast();
  const initial = useMemo(() => toForm(row, links.gallery, links.related), [row, links]);
  const [f, setF] = useState<ProductForm>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabKey>("basics");
  const [slugTouched, setSlugTouched] = useState(row !== null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmUi] = useConfirm();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const disabled = !canWrite;

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => { setF((p) => ({ ...p, [k]: v })); if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const back = async () => { if (!dirty || (await confirm(DISCARD))) onBack(); };

  const save = async () => {
    const found = validateProduct(f);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) { setTab(FIELD_TAB[first] ?? "basics"); toast(`${Object.keys(found).length === 1 ? "One field needs" : "Some fields need"} attention before saving.`, "danger"); return; }
    setBusy(true);
    const saved = row ? await actions.update(row.id, toRow(f, row), { quiet: true }) : await actions.create(toRow(f, null));
    if (!saved) return setBusy(false); // the reason was toasted; the form stays as it is
    const problems = (await Promise.all([saveLinks("product_media", saved.id, "media_id", links.gallery, f.gallery), saveLinks("product_relations", saved.id, "related_id", links.related, f.related)])).filter((x): x is string => x !== null);
    setBusy(false);
    if (problems.length) { toast(`The product was saved, but its ${problems.length === 2 ? "gallery and related products were" : "gallery or related products were"} not: ${problems[0]}`, "danger"); if (!row) onCreated(saved.id); return; }
    toast(row ? "Product saved. It reaches the site at the next publish." : "Product created as a draft.", "ok");
    if (row) reloadLinks(); else onCreated(saved.id);
  };
  const archive = async () => {
    if (!row) return;
    const to = row.status === "archived" ? "draft" : "archived";
    if (to === "archived" && !(await confirm({ title: "Archive this product?", body: "It disappears from the catalogue at the next publish. Quotes and orders that mention it are unaffected.", confirmLabel: "Archive" }))) return;
    const r = await actions.update(row.id, { status: to }, { message: to === "archived" ? "Product archived." : "Restored as a draft." });
    if (r) setF((p) => ({ ...p, status: r.status }));
  };
  const del = async () => {
    if (!row || !(await confirm({ title: "Delete this product?", danger: true, confirmLabel: "Delete permanently", body: <>“{row.name}”, its variants, gallery links and pricing rules will be permanently deleted. Products that appear in quotes or orders are better archived. This cannot be undone.</> }))) return;
    if (await actions.remove(row.id)) onBack();
  };

  const tabProps = { f, set, errors, disabled };
  const tabErrors = (t: TabKey) => Object.keys(errors).filter((k) => (FIELD_TAB[k] ?? "basics") === t).length;
  return (
    <div>
      <div className="sticky top-16 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <Button variant="ghost" size="sm" onClick={() => void back()}>← Products</Button>
        <div className="mr-auto min-w-0">
          <h2 className="t-heading truncate text-fog-50">{row ? row.name : "New product"}</h2>
          <p className="flex flex-wrap items-center gap-2 text-xs">{row && <StatusPill status={displayStatus(row)} />}{dirty && <span className="t-label text-warn">Unsaved changes</span>}{disabled && <span className="t-label text-fog-500">Read-only for your role</span>}</p>
        </div>
        {canWrite && (
          <>
            {row && <Button variant="danger" size="sm" onClick={() => void del()}>Delete</Button>}
            {row && <Button variant="ghost" size="sm" onClick={() => void archive()}>{row.status === "archived" ? "Restore" : "Archive"}</Button>}
            {row && <Button variant="ghost" size="sm" disabled={dirty} title={dirty ? "Save first, then duplicate" : undefined} onClick={() => void actions.duplicate(row)}>Duplicate</Button>}
            <Button size="sm" loading={busy || saving} disabled={!dirty} onClick={() => void save()}>{row ? "Save changes" : "Create product"}</Button>
          </>
        )}
      </div>
      <Tabs label="Product sections" value={tab} onChange={setTab} tabs={TABS.map((t) => ({ ...t, count: tabErrors(t.value) || null }))} />
      <Panel>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
          {tab === "basics" && <BasicsTab {...tabProps} productId={row?.id ?? null} categories={categories} onName={(v) => { set("name", v); if (!slugTouched) setF((p) => ({ ...p, slug: slugify(v) })); }} onSlug={(v) => { setSlugTouched(true); set("slug", v); }} />}
          {tab === "details" && <DetailsTab {...tabProps} />}
          {tab === "media" && <MediaTab {...tabProps} productId={row?.id ?? null} products={products} />}
          {tab === "seo" && <SeoTab {...tabProps} />}
          {tab === "studio" && <StudioTab {...tabProps} />}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
        </form>
        {tab === "variants" && (row ? <VariantsPanel productId={row.id} disabled={disabled} /> : <p className="text-sm text-fog-400">Create the product first — variants are attached to a saved product.</p>)}
      </Panel>
      {confirmUi}
    </div>
  );
}

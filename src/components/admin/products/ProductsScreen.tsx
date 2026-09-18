"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { canDo, useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import type { ProductsRow } from "@/lib/backend/db-types";
import { formatLak } from "@/lib/format";
import { PublishSite } from "../cms/PublishSite";
import { adminError } from "../resource/errors";
import { inputCls } from "../resource/fields";
import { useOptions } from "../resource/pickers";
import { displayStatus } from "../resource/status";
import { useResource } from "../resource/useResource";
import { useParam, useSelection } from "../resource/useSelection";
import { DataTable, ErrorNote, PageHeader, Panel, Stat, StatusPill, Tabs } from "../ui";
import { ProductEditor } from "./ProductEditor";
import { PRICING_MODES } from "./product-form";

type StatusTab = "all" | "draft" | "scheduled" | "published" | "archived";
const hasSeo = (p: ProductsRow) => { const d = p.data as { seo?: { title?: string; description?: string } } | null; return Boolean(d?.seo?.description); };

export function ProductsScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const canWrite = canDo(profile?.role, "catalogue");
  const sel = useSelection();
  const res = useResource("products", { order: [{ column: "sort" }, { column: "name" }], singular: "Product" });
  const cats = useOptions("categories", "id", "name");
  const [q, setQ] = useState("");
  const [status, setStatus] = useParam<StatusTab>("status", "all");
  const [cat, setCat] = useParam<string>("category", "all");
  const [mode, setMode] = useParam<string>("mode", "all");
  const [featured, setFeatured] = useState(false);

  const rows = useMemo(() => res.rows ?? [], [res.rows]);
  const catName = useMemo(() => new Map(cats.options.map((c) => [c.value, c.label])), [cats.options]);
  const productOptions = useMemo(() => rows.filter((p) => !p.id.startsWith("tmp-")).map((p) => ({ value: p.id, label: p.name, hint: p.status })), [rows]);
  const counts = useMemo(() => { const c: Record<StatusTab, number> = { all: rows.length, draft: 0, scheduled: 0, published: 0, archived: 0 }; for (const p of rows) { const s = displayStatus(p) as StatusTab; if (s in c && s !== "all") c[s]++; } return c; }, [rows]);
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return rows.filter((p) => (status === "all" || displayStatus(p) === status) && (cat === "all" || p.category_id === cat) && (mode === "all" || p.pricing_mode === mode) && (!featured || p.featured) && (!t || `${p.name} ${p.slug} ${p.summary}`.toLowerCase().includes(t))); }, [rows, q, status, cat, mode, featured]);
  const live = rows.filter((p) => p.status === "published");
  const needsWork = live.filter((p) => !p.cover_media_id || !hasSeo(p)).length;

  const duplicate = async (src: ProductsRow) => {
    const taken = new Set(rows.map((p) => p.slug));
    let slug = `${src.slug}-copy`;
    for (let n = 2; taken.has(slug); n++) slug = `${src.slug}-copy-${n}`;
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = src;
    void _id; void _c; void _u;
    const made = await res.create({ ...rest, slug, name: `${src.name} (copy)`, status: "draft", featured: false, publish_at: null }, { quiet: true });
    if (!made) return;
    const b = backend()!;
    const [v, g, r] = await Promise.all([b.from("product_variants").select("name,attrs,active").eq("product_id", src.id), b.from("product_media").select("media_id,sort").eq("product_id", src.id), b.from("product_relations").select("related_id,sort").eq("product_id", src.id)]);
    const writes = await Promise.all([
      v.data?.length ? b.from("product_variants").insert(v.data.map((x) => ({ ...x, sku: null, product_id: made.id }))) : null,
      g.data?.length ? b.from("product_media").insert(g.data.map((x) => ({ ...x, product_id: made.id }))) : null,
      r.data?.length ? b.from("product_relations").insert(r.data.map((x) => ({ ...x, product_id: made.id }))) : null,
    ]);
    const bad = [v, g, r, ...writes].find((x) => x?.error);
    toast(bad?.error ? `Copied, but some variants, images or relations were not: ${adminError(bad.error)}` : "Product duplicated as a draft (variant SKUs were cleared — they must be unique).", bad?.error ? "danger" : "ok");
    sel.open(made.id);
  };

  const selected = sel.id ? rows.find((p) => p.id === sel.id) ?? null : null;
  const editing = (sel.isNew && canWrite) || selected;
  const select = clsx(inputCls, "w-auto pr-8");

  return (
    <div>
      <PageHeader title="Products" sub="The catalogue customers browse, customise and request quotes from." actions={<><PublishSite compact />{canWrite && !editing && <Button size="sm" className="min-h-11" onClick={sel.openNew}>New product</Button>}</>} />
      {editing ? (
        <ProductEditor row={selected} canWrite={canWrite} saving={res.saving} categories={cats.options} products={productOptions} onBack={sel.close} onCreated={sel.open} actions={{ create: res.create, update: res.update, remove: res.remove, duplicate }} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Live, missing cover or SEO" value={res.rows ? needsWork : "—"} tone={needsWork ? "danger" : "ok"} hint="Published products that need attention" />
            <Stat label="Published" value={res.rows ? counts.published : "—"} />
            <Stat label="Drafts" value={res.rows ? counts.draft : "—"} tone={counts.draft ? "yellow" : "neutral"} />
            <Stat label="Scheduled" value={res.rows ? counts.scheduled : "—"} />
            <Stat label="Featured" value={res.rows ? rows.filter((p) => p.featured).length : "—"} />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" placeholder="Search name, slug or summary…" className={clsx(inputCls, "min-w-0 flex-1 basis-full sm:basis-64")} />
            <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className={select}><option value="all">All categories</option>{cats.options.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            <select aria-label="Pricing mode" value={mode} onChange={(e) => setMode(e.target.value)} className={select}><option value="all">All pricing modes</option>{PRICING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
            <button type="button" aria-pressed={featured} onClick={() => setFeatured((v) => !v)} className={clsx("t-label min-h-11 border px-3", featured ? "border-yellow text-yellow" : "border-ink-600 text-fog-400 hover:text-fog-50")}>Featured</button>
          </div>
          <Tabs label="Products by status" value={status} onChange={setStatus} tabs={(["all", "draft", "scheduled", "published", "archived"] as StatusTab[]).map((s) => ({ value: s, label: s, count: res.rows ? counts[s] : null }))} />
          <ErrorNote message={res.error ?? cats.error} onRetry={() => void res.reload()} />
          {sel.id && !selected && res.rows && <ErrorNote message="That product no longer exists, or your role cannot see it." />}
          <Panel flush>
            <DataTable caption="Products" rows={res.error ? [] : shown} loading={res.loading} rowKey={(p) => p.id} onRowClick={(p) => !p.id.startsWith("tmp-") && sel.open(p.id)}
              empty={rows.length ? "Nothing matches those filters." : `No products yet.${canWrite ? " Create the first one with “New product”." : ""}`}
              columns={[
                { key: "name", header: "Product", cell: (p) => <span className="block max-w-xs"><span className="block truncate text-fog-50">{p.name}</span><span className="t-data block truncate text-xs text-fog-500">{p.slug}</span></span> },
                { key: "cat", header: "Category", hideBelow: "md", cell: (p) => <span className="text-fog-300">{catName.get(p.category_id) ?? "—"}</span> },
                { key: "mode", header: "Pricing", hideBelow: "sm", cell: (p) => <span><span className="t-label block text-fog-300">{p.pricing_mode === "quote" ? "quote" : p.pricing_mode}</span><span className="t-data block text-xs text-fog-500">{p.price_from_lak == null ? "no “from” price" : `from ${formatLak(Number(p.price_from_lak))}`}</span></span> },
                { key: "moq", header: "MOQ", hideBelow: "lg", cell: (p) => <span className="t-data text-fog-300">{p.moq}</span> },
                { key: "status", header: "Status", cell: (p) => <StatusPill status={displayStatus(p)} /> },
                { key: "featured", header: "Featured", cell: (p) => (
                  <button type="button" role="switch" aria-checked={p.featured} aria-label={`${p.name} featured`} disabled={!canWrite || p.id.startsWith("tmp-")} onClick={(e) => { e.stopPropagation(); void res.update(p.id, { featured: !p.featured }, { message: p.featured ? "No longer featured." : "Featured." }); }} onKeyDown={(e) => e.stopPropagation()}
                    className={clsx("t-label min-h-9 border px-2 text-[0.625rem] disabled:opacity-50", p.featured ? "border-yellow/60 text-yellow" : "border-ink-600 text-fog-500 hover:text-fog-50")}>{p.featured ? "Featured" : "Off"}</button>
                ) },
              ]} />
          </Panel>
        </>
      )}
    </div>
  );
}

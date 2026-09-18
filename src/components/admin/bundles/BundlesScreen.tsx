"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { canDo, useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { BundlesRow } from "@/lib/backend/db-types";
import { PublishSite } from "../cms/PublishSite";
import { adminError } from "../resource/errors";
import { inputCls } from "../resource/fields";
import { useOptions } from "../resource/pickers";
import { useResource } from "../resource/useResource";
import { useSelection } from "../resource/useSelection";
import { DataTable, ErrorNote, PageHeader, Panel, StatusPill, Tabs } from "../ui";
import { BundleDrawer } from "./BundleDrawer";

type Tab = "all" | "draft" | "published" | "archived";

export function BundlesScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const canWrite = canDo(profile?.role, "catalogue");
  const sel = useSelection();
  const res = useResource("bundles", { order: [{ column: "name" }], singular: "Bundle" });
  const products = useOptions("products", "id", "name", "status");
  const itemRows = useQuery<{ bundle_id: string }[]>(() => backend()!.from("bundle_items").select("bundle_id"), []);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  const rows = useMemo(() => res.rows ?? [], [res.rows]);
  const itemCount = useMemo(() => { const m = new Map<string, number>(); for (const i of itemRows.data ?? []) m.set(i.bundle_id, (m.get(i.bundle_id) ?? 0) + 1); return m; }, [itemRows.data]);
  const counts = useMemo(() => ({ all: rows.length, draft: rows.filter((b) => b.status === "draft").length, published: rows.filter((b) => b.status === "published").length, archived: rows.filter((b) => b.status === "archived").length }), [rows]);
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return rows.filter((b) => (tab === "all" || b.status === tab) && (!t || `${b.name} ${b.slug}`.toLowerCase().includes(t))); }, [rows, q, tab]);
  const empty = rows.filter((b) => b.status === "published" && itemRows.data && !itemCount.get(b.id)).length;

  const duplicate = async (src: BundlesRow) => {
    const taken = new Set(rows.map((b) => b.slug));
    let slug = `${src.slug}-copy`;
    for (let n = 2; taken.has(slug); n++) slug = `${src.slug}-copy-${n}`;
    const made = await res.create({ name: `${src.name} (copy)`, slug, summary: src.summary, discount_pct: src.discount_pct, featured: false, status: "draft" }, { quiet: true });
    if (!made) return;
    const items = await backend()!.from("bundle_items").select("product_id,qty,note,sort").eq("bundle_id", src.id);
    const ins = items.data?.length ? await backend()!.from("bundle_items").insert(items.data.map((i) => ({ ...i, bundle_id: made.id }))) : null;
    const bad = items.error ?? ins?.error;
    toast(bad ? `Copied, but the items were not: ${adminError(bad)}` : "Bundle duplicated as a draft.", bad ? "danger" : "ok");
    void itemRows.reload();
    sel.open(made.id);
  };
  const selected = sel.id ? rows.find((b) => b.id === sel.id) ?? null : null;

  return (
    <div>
      <PageHeader title="Bundles" sub="Ready-made product sets with a bundle discount — shown on Solutions and the bundles page." actions={<><PublishSite compact />{canWrite && <Button size="sm" className="min-h-11" onClick={sel.openNew}>New bundle</Button>}</>} />
      {empty > 0 && <p role="status" className="mb-4 border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-fog-50">{empty} published bundle{empty > 1 ? "s have" : " has"} no products in {empty > 1 ? "them" : "it"}. Add items or move {empty > 1 ? "them" : "it"} back to draft.</p>}
      <div className="mb-4"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bundles" placeholder="Search bundles…" className={clsx(inputCls, "sm:max-w-sm")} /></div>
      <Tabs label="Bundles by status" value={tab} onChange={setTab} tabs={(["all", "draft", "published", "archived"] as Tab[]).map((t) => ({ value: t, label: t, count: res.rows ? counts[t] : null }))} />
      <ErrorNote message={res.error} onRetry={() => void res.reload()} />
      <Panel flush>
        <DataTable caption="Bundles" rows={res.error ? [] : shown} loading={res.loading} rowKey={(b) => b.id} onRowClick={(b) => !b.id.startsWith("tmp-") && sel.open(b.id)} empty={rows.length ? "Nothing matches that filter." : `No bundles yet.${canWrite ? " Create the first one with “New bundle”." : ""}`}
          columns={[
            { key: "name", header: "Bundle", cell: (b) => <span><span className="block text-fog-50">{b.name}</span><span className="t-data block text-xs text-fog-500">{b.slug}</span></span> },
            { key: "items", header: "Items", cell: (b) => <span className={clsx("t-data", itemRows.data && !itemCount.get(b.id) ? "text-warn" : "text-fog-300")}>{itemRows.data ? itemCount.get(b.id) ?? 0 : "…"}</span> },
            { key: "disc", header: "Discount", hideBelow: "sm", cell: (b) => <span className="t-data text-fog-300">{Number(b.discount_pct)}%</span> },
            { key: "status", header: "Status", cell: (b) => <StatusPill status={b.status} /> },
            { key: "featured", header: "Featured", cell: (b) => <button type="button" role="switch" aria-checked={b.featured} aria-label={`${b.name} featured`} disabled={!canWrite || b.id.startsWith("tmp-")} onKeyDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); void res.update(b.id, { featured: !b.featured }, { message: b.featured ? "No longer featured." : "Featured." }); }} className={clsx("t-label min-h-9 border px-2 text-[0.625rem] disabled:opacity-50", b.featured ? "border-yellow/60 text-yellow" : "border-ink-600 text-fog-500 hover:text-fog-50")}>{b.featured ? "Featured" : "Off"}</button> },
          ]} />
      </Panel>
      {sel.id && !selected && res.rows && <ErrorNote message="That bundle no longer exists, or your role cannot see it." />}
      {((sel.isNew && canWrite) || selected) && <BundleDrawer bundle={selected} canWrite={canWrite} saving={res.saving} products={products.options} onClose={sel.close} onChanged={() => void itemRows.reload()} actions={{ create: res.create, update: res.update, remove: res.remove, duplicate }} />}
    </div>
  );
}

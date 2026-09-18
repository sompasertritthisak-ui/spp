"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { canDo, useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { PricingRulesRow, ProductsRow } from "@/lib/backend/db-types";
import { useConfirm } from "../resource/Confirm";
import { inputCls } from "../resource/fields";
import { useResource } from "../resource/useResource";
import { useParam, useSelection } from "../resource/useSelection";
import { ErrorNote, PageHeader, Panel, StatusPill } from "../ui";
import { KIND_META, productProblems, RULE_KINDS, ruleSummary, type RuleKind } from "./rule-kinds";
import { RuleDrawer } from "./RuleDrawer";
import { Simulator } from "./Simulator";

export function PricingScreen() {
  const { profile } = useAuth();
  const canWrite = canDo(profile?.role, "pricing");
  const canRead = canWrite || canDo(profile?.role, "sales");
  const rules = useResource("pricing_rules", { order: [{ column: "created_at", ascending: false }], singular: "Rule" });
  const products = useQuery<ProductsRow[]>(() => backend()!.from("products").select("*").order("name"), [], { enabled: canRead });
  const flag = useQuery<{ enabled: boolean } | null>(() => backend()!.from("feature_flags").select("enabled").eq("key", "ONLINE_PRICING").maybeSingle(), [], { enabled: canRead });
  const [scope, setScope] = useParam<string>("product", "global", ["rule", "newrule"]);
  const sel = useSelection("rule", "_");
  const [newKind, setNewKind] = useParam<string>("newrule", "");
  const [confirm, confirmUi] = useConfirm();

  const online = flag.data?.enabled ?? false;
  const product = scope === "global" ? null : products.data?.find((p) => p.id === scope) ?? null;
  const all = useMemo(() => rules.rows ?? [], [rules.rows]);
  const scoped = useMemo(() => all.filter((r) => (product ? r.product_id === product.id : r.product_id === null)), [all, product]);
  const attention = useMemo(() => (products.data ?? []).filter((p) => p.pricing_mode !== "quote" && p.status !== "archived").map((p) => ({ p, problems: productProblems(p, all.filter((r) => r.product_id === p.id), true).filter((x) => x.level === "danger") })).filter((x) => x.problems.length), [products.data, all]);

  if (!canRead) return <><PageHeader title="Pricing" /><EmptyState title="Not part of your role." body="Pricing rules are confidential. They are managed by administrators; the sales team can read them." /></>;

  const editing = sel.id ? all.find((r) => r.id === sel.id) ?? null : null;
  const drawerKind = (editing?.kind ?? newKind) as RuleKind | "";
  const drawerProduct = editing ? products.data?.find((p) => p.id === editing.product_id) ?? null : product;
  const drawerSiblings = editing ? all.filter((r) => r.product_id === editing.product_id) : scoped;
  const closeDrawer = () => { if (sel.id) sel.close(); else setNewKind(""); };
  const kinds = RULE_KINDS.filter((k) => product || k !== "base");
  const del = async (r: PricingRulesRow) => { if (await confirm({ title: "Delete this pricing rule?", danger: true, confirmLabel: "Delete rule", body: <>“{r.label}” ({ruleSummary(r)}) will be removed and estimates change immediately. Switch it off instead if you may need it again.</> })) await rules.remove(r.id); };
  const duplicate = (r: PricingRulesRow) => void rules.create({ product_id: r.product_id, kind: r.kind, label: `${r.label} (copy)`, match: r.match, amount: r.amount, amount_type: r.amount_type, min_qty: r.min_qty, max_qty: r.max_qty, starts_at: r.starts_at, ends_at: r.ends_at, active: false });

  return (
    <div>
      <PageHeader title="Pricing" sub="The confidential rules behind every online estimate. Changes take effect immediately — no site publish needed." />
      {!canWrite && <p role="status" className="mb-4 border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-fog-300"><span className="t-label mr-2 text-fog-50">Read-only</span>Pricing rules are managed by administrators. You can read them and use the simulator to explain a quote.</p>}
      {flag.data && !online && <p role="status" className="mb-4 border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-fog-50">ONLINE_PRICING is switched off, so customers see “quote required” everywhere and the simulator will too. <Link href="/admin/settings/?tab=flags" className="t-label ml-1 text-yellow">Feature flags</Link></p>}

      {attention.length > 0 && (
        <Panel title={`Needs attention · ${attention.length}`} className="mb-5">
          <ul className="divide-y divide-ink-800">{attention.map(({ p, problems }) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0"><span className="block text-fog-50">{p.name}</span><span className="block text-danger">{problems[0]!.text}</span></span><Button variant="outline" size="sm" onClick={() => setScope(p.id)}>Fix</Button></li>)}</ul>
        </Panel>
      )}

      <Panel title="How pricing works" className="mb-5">
        <div className="grid gap-4 text-sm leading-relaxed text-fog-400 md:grid-cols-3">
          <p><span className="t-label mb-1 block text-fog-200">Fixed</span>The calculated price is presented as the price. Use when the product never varies.</p>
          <p><span className="t-label mb-1 block text-fog-200">Estimated</span>Customers see a ±8% band around the calculated price and are told the written quotation is final. The exact unit price never leaves the database.</p>
          <p><span className="t-label mb-1 block text-fog-200">Quote required</span>No figure online. Also what customers see when a product has no active base price, or when ONLINE_PRICING is off.</p>
        </div>
        <p className="mt-4 border-t border-ink-700 pt-4 text-sm text-fog-400">The mode is set on each <Link href="/admin/products/" className="text-yellow hover:text-fog-50">product</Link>. Billboard rental prices live on each <Link href="/admin/billboards/" className="text-yellow hover:text-fog-50">billboard</Link>; bundle discounts on each <Link href="/admin/bundles/" className="text-yellow hover:text-fog-50">bundle</Link>.</p>
      </Panel>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md"><span className="t-label text-fog-400">Rules for</span>
          <select value={product ? product.id : "global"} onChange={(e) => setScope(e.target.value)} className={clsx(inputCls, "pr-8")}>
            <option value="global">Global rules — apply to every priced product</option>
            {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.pricing_mode}{p.status !== "published" ? ` · ${p.status}` : ""}</option>)}
          </select>
        </label>
        {product && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-sm text-fog-400"><StatusPill status={product.status} /><span>Mode <span className="t-label text-fog-100">{product.pricing_mode}</span></span><span>MOQ <span className="t-data text-fog-100">{product.moq}</span></span><span>Lead <span className="t-data text-fog-100">{product.lead_min_days ?? "—"}–{product.lead_max_days ?? "—"} d</span></span><Link href={`/admin/products/?id=${product.id}`} className="t-label text-yellow hover:text-fog-50">Edit product</Link></div>}
      </div>
      <ErrorNote message={rules.error ?? products.error} onRetry={() => { void rules.reload(); void products.reload(); }} />
      {product && productProblems(product, scoped, flag.data ? online : true).map((pr) => <p key={pr.text} role="status" className={clsx("mb-3 border px-4 py-3 text-sm text-fog-50", pr.level === "danger" ? "border-danger/40 bg-danger/10" : "border-warn/40 bg-warn/10")}>{pr.text}</p>)}
      {!product && <p className="mb-3 text-sm text-fog-500">Global rules are added on top of each product&apos;s own rules. A base price is always per product, so it is not offered here.</p>}

      {rules.loading && !rules.rows ? <div className="skeleton h-64" /> : (
        <div className="mb-6 grid gap-3">
          {kinds.map((k) => {
            const list = scoped.filter((r) => r.kind === k);
            return (
              <Panel key={k} flush title={`${KIND_META[k].label}${list.length ? ` · ${list.length}` : ""}`} action={canWrite ? <button type="button" onClick={() => setNewKind(k)} className="t-label min-h-10 text-yellow hover:text-fog-50">+ Add</button> : undefined}>
                <p className="px-4 py-3 text-xs leading-relaxed text-fog-500">{KIND_META[k].blurb}</p>
                {list.length > 0 && (
                  <ul className="divide-y divide-ink-800 border-t border-ink-800">
                    {list.map((r) => (
                      <li key={r.id} className={clsx("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5", !r.active && "opacity-60")}>
                        <div className="min-w-0 flex-1 basis-56"><p className="truncate text-sm text-fog-50">{r.label}</p><p className="t-data truncate text-xs text-fog-400">{ruleSummary(r)}</p></div>
                        <button type="button" role="switch" aria-checked={r.active} aria-label={`${r.label} active`} disabled={!canWrite || r.id.startsWith("tmp-")} onClick={() => void rules.update(r.id, { active: !r.active }, { message: r.active ? "Rule switched off." : "Rule switched on." })} className={clsx("t-label min-h-10 border px-2.5 text-[0.625rem] disabled:opacity-50", r.active ? "border-ok/50 text-ok" : "border-ink-600 text-fog-500")}>{r.active ? "Active" : "Off"}</button>
                        <span className="flex">
                          <button type="button" disabled={r.id.startsWith("tmp-")} onClick={() => sel.open(r.id)} className="t-label min-h-10 px-2 text-fog-300 hover:text-fog-50">{canWrite ? "Edit" : "View"}</button>
                          {canWrite && <><button type="button" disabled={r.id.startsWith("tmp-")} onClick={() => duplicate(r)} className="t-label min-h-10 px-2 text-fog-300 hover:text-fog-50">Copy</button><button type="button" disabled={r.id.startsWith("tmp-")} onClick={() => void del(r)} className="t-label min-h-10 px-2 text-fog-300 hover:text-danger">Delete</button></>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {products.data && <Simulator key={product?.id ?? "none"} products={products.data} initialProductId={product?.id ?? null} />}
      {drawerKind && (RULE_KINDS as readonly string[]).includes(drawerKind) && (canWrite || editing) && (
        <RuleDrawer key={editing?.id ?? `new-${drawerKind}`} kind={drawerKind as RuleKind} rule={editing} product={drawerProduct} siblings={drawerSiblings} canWrite={canWrite} saving={rules.saving} onClose={closeDrawer}
          onSave={async (payload) => Boolean(editing ? await rules.update(editing.id, payload) : await rules.create({ ...payload, product_id: product?.id ?? null }))} />
      )}
      {confirmUi}
    </div>
  );
}

"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Estimate } from "@/lib/backend/api";
import { backend } from "@/lib/backend/client";
import type { ProductsRow } from "@/lib/backend/db-types";
import { formatLak } from "@/lib/format";
import { adminError } from "../resource/errors";
import { DateField, NumberField, SelectField, ToggleField } from "../resource/fields";
import { Panel } from "../ui";

const list = (p: ProductsRow | undefined, key: string): string[] => { const d = p?.data as Record<string, unknown> | null | undefined; return Array.isArray(d?.[key]) ? (d[key] as unknown[]).filter((x): x is string => typeof x === "string") : []; };
const pick = (label: string, values: string[]) => [{ value: "", label: `No ${label} chosen` }, ...values.map((v) => ({ value: v, label: v }))];

/** Calls the same estimate_price() RPC as the public site, so the result is exactly what a customer would see. */
export function Simulator({ products, initialProductId }: { products: ProductsRow[]; initialProductId: string | null }) {
  const published = products.filter((p) => p.status === "published");
  const [pid, setPid] = useState(published.some((p) => p.id === initialProductId) ? initialProductId! : "");
  const [qty, setQty] = useState<number | null>(50);
  const [opt, setOpt] = useState({ method: "", material: "", size: "", finishing: "" });
  const [locations, setLocations] = useState<number | null>(1);
  const [neededBy, setNeededBy] = useState<string | null>(null);
  const [delivery, setDelivery] = useState(false);
  const [installation, setInstallation] = useState(false);
  const [state, setState] = useState<{ loading: boolean; error: string | null; result: Estimate | null; sent: Record<string, unknown> | null }>({ loading: false, error: null, result: null, sent: null });
  const product = published.find((p) => p.id === pid);

  const run = async () => {
    if (!product) return setState({ loading: false, error: "Choose a product first.", result: null, sent: null });
    if (!qty || qty < 1) return setState({ loading: false, error: "Enter a quantity of at least 1.", result: null, sent: null });
    const options: Record<string, unknown> = { locations: Array.from({ length: Math.max(1, locations ?? 1) }, (_, i) => `location-${i + 1}`) };
    for (const [k, v] of Object.entries(opt)) if (v) options[k] = v;
    if (neededBy) options.neededBy = neededBy;
    if (delivery) options.delivery = true;
    if (installation) options.installation = true;
    setState({ loading: true, error: null, result: null, sent: options });
    const r = await backend()!.rpc("estimate_price", { product_slug: product.slug, qty, options });
    setState({ loading: false, error: r.error ? adminError(r.error) : null, result: r.error ? null : (r.data as Estimate), sent: options });
  };
  const r = state.result;

  return (
    <Panel title="Price simulator">
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-fog-400">Runs the live estimate engine with the options below and shows <strong className="text-fog-200">exactly what a customer sees</strong>. The ±8% band is deliberate: it hides the confidential unit price. Only published products can be priced.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SelectField className="sm:col-span-2" label="Product" value={pid} onChange={(v) => { setPid(v); setOpt({ method: "", material: "", size: "", finishing: "" }); }} placeholder={published.length ? "Choose a published product…" : "No published products"} options={published.map((p) => ({ value: p.id, label: `${p.name} · ${p.pricing_mode}` }))} />
        <NumberField label="Quantity" min={1} step={1} suffix="pcs" value={qty} onChange={setQty} hint={product ? `MOQ ${product.moq}` : undefined} />
        <NumberField label="Print locations" min={1} max={6} step={1} value={locations} onChange={setLocations} />
        <SelectField label="Print method" value={opt.method} onChange={(v) => setOpt({ ...opt, method: v })} options={pick("method", list(product, "printMethods"))} />
        <SelectField label="Material" value={opt.material} onChange={(v) => setOpt({ ...opt, material: v })} options={pick("material", list(product, "materials"))} />
        <SelectField label="Size" value={opt.size} onChange={(v) => setOpt({ ...opt, size: v })} options={pick("size", list(product, "sizes"))} />
        <DateField label="Needed by" value={neededBy} onChange={setNeededBy} hint={product?.lead_min_days != null ? `Rush applies inside ${product.lead_min_days} days` : "No lead time set → rush never applies"} />
        <ToggleField label="Delivery" value={delivery} onChange={setDelivery} onLabel="Requested" offLabel="Not requested" />
        <ToggleField label="Installation" value={installation} onChange={setInstallation} onLabel="Requested" offLabel="Not requested" />
      </div>
      <div className="mt-4"><Button size="sm" className="min-h-11" loading={state.loading} onClick={() => void run()}>Run estimate</Button></div>
      <div aria-live="polite" className="mt-4">
        {state.error && <p role="alert" className="border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-fog-50">{state.error}</p>}
        {r && (
          <div className="crop border border-ink-600 bg-ink-950 p-5">
            <p className="t-label mb-3 text-fog-500">What the customer sees</p>
            {r.mode === "quote" ? (
              <><p className="t-heading text-fog-50">Quote required</p><p className="mt-2 max-w-xl text-sm leading-relaxed text-fog-400">No figure is shown. That happens when the product is in quote mode, has no active base price, or ONLINE_PRICING is switched off.</p></>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><p className="t-label text-fog-500">Per piece</p><p className="t-data mt-1 text-2xl text-fog-50">{formatLak(r.unitLow)} – {formatLak(r.unitHigh)}</p></div>
                  <div><p className="t-label text-fog-500">Total for {qty} pcs</p><p className="t-data mt-1 text-2xl text-yellow">{formatLak(r.totalLow)} – {formatLak(r.totalHigh)}</p></div>
                </div>
                <ul className="mt-4 flex flex-wrap gap-2">{r.lines.map((l, i) => <li key={i} className="t-label border border-ink-600 px-2 py-1 text-[0.625rem] text-fog-300">{l.label}</li>)}</ul>
                <p className="mt-3 text-xs text-fog-500">{r.mode === "fixed" ? "Mode: fixed." : "Mode: estimated."} {r.disclaimer}</p>
              </>
            )}
            {r.belowMoq && <p className="mt-3 border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-fog-50">Below the minimum order of {r.moq} — the site tells the customer and asks them to raise the quantity or request a quote.</p>}
          </div>
        )}
      </div>
    </Panel>
  );
}

"use client";
import { DesignThumb } from "@/components/studio/DesignThumb";
import type { PrintArea } from "@/content/types";
import { BRAND } from "@/lib/brand";
import { GARMENTS } from "@/lib/garments";
import { HEX_RE, inputCls, SelectField, ToggleField } from "../resource/fields";
import { GARMENT_KEYS, sidesOf } from "./product-form";
import type { TabProps } from "./ProductTabs";

/** data.studio = { garment, areas[] } | null. Areas are limited to the sides that garment really has. */
export function StudioTab({ f, set, errors, disabled }: TabProps) {
  const sides = sidesOf(f.garment);
  const colour = f.colours[0] && HEX_RE.test(f.colours[0].hex) ? f.colours[0].hex : BRAND.garmentWhite;
  const area = (key: PrintArea["key"]) => f.areas.find((a) => a.key === key);
  const toggleArea = (key: PrintArea["key"], label: string) => set("areas", area(key) ? f.areas.filter((a) => a.key !== key) : sides.flatMap((s) => (s.key === key ? [{ key, label, widthMm: 300, heightMm: 400 }] : f.areas.filter((a) => a.key === s.key))));
  const patch = (key: PrintArea["key"], p: Partial<PrintArea>) => set("areas", f.areas.map((a) => (a.key === key ? { ...a, ...p } : a)));
  const num = (v: string) => (v === "" ? 0 : Math.max(0, Math.round(Number(v)) || 0));

  return (
    <div className="flex flex-col gap-5">
      <ToggleField label="SPP Studio" disabled={disabled} value={f.studioOn} onChange={(v) => set("studioOn", v)} onLabel="“Customise this” opens this product in SPP Studio" offLabel="Not designable online — quote requests only" />
      {f.studioOn && (
        <>
          <SelectField className="max-w-xs" label="Garment shape" disabled={disabled} value={f.garment} options={GARMENT_KEYS.map((g) => ({ value: g, label: GARMENTS[g].name }))}
            onChange={(g) => { set("garment", g); const ok = new Set(sidesOf(g).map((s) => s.key)); set("areas", f.areas.filter((a) => ok.has(a.key))); }} />
          {errors.areas && <p role="alert" className="text-sm text-danger">{errors.areas}</p>}
          <p className="text-sm leading-relaxed text-fog-400">Tick the sides customers may print on and give the real printable size in millimetres — the artwork preflight uses it to check resolution. The dashed box is the print area.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {sides.map((s) => {
              const a = area(s.key);
              return (
                <li key={s.key} className={`flex gap-3 border p-3 ${a ? "border-ink-600 bg-ink-950" : "border-ink-800"}`}>
                  <DesignThumb garment={f.garment} side={s.key} colour={colour} layers={[]} showArea={Boolean(a)} className={`h-32 w-28 flex-none ${a ? "" : "opacity-40"}`} title={`${GARMENTS[f.garment].name} · ${s.label}`} />
                  <div className="min-w-0 flex-1">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fog-50"><input type="checkbox" disabled={disabled} checked={Boolean(a)} onChange={() => toggleArea(s.key, s.label)} className="h-4 w-4 accent-[var(--color-yellow)]" />{s.label}</label>
                    {a && (
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <label className="col-span-2 flex flex-col gap-1"><span className="t-label text-[0.625rem] text-fog-500">Label</span><input disabled={disabled} value={a.label} onChange={(e) => patch(s.key, { label: e.target.value })} className={inputCls} /></label>
                        <label className="flex flex-col gap-1"><span className="t-label text-[0.625rem] text-fog-500">Width mm</span><input type="number" inputMode="numeric" min={10} disabled={disabled} value={a.widthMm || ""} onChange={(e) => patch(s.key, { widthMm: num(e.target.value) })} className={`${inputCls} t-data`} /></label>
                        <label className="flex flex-col gap-1"><span className="t-label text-[0.625rem] text-fog-500">Height mm</span><input type="number" inputMode="numeric" min={10} disabled={disabled} value={a.heightMm || ""} onChange={(e) => patch(s.key, { heightMm: num(e.target.value) })} className={`${inputCls} t-data`} /></label>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

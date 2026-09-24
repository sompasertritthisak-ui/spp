"use client";
import { clsx } from "clsx";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, Trash2, Unlock, Upload } from "lucide-react";
import { useMemo, useRef, useState, type Dispatch, type ReactNode } from "react";
import type { DesignTemplate, PrintArea, Product } from "@/content/types";
import { isDark } from "@/lib/garments";
import { layerSize } from "@/lib/studio/metrics";
import { PREFLIGHT_DISCLAIMER, VERDICT_LABEL, type Check, type Verdict } from "@/lib/studio/preflight";
import { AREA_W, clampWeight, FONT_KEYS, FONT_META, FONT_VAR, newLayerId, normaliseSides, SHAPE_KEYS, type FontKey, type Layer, type ShapeKey } from "@/lib/studio/schema";
import { ColourEntry } from "./ColourEntry";
import { GRAPHICS, SHAPE_LABEL, shapePath } from "@/lib/studio/shapes";
import type { Action, StudioState } from "@/lib/studio/store";
import { ACCEPT } from "@/lib/studio/uploads";
import { DesignThumb } from "./DesignThumb";

export const INKS = ["#f5f5f2", "#17171a", "#f5b81f", "#d4302b", "#2a35d6", "#1f5a3d", "#f2711c", "#c9a227", "#4db4e8", "#ec008c"];
export const defaultInk = (garmentColour: string) => (isDark(garmentColour) ? "#f5f5f2" : "#17171a");

export function PanelTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <header className="mb-4">
      <h2 className="t-label text-fog-50">{children}</h2>
      {hint && <p className="mt-1.5 text-sm leading-snug text-fog-400">{hint}</p>}
    </header>
  );
}
const Label = ({ children }: { children: ReactNode }) => <p className="t-label mb-2 mt-5 text-[0.625rem] text-fog-500 first:mt-0">{children}</p>;
const tile = "flex min-h-11 items-center justify-center border border-ink-600 bg-ink-900 text-fog-200 transition-colors hover:border-yellow hover:text-yellow disabled:opacity-40";

export function Swatches({ value, onPick, colours, label, size = "md" }: { value: string; onPick: (hex: string) => void; colours: { name?: string; hex: string }[]; label: string; size?: "md" | "sm" }) {
  const [entry, setEntry] = useState(false);
  const custom = !colours.some((c) => c.hex.toLowerCase() === value.toLowerCase());
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {colours.map((c) => {
          const on = c.hex.toLowerCase() === value.toLowerCase();
          return (
            <button key={c.hex} type="button" role="radio" aria-checked={on} aria-label={c.name ? `${c.name} ${c.hex}` : c.hex} title={c.name ?? c.hex} onClick={() => onPick(c.hex)}
              className={clsx("relative rounded-full border transition-transform hover:scale-110", size === "md" ? "h-9 w-9" : "h-7 w-7", on ? "border-yellow ring-2 ring-yellow ring-offset-2 ring-offset-ink-900" : "border-ink-500")} style={{ background: c.hex }}>
              {on && <span aria-hidden className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full" style={{ background: isDark(c.hex) ? "#fff" : "#000" }} />}
            </button>
          );
        })}
        <button type="button" aria-pressed={entry} aria-label={`Enter a ${label.toLowerCase()} code (HEX, RGB or CMYK)`} title="Enter a colour code" onClick={() => setEntry((v) => !v)}
          className={clsx("relative flex items-center justify-center rounded-full border text-fog-400 transition-colors hover:border-gold hover:text-gold", size === "md" ? "h-9 w-9" : "h-7 w-7", entry || custom ? "border-gold text-gold" : "border-dashed border-ink-500")} style={custom ? { background: value } : undefined}>
          {custom ? <span aria-hidden className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full" style={{ background: isDark(value) ? "#fff" : "#000" }} /> : <span aria-hidden className="text-base leading-none">+</span>}
        </button>
      </div>
      {entry && <ColourEntry value={value} onPick={onPick} label={label} className="mt-2" />}
      {!entry && <button type="button" onClick={() => setEntry(true)} className="t-label mt-2 text-[0.625rem] text-fog-500 hover:text-gold">Enter HEX · RGB · CMYK</button>}
    </div>
  );
}

/* ── Product ─────────────────────────────────────────────────────────────── */
export function ProductPanel({ products, product, state, dispatch }: { products: Product[]; product: Product; state: StudioState; dispatch: Dispatch<Action> }) {
  return (
    <div>
      <PanelTitle hint="Pick what you are making. Your artwork stays with you when you switch.">Product</PanelTitle>
      <div className="grid grid-cols-2 gap-2">
        {products.map((p) => {
          const on = p.slug === product.slug;
          return (
            <button key={p.slug} type="button" aria-pressed={on} onClick={() => !on && p.studio && dispatch({ type: "setProduct", productSlug: p.slug, garment: p.studio.garment, sideKeys: p.studio.areas.map((a) => a.key), colour: p.colours.some((c) => c.hex.toLowerCase() === state.doc.colour.toLowerCase()) ? undefined : p.colours[0]?.hex })}
              className={clsx("flex flex-col items-center gap-1 border p-2 transition-colors", on ? "border-yellow bg-ink-800" : "border-ink-600 bg-ink-900 hover:border-ink-500")}>
              <DesignThumb garment={p.studio!.garment} colour={on ? state.doc.colour : "#d9d5ca"} layers={[]} className="h-20 w-full" title={p.name} />
              <span className="t-label text-[0.625rem] text-fog-200">{p.name}</span>
            </button>
          );
        })}
      </div>
      <Label>Colour — {product.colours.find((c) => c.hex.toLowerCase() === state.doc.colour.toLowerCase())?.name ?? state.doc.colour.toUpperCase()}</Label>
      <Swatches label="Garment colour" value={state.doc.colour} colours={product.colours} onPick={(hex) => dispatch({ type: "setColour", colour: hex })} />
      {product.sizes.length > 1 && (
        <>
          <Label>Preview size (you will give a size breakdown in your quote)</Label>
          <div className="flex flex-wrap gap-1.5">
            {product.sizes.map((s) => <button key={s} type="button" aria-pressed={state.doc.size === s} onClick={() => dispatch({ type: "setSize", size: state.doc.size === s ? undefined : s })} className={clsx("t-label min-h-10 min-w-11 border px-2.5", state.doc.size === s ? "border-yellow text-yellow" : "border-ink-600 text-fog-300 hover:border-ink-500")}>{s}</button>)}
          </div>
        </>
      )}
      <p className="mt-5 border-t border-ink-700 pt-4 text-sm text-fog-400">Minimum order {product.moq} pieces{product.leadTimeDays ? ` · ${product.leadTimeDays[0]}–${product.leadTimeDays[1]} working days` : ""}.</p>
    </div>
  );
}

/* ── Text ────────────────────────────────────────────────────────────────── */
const TEXT_PRESETS: { font: FontKey; text: string; size: number; weight?: number; italic?: boolean; tracking?: number; cls?: string }[] = [
  { font: "display", text: "HEADLINE", size: 150, weight: 800, cls: "uppercase tracking-tight" },
  { font: "impact", text: "CHAMPIONS", size: 170, cls: "uppercase" },
  { font: "condensed", text: "VIENTIANE 2026", size: 180, cls: "uppercase tracking-wide" },
  { font: "sport", text: "TEAM 10", size: 160, weight: 700, cls: "uppercase" },
  { font: "stencil", text: "CREW 07", size: 150, cls: "uppercase" },
  { font: "comic", text: "BOOM!", size: 170, cls: "uppercase tracking-wide" },
  { font: "rounded", text: "GOOD VIBES", size: 120, cls: "uppercase" },
  { font: "editorial", text: "Est. 2014", size: 130, weight: 700, italic: true },
  { font: "serif", text: "Signature", size: 160, weight: 400, italic: true },
  { font: "script", text: "Sabaidee", size: 140 },
  { font: "retro", text: "Riverside", size: 140 },
  { font: "marker", text: "hand made", size: 120 },
  { font: "hand", text: "with love", size: 130, weight: 600 },
  { font: "sans", text: "brand name", size: 80, weight: 500 },
  { font: "geometric", text: "modern", size: 110, weight: 700 },
  { font: "mono", text: "EST. 2026 · VIENTIANE", size: 40, weight: 500, tracking: 160, cls: "uppercase tracking-[0.2em] text-sm" },
  { font: "lao", text: "ສະບາຍດີ", size: 140, weight: 700 },
];

export function TextPanel({ add, garmentColour, areaH }: { add: (l: Layer) => void; garmentColour: string; areaH: number }) {
  const fill = defaultInk(garmentColour);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const m = new Map<string, typeof TEXT_PRESETS>();
    for (const p of TEXT_PRESETS) { const meta = FONT_META[p.font]; if (q && !`${meta.label} ${meta.group} ${p.text}`.toLowerCase().includes(q.toLowerCase())) continue; m.set(meta.group, [...(m.get(meta.group) ?? []), p]); }
    return [...m.entries()];
  }, [q]);
  return (
    <div>
      <PanelTitle hint={`${FONT_KEYS.length} typefaces. Tap a style to place it, then edit the words on the right.`}>Text</PanelTitle>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a style…" aria-label="Find a text style" className="mb-3 min-h-10 w-full border border-ink-600 bg-ink-950 px-3 text-sm text-fog-50 placeholder:text-fog-500 focus:border-gold focus:outline-none" />
      {groups.map(([group, items]) => (
        <div key={group}>
          <Label>{group}</Label>
          <div className="flex flex-col gap-1.5">
            {items.map((p) => {
              const meta = FONT_META[p.font];
              const weight = clampWeight(p.font, p.weight ?? 400);
              return (
                <button key={p.font} type="button" onClick={() => add({ id: newLayerId(), type: "text", x: AREA_W / 2, y: areaH * 0.36, angle: 0, opacity: 1, fill, tracking: p.tracking ?? 0, align: "center", font: p.font, weight, size: p.size, text: p.text, italic: p.italic ?? false } as Layer)}
                  className="group flex min-h-14 items-center justify-between gap-3 border border-ink-600 bg-ink-900 px-4 text-left transition-colors hover:border-gold">
                  <span className="min-w-0">
                    <span className={clsx("block truncate text-2xl leading-tight text-fog-50", p.cls)} style={{ fontFamily: `var(${meta.var}), ${meta.generic}`, fontWeight: weight, fontStyle: p.italic ? "italic" : undefined }} lang={p.font === "lao" ? "lo" : undefined}>{p.text}</span>
                    <span className="t-label block text-[0.5625rem] text-fog-500">{meta.label}</span>
                  </span>
                  <span className="t-label flex-none text-[0.625rem] text-fog-500 group-hover:text-gold">Add</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {groups.length === 0 && <p className="text-sm text-fog-400">No style matches “{q}”.</p>}
    </div>
  );
}

/* ── Elements ────────────────────────────────────────────────────────────── */
export function ElementsPanel({ add, garmentColour, areaH }: { add: (l: Layer) => void; garmentColour: string; areaH: number }) {
  const fill = defaultInk(garmentColour);
  const groups = useMemo(() => {
    const m = new Map<string, [string, (typeof GRAPHICS)[string]][]>();
    for (const e of Object.entries(GRAPHICS)) m.set(e[1].group, [...(m.get(e[1].group) ?? []), e]);
    return [...m.entries()];
  }, []);
  const dims = (s: ShapeKey): [number, number] => (s === "line" ? [560, 8] : s === "rect" ? [420, 260] : s === "badge" ? [420, 300] : s === "shield" ? [300, 350] : [300, 300]);
  return (
    <div>
      <PanelTitle hint="Shapes and marks you can recolour and resize freely.">Elements</PanelTitle>
      <Label>Shapes</Label>
      <div className="grid grid-cols-5 gap-1.5">
        {SHAPE_KEYS.map((s) => {
          const [w, h] = dims(s);
          return (
            <button key={s} type="button" title={SHAPE_LABEL[s]} aria-label={`Add ${SHAPE_LABEL[s]}`} onClick={() => add({ id: newLayerId(), type: "shape", shape: s, x: AREA_W / 2, y: areaH / 2, w, h, fill, angle: 0, opacity: 1 })} className={clsx(tile, "aspect-square p-2.5")}>
              <svg viewBox="-60 -60 120 120" className="h-full w-full" aria-hidden><path d={shapePath(s, s === "line" ? 100 : 96, s === "line" ? 6 : (96 * h) / Math.max(w, h))} fill="currentColor" fillRule="evenodd" /></svg>
            </button>
          );
        })}
      </div>
      {groups.map(([group, items]) => (
        <div key={group}>
          <Label>{group}</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {items.map(([key, g]) => (
              <button key={key} type="button" title={g.label} aria-label={`Add ${g.label}`} onClick={() => add({ id: newLayerId(), type: "graphic", graphic: key, x: AREA_W / 2, y: areaH / 2, w: 300, h: 300, fill, angle: 0, opacity: 1 })} className={clsx(tile, "aspect-square p-2.5")}>
                <svg viewBox="-56 -56 112 112" className="h-full w-full" aria-hidden><path d={g.d} fill="currentColor" fillRule="evenodd" /></svg>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Upload ──────────────────────────────────────────────────────────────── */
export function UploadPanel({ onFiles, busy, error, brandLogos }: { onFiles: (f: File[]) => void; busy: boolean; error: string | null; brandLogos?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <PanelTitle hint="Your logo or artwork. Files stay private to you and the SPP team.">Upload artwork</PanelTitle>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}
        className={clsx("flex w-full flex-col items-center gap-3 border border-dashed px-4 py-9 text-center transition-colors", over ? "border-yellow bg-yellow/5" : "border-ink-500 hover:border-yellow")}>
        <Upload aria-hidden strokeWidth={1.5} className="h-6 w-6 text-yellow" />
        <span className="t-label text-fog-50">{busy ? "Checking file…" : "Upload artwork"}</span>
        <span className="text-sm text-fog-400">PNG, JPG, WebP or SVG · up to 25 MB<br />Drop a file here or tap to browse</span>
      </button>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      {error && <p role="alert" className="mt-3 border border-danger/40 bg-danger/10 p-3 text-sm text-fog-50">{error}</p>}
      {brandLogos}
      <ul className="mt-5 space-y-2 border-t border-ink-700 pt-4 text-sm text-fog-400">
        <li><span className="text-fog-200">Best:</span> vector (SVG) or a transparent PNG.</li>
        <li><span className="text-fog-200">Size:</span> aim for 150 pixels per centimetre of print width.</li>
        <li><span className="text-fog-200">AI, PDF, EPS?</span> Attach them to your quote — our team will place them.</li>
      </ul>
    </div>
  );
}

/* ── Templates ───────────────────────────────────────────────────────────── */
export function TemplatesPanel({ templates, state, onApply }: { templates: DesignTemplate[]; state: StudioState; onApply: (t: DesignTemplate) => void }) {
  const fits = templates.filter((t) => t.garments.includes(state.doc.garment));
  const cats = ["All", ...new Set(fits.map((t) => t.category))];
  const [cat, setCat] = useState("All");
  const list = fits.filter((t) => cat === "All" || t.category === cat);
  const firstSide = (t: DesignTemplate) => Object.keys(t.sides).find((k) => k === state.side) ?? Object.keys(t.sides)[0] ?? "front";
  return (
    <div>
      <PanelTitle hint="Start from a layout, then make it yours. Applying a template replaces the artwork on the sides it covers.">Templates</PanelTitle>
      <div className="thin-scroll -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
        {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={clsx("t-label min-h-9 flex-none border px-2.5 text-[0.625rem]", cat === c ? "border-yellow text-yellow" : "border-ink-600 text-fog-400 hover:text-fog-50")}>{c}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {list.map((t) => (
          <button key={t.slug} type="button" onClick={() => onApply(t)} className="group border border-ink-600 bg-ink-900 p-2 text-left transition-colors hover:border-yellow">
            <DesignThumb garment={state.doc.garment} side={firstSide(t)} colour={t.suggestedColour} layers={normaliseSides(t.sides)[firstSide(t)] ?? []} className="h-28 w-full" title={t.name} />
            <span className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-sm text-fog-100">{t.name}</span><span className="t-label text-[0.5625rem] text-fog-500">{t.category}</span></span>
          </button>
        ))}
        {list.length === 0 && <p className="col-span-2 text-sm text-fog-400">No templates for this product yet.</p>}
      </div>
    </div>
  );
}

/* ── Layers ──────────────────────────────────────────────────────────────── */
const layerName = (l: Layer) => (l.type === "text" ? l.text.split("\n")[0]!.slice(0, 22) : l.type === "image" ? l.name.slice(0, 22) : l.type === "graphic" ? (GRAPHICS[l.graphic]?.label ?? "Graphic") : SHAPE_LABEL[l.shape]);

export function LayersPanel({ layers, selectedId, dispatch }: { layers: Layer[]; selectedId: string | null; dispatch: Dispatch<Action> }) {
  const top = [...layers].reverse();
  const ib = "flex h-9 w-9 flex-none items-center justify-center text-fog-400 hover:text-fog-50 disabled:opacity-30";
  return (
    <div>
      <PanelTitle hint="Top of the list prints on top.">Layers</PanelTitle>
      {top.length === 0 && <p className="text-sm text-fog-400">Nothing on this side yet.</p>}
      <ul className="flex flex-col gap-1">
        {top.map((l, i) => (
          <li key={l.id} className={clsx("flex items-center border", l.id === selectedId ? "border-yellow bg-ink-800" : "border-ink-700 bg-ink-900")}>
            <button type="button" onClick={() => dispatch({ type: "select", id: l.id })} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-3 text-left">
              <span className="t-label w-9 flex-none text-[0.5625rem] text-fog-500">{l.type === "graphic" ? "mark" : l.type}</span>
              <span className={clsx("truncate text-sm", l.hidden ? "text-fog-500 line-through" : "text-fog-100")}>{layerName(l)}</span>
            </button>
            <button type="button" className={ib} aria-label="Bring forward" disabled={i === 0} onClick={() => dispatch({ type: "reorder", id: l.id, to: "up" })}><ArrowUp aria-hidden strokeWidth={1.5} className="h-4 w-4" /></button>
            <button type="button" className={ib} aria-label="Send backward" disabled={i === top.length - 1} onClick={() => dispatch({ type: "reorder", id: l.id, to: "down" })}><ArrowDown aria-hidden strokeWidth={1.5} className="h-4 w-4" /></button>
            <button type="button" className={ib} aria-label={l.hidden ? "Show layer" : "Hide layer"} onClick={() => dispatch({ type: "update", id: l.id, patch: { hidden: !l.hidden } })}>{l.hidden ? <EyeOff aria-hidden strokeWidth={1.5} className="h-4 w-4" /> : <Eye aria-hidden strokeWidth={1.5} className="h-4 w-4" />}</button>
            <button type="button" className={ib} aria-label={l.locked ? "Unlock layer" : "Lock layer"} onClick={() => dispatch({ type: "update", id: l.id, patch: { locked: !l.locked } })}>{l.locked ? <Lock aria-hidden strokeWidth={1.5} className="h-4 w-4 text-yellow" /> : <Unlock aria-hidden strokeWidth={1.5} className="h-4 w-4" />}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Inspector (selected layer) ──────────────────────────────────────────── */
export function Inspector({ layer, dispatch, areaH, physical, brand, textRef }: { layer: Layer; dispatch: Dispatch<Action>; areaH: number; physical: PrintArea | undefined; brand: { name: string; hex: string }[]; textRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const set = (patch: Partial<Layer>, transient = false) => dispatch({ type: "update", id: layer.id, patch, transient });
  const scrub = { onPointerDown: () => dispatch({ type: "checkpoint" }) };
  const { w } = layerSize(layer);
  const mm = physical ? Math.round((w / AREA_W) * physical.widthMm) : null;
  const inks = [...brand.map((b) => ({ name: `Brand · ${b.name || b.hex}`, hex: b.hex })), ...INKS.filter((h) => !brand.some((b) => b.hex.toLowerCase() === h)).map((hex) => ({ hex }))];
  const range = "h-11 w-full accent-yellow";
  return (
    <div>
      <PanelTitle>{layer.type === "text" ? "Edit text" : layer.type === "image" ? "Edit artwork" : "Edit element"}</PanelTitle>

      {layer.type === "text" && (
        <>
          <label className="t-label mb-2 block text-[0.625rem] text-fog-500" htmlFor="ins-text">Words</label>
          <textarea id="ins-text" ref={textRef} rows={2} value={layer.text} maxLength={200} onFocus={() => dispatch({ type: "checkpoint" })} onChange={(e) => set({ text: e.target.value || " " }, true)} className="w-full resize-y border border-ink-600 bg-ink-950 p-3 text-base text-fog-50 focus:border-yellow focus:outline-none" />
          <Label>Typeface — {FONT_META[layer.font].label}</Label>
          <div className="thin-scroll grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
            {FONT_KEYS.map((f) => {
              const m = FONT_META[f];
              return (
                <button key={f} type="button" aria-pressed={layer.font === f} title={m.label} onClick={() => set({ font: f, italic: m.italic && (f === "serif" || layer.italic), weight: clampWeight(f, layer.weight) })}
                  className={clsx("flex min-h-11 items-center justify-center overflow-hidden border px-2 text-base leading-none", layer.font === f ? "border-gold text-gold" : "border-ink-600 text-fog-200 hover:border-ink-500")}
                  style={{ fontFamily: `var(${m.var}), ${m.generic}`, fontStyle: f === "serif" ? "italic" : undefined, fontWeight: clampWeight(f, 600) }} lang={f === "lao" ? "lo" : undefined}>
                  <span className="truncate">{f === "lao" ? m.sample : m.label}</span>
                </button>
              );
            })}
          </div>
          {FONT_META[layer.font].weights[0] !== FONT_META[layer.font].weights[1] && (
            <>
              <Label>Weight — {layer.weight}</Label>
              <input type="range" aria-label="Font weight" min={FONT_META[layer.font].weights[0]} max={FONT_META[layer.font].weights[1]} step={100} value={clampWeight(layer.font, layer.weight)} {...scrub} onChange={(e) => set({ weight: +e.target.value }, true)} className={range} />
            </>
          )}
          {FONT_META[layer.font].italic && layer.font !== "serif" && (
            <button type="button" aria-pressed={Boolean(layer.italic)} onClick={() => set({ italic: !layer.italic })} className={clsx(tile, "t-label mt-2 w-full text-[0.625rem]", layer.italic && "!border-gold !text-gold")}><span className="italic">Italic</span></button>
          )}
          <Label>Letter spacing</Label>
          <input type="range" aria-label="Letter spacing" min={-60} max={400} step={10} value={layer.tracking ?? 0} {...scrub} onChange={(e) => set({ tracking: +e.target.value }, true)} className={range} />
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => set({ text: layer.text.toUpperCase() })} className={clsx(tile, "t-label flex-1 text-[0.625rem]")}>UPPERCASE</button>
            <button type="button" onClick={() => set({ text: layer.text.toLowerCase() })} className={clsx(tile, "t-label flex-1 text-[0.625rem]")}>lowercase</button>
          </div>
        </>
      )}

      {layer.type !== "image" && (<><Label>Ink colour</Label><Swatches size="sm" label="Ink colour" value={layer.fill} colours={inks} onPick={(hex) => set({ fill: hex })} /></>)}

      <Label>Size{mm ? ` — about ${mm} mm wide when printed` : ""}</Label>
      {layer.type === "text"
        ? <input type="range" aria-label="Text size" min={16} max={700} value={Math.round(layer.size)} {...scrub} onChange={(e) => set({ size: +e.target.value }, true)} className={range} />
        : <input type="range" aria-label="Size" min={20} max={1400} value={Math.round(layer.w)} {...scrub} onChange={(e) => { const nw = +e.target.value; set({ w: nw, h: (layer.h / layer.w) * nw }, true); }} className={range} />}

      <Label>Rotation — {Math.round(layer.angle ?? 0)}°</Label>
      <input type="range" aria-label="Rotation" min={-180} max={180} value={Math.round(layer.angle ?? 0)} {...scrub} onChange={(e) => set({ angle: +e.target.value }, true)} className={range} />

      <Label>Opacity</Label>
      <input type="range" aria-label="Opacity" min={10} max={100} value={Math.round((layer.opacity ?? 1) * 100)} {...scrub} onChange={(e) => set({ opacity: +e.target.value / 100 }, true)} className={range} />

      <Label>Align to print area</Label>
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" className={clsx(tile, "t-label text-[0.625rem]")} onClick={() => set({ x: AREA_W / 2 })}>Centre ↔</button>
        <button type="button" className={clsx(tile, "t-label text-[0.625rem]")} onClick={() => set({ y: areaH / 2 })}>Centre ↕</button>
        <button type="button" className={clsx(tile, "t-label text-[0.625rem]")} onClick={() => set({ x: AREA_W / 2, y: areaH / 2, angle: 0 })}>Reset</button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-1.5 border-t border-ink-700 pt-4">
        <button type="button" className={clsx(tile, "t-label gap-2 text-[0.625rem]")} onClick={() => dispatch({ type: "duplicate", id: layer.id })}><Copy aria-hidden strokeWidth={1.5} className="h-4 w-4" />Duplicate</button>
        <button type="button" className={clsx(tile, "t-label gap-2 text-[0.625rem] hover:!border-danger hover:!text-danger")} onClick={() => dispatch({ type: "remove", id: layer.id })}><Trash2 aria-hidden strokeWidth={1.5} className="h-4 w-4" />Delete</button>
      </div>
    </div>
  );
}

/* ── Preflight ───────────────────────────────────────────────────────────── */
const levelStyle: Record<Check["level"], { dot: string; word: string }> = { blocked: { dot: "bg-danger", word: "Fix" }, attention: { dot: "bg-warn", word: "Check" }, info: { dot: "bg-cyan", word: "Note" }, ok: { dot: "bg-ok", word: "Good" } };
export const verdictTone: Record<Verdict, string> = { ready: "border-ok/50 text-ok", attention: "border-warn/50 text-warn", blocked: "border-danger/50 text-danger" };

export function PreflightPanel({ verdict, checks, brandChecks, onLocate }: { verdict: Verdict; checks: Check[]; brandChecks: Check[]; onLocate: (c: Check) => void }) {
  const all = [...checks, ...brandChecks];
  return (
    <div>
      <PanelTitle hint="An automatic check of your artwork before it reaches our team.">Artwork preflight</PanelTitle>
      <p className={clsx("t-label flex items-center gap-2.5 border px-3 py-3", verdictTone[verdict])}><span aria-hidden className={clsx("h-2.5 w-2.5 rounded-full", verdict === "ready" ? "bg-ok" : verdict === "attention" ? "bg-warn" : "bg-danger")} />{VERDICT_LABEL[verdict]}</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {all.map((c) => (
          <li key={c.id}>
            <button type="button" disabled={!c.layerId} onClick={() => onLocate(c)} className="flex w-full gap-3 border border-ink-700 bg-ink-900 p-3 text-left enabled:hover:border-ink-500">
              <span aria-hidden className={clsx("mt-1.5 h-2 w-2 flex-none rounded-full", levelStyle[c.level].dot)} />
              <span className="min-w-0"><span className="block text-sm text-fog-50"><span className="t-label mr-2 text-[0.5625rem] text-fog-500">{levelStyle[c.level].word}{c.side ? ` · ${c.side}` : ""}</span>{c.title}</span><span className="mt-1 block text-sm leading-snug text-fog-400">{c.detail}</span></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-ink-700 pt-4 text-sm text-fog-400">{PREFLIGHT_DISCLAIMER}</p>
    </div>
  );
}

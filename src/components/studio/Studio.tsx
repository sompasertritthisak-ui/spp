"use client";
import { clsx } from "clsx";
import { Download, Layers as LayersIcon, LayoutTemplate, Redo2, Save, ScanSearch, Shapes, Shirt, SlidersHorizontal, Sparkles, Type, Undo2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { DesignTemplate, FeatureFlags, Product } from "@/content/types";
import { recordIntent, track } from "@/lib/backend/analytics";
import { useAuth } from "@/lib/backend/auth";
import { BackendError } from "@/lib/backend/client";
import { getSide } from "@/lib/garments";
import { art, clearDraft, loadBrandPalette, loadDesign, loadDraft, loadShared, registerArt, saveDesign, saveDraft } from "@/lib/studio/persistence";
import { brandHints, runPreflight } from "@/lib/studio/preflight";
import { AREA_W, newLayerId, normaliseSides, usedSides, type DesignDoc, type Layer } from "@/lib/studio/schema";
import { initialState, reducer } from "@/lib/studio/store";
import { loadArtwork, UploadError } from "@/lib/studio/uploads";
import { whatsappHref } from "@/lib/whatsapp";
import { AiPanel } from "./AiPanel";
import { defaultInk, ElementsPanel, Inspector, LayersPanel, PreflightPanel, ProductPanel, TemplatesPanel, TextPanel, UploadPanel, verdictTone } from "./panels";
import { Stage } from "./Stage";
import { VisualiseDialog } from "./VisualiseDialog";

type Tool = "product" | "text" | "elements" | "upload" | "templates" | "layers" | "ai" | "preflight" | "edit";

export function Studio({ products, templates, flags, whatsapp }: { products: Product[]; templates: DesignTemplate[]; flags: FeatureFlags; whatsapp: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const auth = useAuth();

  const first = products[0]!;
  const [state, dispatch] = useReducer(reducer, null, () =>
    initialState({ productSlug: first.slug, garment: first.studio!.garment, colour: first.colours[1]?.hex ?? first.colours[0]?.hex ?? "#17171a", sides: {} }, first.studio!.areas[0]!.key));
  const [tool, setTool] = useState<Tool | null>("product");
  const [zoom, setZoom] = useState(false);
  const [booted, setBooted] = useState(false);
  const [readOnly, setReadOnly] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [visualise, setVisualise] = useState(false);
  const [brand, setBrand] = useState<{ name: string; hex: string }[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const created = useRef(false);

  const product = products.find((p) => p.slug === state.doc.productSlug) ?? first;
  const areas = product.studio!.areas;
  const side = areas.some((a) => a.key === state.side) ? state.side : areas[0]!.key;
  const physical = areas.find((a) => a.key === side);
  const geo = getSide(state.doc.garment, side);
  const areaH = AREA_W * (geo.area.h / geo.area.w);
  const layers = useMemo(() => state.doc.sides[side] ?? [], [state.doc.sides, side]);
  const selected = layers.find((l) => l.id === state.selectedId) ?? null;

  /* ── boot: ?id= (saved) · ?share= (view only) · ?template= · ?product=&text= (from hero / catalogue) · else resume the local draft ── */
  useEffect(() => {
    if (booted || !auth.ready) return;
    let alive = true;
    (async () => {
      const id = params.get("id"), share = params.get("share"), tpl = params.get("template"), prod = params.get("product"), text = params.get("text")?.slice(0, 40);
      try {
        if (id) {
          const d = await loadDesign(id);
          if (alive) dispatch({ type: "load", doc: d.doc, name: d.name, remote: d.remote, templateSlug: d.templateSlug });
        } else if (share) {
          const d = await loadShared(share);
          if (!d) throw new BackendError("That share link is no longer active.", "not_found");
          if (alive) { dispatch({ type: "load", doc: d.doc, name: d.name }); setReadOnly(d.ref); setTool(null); }
        } else {
          const draft = prod || text || tpl ? null : await loadDraft();
          if (draft && products.some((p) => p.slug === draft.doc.productSlug)) {
            if (alive) dispatch({ type: "load", doc: draft.doc, name: draft.name, remote: draft.remote, side: draft.side, templateSlug: draft.templateSlug });
          } else {
            const p = products.find((x) => x.slug === prod) ?? first;
            const t = templates.find((x) => x.slug === tpl && x.garments.includes(p.studio!.garment));
            const colour = t?.suggestedColour ?? p.colours[1]?.hex ?? p.colours[0]?.hex ?? "#17171a";
            const doc: DesignDoc = { productSlug: p.slug, garment: p.studio!.garment, colour, sides: t ? normaliseSides(t.sides) : {} };
            const sideKey = p.studio!.areas[0]!.key;
            if (text) {
              const a = getSide(doc.garment, sideKey).area;
              doc.sides[sideKey] = [{ id: newLayerId(), type: "text", text: text.toUpperCase(), font: "display", weight: 800, size: Math.min(170, 1500 / Math.max(text.length, 4)), fill: defaultInk(colour), x: AREA_W / 2, y: (AREA_W * (a.h / a.w)) * 0.36, angle: 0, opacity: 1, tracking: 0, align: "center" }];
            }
            if (alive) dispatch({ type: "load", doc, side: sideKey, templateSlug: t?.slug ?? null });
            if (text && alive) setTool("text");
          }
        }
      } catch (e) {
        if (alive) toast(e instanceof BackendError ? e.message : "We could not open that design.", "danger");
      }
      if (alive) { setBooted(true); track("customizer_started", { product: prod ?? undefined }); recordIntent("design", "opened", { product: prod ?? undefined }); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready]);

  useEffect(() => { if (auth.user && !auth.isGuest) void loadBrandPalette(auth.user.id).then(setBrand); }, [auth.user, auth.isGuest]);

  /* ── autosave the working draft to this device ── */
  useEffect(() => {
    if (!booted || readOnly) return;
    const t = setTimeout(() => saveDraft({ doc: state.doc, name: state.name, side, remote: state.remote, templateSlug: state.templateSlug }), 500);
    return () => clearTimeout(t);
  }, [booted, readOnly, state.doc, state.name, state.remote, state.templateSlug, side]);

  useEffect(() => {
    if (!state.dirty) return;
    const warn = (e: BeforeUnloadEvent) => { if (state.remote) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty, state.remote]);

  const hasArt = usedSides(state.doc.sides).length > 0;
  useEffect(() => {
    if (hasArt && !created.current && booted) { created.current = true; track("design_created", { product: product.slug }); recordIntent("design", "artwork_added", { product: product.slug }); }
  }, [hasArt, booted, product.slug]);

  /* ── preflight runs continuously; it is cheap and the verdict chip should never be stale ── */
  const preflight = useMemo(() => runPreflight({ sides: state.doc.sides, colour: state.doc.colour, areas, assetMeta: (l) => art.get(l)?.meta }), [state.doc.sides, state.doc.colour, areas]);
  const brandChecks = useMemo(() => brandHints(state.doc.sides, brand), [state.doc.sides, brand]);

  const add = useCallback((l: Layer) => { dispatch({ type: "add", layer: l }); setTool("edit"); }, []);

  const onFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploadBusy(true);
    setUploadError(null);
    for (const file of files.slice(0, 4)) {
      try {
        const a = await loadArtwork(file);
        const key = newLayerId();
        await registerArt(key, a);
        const w = Math.min(560, AREA_W * 0.6), h = w * (a.meta.naturalH / a.meta.naturalW);
        const fitH = Math.min(h, areaH * 0.7), k = fitH / h;
        dispatch({ type: "add", layer: { id: newLayerId(), type: "image", artKey: key, name: a.name, mime: a.meta.mime, vector: a.meta.vector, naturalW: a.meta.naturalW, naturalH: a.meta.naturalH, w: w * k, h: fitH, x: AREA_W / 2, y: areaH * 0.42, angle: 0, opacity: 1 } });
        track("artwork_uploaded", { product: product.slug });
        recordIntent("design", "artwork_uploaded", { product: product.slug });
        setTool("edit");
      } catch (e) {
        setUploadError(e instanceof UploadError ? e.message : "We could not read that file. Try a PNG or SVG.");
      }
    }
    setUploadBusy(false);
  }, [areaH, product.slug]);

  /* ── save ── */
  const save = useCallback(async (): Promise<string | null> => {
    if (!auth.configured) { toast("Saved on this device. Online accounts are not switched on yet, so it stays in this browser.", "neutral"); return null; }
    setSaving(true);
    try {
      const user = await auth.ensureSession();
      const r = await saveDesign({ doc: state.doc, name: state.name, remote: state.remote, templateSlug: state.templateSlug, userId: user.id, preflight: { verdict: preflight.verdict, checks: preflight.checks } });
      dispatch({ type: "saved", remote: r.remote, doc: r.doc });
      track("design_saved", { product: product.slug, ref: r.remote.ref });
      recordIntent("design", "saved", { product: product.slug, ref: r.remote.ref });
      toast(`Saved as ${r.remote.ref}`, "ok");
      return r.remote.ref;
    } catch (e) {
      toast(e instanceof BackendError ? e.message : "We could not save your design. Please try again.", "danger");
      return null;
    } finally { setSaving(false); }
  }, [auth, state.doc, state.name, state.remote, state.templateSlug, preflight, product.slug, toast]);

  const requestQuote = async () => {
    let ref = state.remote?.ref ?? null;
    if (auth.configured && (state.dirty || !ref) && hasArt) ref = await save();
    if (auth.configured && hasArt && !ref) return; // save failed; the toast already explained why
    clearDraftIfSaved();
    const q = new URLSearchParams({ product: product.slug, qty: String(product.moq) });
    if (ref) q.set("design", ref);
    router.push(`/request-quote/?${q}`);
  };
  const clearDraftIfSaved = () => { if (state.remote && !state.dirty) clearDraft(); };

  /* ── keyboard ── */
  useEffect(() => {
    if (readOnly) return;
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); return; }
      if (typing || !selected) return;
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); dispatch({ type: "duplicate", id: selected.id }); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); dispatch({ type: "remove", id: selected.id }); }
      else if (e.key === "Escape") dispatch({ type: "select", id: null });
      else if (e.key === "]") dispatch({ type: "reorder", id: selected.id, to: "up" });
      else if (e.key === "[") dispatch({ type: "reorder", id: selected.id, to: "down" });
      else if (e.key.startsWith("Arrow") && !selected.locked) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 2;
        dispatch({ type: "update", id: selected.id, patch: { x: selected.x + (e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0), y: selected.y + (e.key === "ArrowDown" ? d : e.key === "ArrowUp" ? -d : 0) } });
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [selected, save, readOnly]);

  const tools: { key: Tool; label: string; icon: typeof Type; show?: boolean }[] = [
    { key: "product", label: "Product", icon: Shirt },
    { key: "templates", label: "Templates", icon: LayoutTemplate },
    { key: "text", label: "Text", icon: Type },
    { key: "elements", label: "Elements", icon: Shapes },
    { key: "upload", label: "Upload", icon: Upload },
    { key: "ai", label: "AI Assist", icon: Sparkles, show: flags.AI_DESIGN },
    { key: "layers", label: "Layers", icon: LayersIcon },
    { key: "preflight", label: "Preflight", icon: ScanSearch },
  ];
  const wa = whatsappHref(whatsapp, state.remote ? { kind: "design", product: product.name, designRef: state.remote.ref, sides: usedSides(state.doc.sides) } : { kind: "product", product: product.name });

  const panel = tool === "product" ? <ProductPanel products={products} product={product} state={state} dispatch={dispatch} />
    : tool === "text" ? <TextPanel add={add} garmentColour={state.doc.colour} areaH={areaH} />
    : tool === "elements" ? <ElementsPanel add={add} garmentColour={state.doc.colour} areaH={areaH} />
    : tool === "upload" ? <UploadPanel onFiles={onFiles} busy={uploadBusy} error={uploadError} />
    : tool === "templates" ? <TemplatesPanel templates={templates} state={state} onApply={(t) => { dispatch({ type: "applyTemplate", sides: normaliseSides(t.sides), colour: product.colours.some((c) => c.hex.toLowerCase() === t.suggestedColour.toLowerCase()) ? t.suggestedColour : undefined, slug: t.slug }); toast(`“${t.name}” applied — every word is editable.`, "ok"); }} />
    : tool === "layers" ? <LayersPanel layers={layers} selectedId={state.selectedId} dispatch={dispatch} />
    : tool === "ai" ? <AiPanel product={product} state={state} side={side} areaAspect={geo.area.h / geo.area.w} brand={brand} onApply={(ls, replace) => { dispatch({ type: "addMany", layers: ls.map((l) => ({ ...l, id: newLayerId() })), replace }); toast("Suggestion applied. Undo brings your design back.", "ok"); }} onColour={(c) => dispatch({ type: "setColour", colour: c })} />
    : tool === "preflight" ? <PreflightPanel verdict={preflight.verdict} checks={preflight.checks} brandChecks={brandChecks} onLocate={(c) => { if (c.side) dispatch({ type: "setSide", side: c.side }); if (c.layerId) { dispatch({ type: "select", id: c.layerId }); setTool("edit"); } }} />
    : tool === "edit" && selected ? <Inspector layer={selected} dispatch={dispatch} areaH={areaH} physical={physical} brand={brand} textRef={textRef} />
    : tool === "edit" ? <p className="text-sm text-fog-400">Select something on the garment to edit it.</p> : null;

  const iconBtn = "flex h-11 w-11 flex-none items-center justify-center text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-50 disabled:opacity-30";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink-950">
      {/* ── top bar ── */}
      <header className="flex flex-none flex-wrap items-center gap-x-2 border-b border-ink-700 bg-ink-900 px-2 sm:h-14 sm:flex-nowrap sm:px-3">
        <Link href="/spp-studio/" aria-label="Leave SPP Studio" className="flex h-14 items-center gap-2.5 px-2"><Logo className="h-4" /><span className="t-label hidden text-yellow md:block">Studio</span></Link>
        <input aria-label="Design name" value={state.name} readOnly={Boolean(readOnly)} onChange={(e) => dispatch({ type: "rename", name: e.target.value })} className="hidden h-9 w-44 min-w-0 border border-transparent bg-transparent px-2 text-sm text-fog-100 hover:border-ink-600 focus:border-yellow focus:outline-none lg:block" />
        {state.remote && <span className="t-label hidden text-[0.625rem] text-fog-500 xl:block">{state.remote.ref} · v{state.remote.version}</span>}

        {/* phones: the print-area switch gets its own full-width row so REQUEST QUOTE always stays on screen */}
        <div role="tablist" aria-label="Print area" className="order-last -mx-2 flex w-[calc(100%+1rem)] border-t border-ink-700 sm:order-none sm:mx-auto sm:w-auto sm:border sm:border-ink-600">
          {areas.map((a) => {
            const on = a.key === side, used = (state.doc.sides[a.key] ?? []).some((l) => !l.hidden);
            return (
              <button key={a.key} role="tab" type="button" aria-selected={on} onClick={() => dispatch({ type: "setSide", side: a.key })} className={clsx("t-label relative flex min-h-11 flex-1 items-center justify-center gap-1.5 px-2.5 text-[0.625rem] transition-colors sm:min-h-10 sm:flex-none sm:px-4 sm:text-[0.6875rem]", on ? "bg-yellow text-ink-950" : "text-fog-300 hover:bg-ink-800")}>
                {a.label.replace(" sleeve", "").replace("Front panel", "Front")}{a.key.includes("sleeve") && <span className="hidden sm:inline">&nbsp;sleeve</span>}
                {used && <span aria-label="has artwork" className={clsx("h-1.5 w-1.5 rounded-full", on ? "bg-ink-950" : "bg-yellow")} />}
              </button>
            );
          })}
        </div>

        {!readOnly && (
          <div className="ml-auto flex items-center sm:ml-0">
            <button type="button" className={iconBtn} aria-label="Undo" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}><Undo2 aria-hidden strokeWidth={1.5} className="h-[1.125rem] w-[1.125rem]" /></button>
            <button type="button" className={iconBtn} aria-label="Redo" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}><Redo2 aria-hidden strokeWidth={1.5} className="h-[1.125rem] w-[1.125rem]" /></button>
            <button type="button" className={clsx(iconBtn, "hidden sm:flex")} aria-label={zoom ? "Show whole garment" : "Zoom to print area"} aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>{zoom ? <ZoomOut aria-hidden strokeWidth={1.5} className="h-[1.125rem] w-[1.125rem]" /> : <ZoomIn aria-hidden strokeWidth={1.5} className="h-[1.125rem] w-[1.125rem]" />}</button>
            <button type="button" className={clsx(iconBtn, "hidden md:flex")} aria-label="Save design" disabled={saving} onClick={() => void save()}><Save aria-hidden strokeWidth={1.5} className="h-[1.125rem] w-[1.125rem]" /></button>
          </div>
        )}
        <Button size="sm" variant="outline" onClick={() => setVisualise(true)} className="hidden sm:inline-flex"><Download aria-hidden strokeWidth={1.5} className="h-4 w-4" />Visualise</Button>
        <Button size="sm" arrow onClick={() => (readOnly ? router.push(`/design/?product=${product.slug}`) : void requestQuote())} loading={saving}>{readOnly ? "Design your own" : "Request quote"}</Button>
      </header>

      {readOnly && <p className="t-label flex-none bg-yellow px-4 py-2 text-center text-ink-950">Shared design {readOnly} · view only</p>}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── tool rail (desktop left / mobile bottom) ── */}
        {!readOnly && (
          <nav aria-label="Design tools" className="thin-scroll order-3 flex flex-none overflow-x-auto border-t border-ink-700 bg-ink-900 pb-[env(safe-area-inset-bottom)] lg:order-1 lg:w-[4.75rem] lg:flex-col lg:overflow-y-auto lg:border-r lg:border-t-0 lg:pb-0">
            {[...tools.filter((t) => t.show !== false), ...(selected ? [{ key: "edit" as Tool, label: "Edit", icon: SlidersHorizontal }] : [])].map((t) => (
              <button key={t.key} type="button" aria-pressed={tool === t.key} onClick={() => setTool((cur) => (cur === t.key ? null : t.key))} className={clsx("relative flex min-h-[3.75rem] min-w-[4.25rem] flex-1 flex-col items-center justify-center gap-1.5 px-1 transition-colors lg:flex-none", tool === t.key ? "bg-ink-800 text-yellow" : "text-fog-400 hover:text-fog-50", t.key === "edit" && "lg:hidden")}>
                <t.icon aria-hidden strokeWidth={1.5} className="h-5 w-5" />
                <span className="t-label text-[0.5625rem] tracking-[0.08em]">{t.label}</span>
                {t.key === "preflight" && preflight.verdict !== "ready" && <span aria-hidden className={clsx("absolute right-3 top-2.5 h-2 w-2 rounded-full", preflight.verdict === "blocked" ? "bg-danger" : "bg-warn")} />}
              </button>
            ))}
          </nav>
        )}

        {/* ── tool panel ── */}
        {!readOnly && tool && tool !== "edit" && (
          <aside aria-label={`${tool} panel`} className="thin-scroll order-2 max-h-[44svh] flex-none overflow-y-auto border-t border-ink-700 bg-ink-850 p-4 lg:order-2 lg:max-h-none lg:w-[21rem] lg:border-r lg:border-t-0 lg:p-5">{panel}</aside>
        )}
        {!readOnly && tool === "edit" && <aside aria-label="Edit panel" className="thin-scroll order-2 max-h-[44svh] flex-none overflow-y-auto border-t border-ink-700 bg-ink-850 p-4 lg:hidden">{panel}</aside>}

        {/* ── stage ── */}
        <main className="grain relative order-1 min-h-0 flex-1 bg-[radial-gradient(ellipse_at_50%_42%,#3a4288_0%,#1a2056_45%,#0b0e2c_100%)] lg:order-3">
          <div aria-hidden className="halftone pointer-events-none absolute inset-0 text-fog-50/[0.035]" />
          <div className="absolute inset-0 p-3 sm:p-6">
            {booted ? <Stage garment={state.doc.garment} side={side} colour={state.doc.colour} layers={layers} selectedId={state.selectedId} dispatch={dispatch} physical={physical} zoomToArea={zoom} readOnly={Boolean(readOnly)} onEditText={() => { setTool("edit"); setTimeout(() => textRef.current?.select(), 60); }} />
              : <div className="flex h-full items-center justify-center"><Logo animate className="h-8" /></div>}
          </div>
          <button type="button" onClick={() => setTool("preflight")} className={clsx("t-label absolute left-3 top-3 flex min-h-9 items-center gap-2 border bg-ink-950/80 px-2.5 text-[0.625rem] backdrop-blur-sm sm:left-5 sm:top-5", verdictTone[preflight.verdict], readOnly && "hidden")}>
            <span aria-hidden className={clsx("h-2 w-2 rounded-full", preflight.verdict === "ready" ? "bg-ok" : preflight.verdict === "attention" ? "bg-warn" : "bg-danger")} />
            {preflight.verdict === "ready" ? "Ready for review" : preflight.verdict === "attention" ? "Needs attention" : "Not production ready"}
          </button>
          {!hasArt && booted && !readOnly && (
            <p className="pointer-events-none absolute inset-x-0 bottom-5 mx-auto max-w-xs px-4 text-center text-sm text-fog-400">Start with a <span className="text-fog-50">template</span>, add <span className="text-fog-50">text</span>, or <span className="text-fog-50">upload</span> your logo.</p>
          )}
          <div className="absolute bottom-3 right-3 flex gap-2 sm:hidden">
            <button type="button" onClick={() => setVisualise(true)} aria-label="Visualise and download mockup" className="flex h-11 w-11 items-center justify-center border border-ink-500 bg-ink-900/90 text-fog-50 backdrop-blur"><Download aria-hidden strokeWidth={1.5} className="h-5 w-5" /></button>
            {!readOnly && <button type="button" onClick={() => void save()} aria-label="Save design" disabled={saving} className="flex h-11 w-11 items-center justify-center border border-ink-500 bg-ink-900/90 text-fog-50 backdrop-blur"><Save aria-hidden strokeWidth={1.5} className="h-5 w-5" /></button>}
          </div>
        </main>

        {/* ── inspector (desktop) ── */}
        {!readOnly && (
          <aside aria-label="Selection" className="thin-scroll order-4 hidden w-[19rem] flex-none overflow-y-auto border-l border-ink-700 bg-ink-850 p-5 lg:block">
            {selected ? <Inspector layer={selected} dispatch={dispatch} areaH={areaH} physical={physical} brand={brand} textRef={textRef} /> : (
              <div className="flex h-full flex-col">
                <LayersPanel layers={layers} selectedId={state.selectedId} dispatch={dispatch} />
                <div className="mt-auto border-t border-ink-700 pt-5">
                  <p className="t-label mb-3 text-[0.625rem] text-fog-500">Shortcuts</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-fog-400">
                    {[["⌘Z / ⇧⌘Z", "Undo / redo"], ["⌘D", "Duplicate"], ["⌫", "Delete"], ["← ↑ → ↓", "Nudge (⇧ ×5)"], ["[ ]", "Layer order"], ["⌘S", "Save"]].map(([k, v]) => <div key={k} className="contents"><dt className="t-data text-fog-300">{k}</dt><dd>{v}</dd></div>)}
                  </dl>
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { step: "studio" })} className="t-label mt-5 flex min-h-11 items-center justify-center border border-ink-600 text-fog-200 hover:border-yellow hover:text-yellow">Ask SPP on WhatsApp</a>}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      <VisualiseDialog open={visualise} onClose={() => setVisualise(false)} doc={state.doc} name={state.name} designRef={state.remote?.ref ?? readOnly} productName={product.name} dirty={state.dirty && auth.configured && !readOnly} onSave={save} />
    </div>
  );
}

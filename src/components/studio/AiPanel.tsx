"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { JarvisPanel, JarvisTitle } from "@/components/jarvis/JarvisPanel";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/content/types";
import { track } from "@/lib/backend/analytics";
import { useAuth } from "@/lib/backend/auth";
import { BackendError } from "@/lib/backend/client";
import type { JarvisAction } from "@/lib/jarvis";
import { askAssistant, type AiSuggestion } from "@/lib/studio/ai";
import type { Layer } from "@/lib/studio/schema";
import type { StudioState } from "@/lib/studio/store";
import { DesignThumb } from "./DesignThumb";

const EXAMPLES = ["A premium black polo for a boutique hotel", "A fun Pi Mai festival T-shirt for our staff", "Minimal logo placement for a riverside café", "Bold match-day shirt for a football club"];

type Props = { product: Product; state: StudioState; side: string; areaAspect: number; brand: { name: string; hex: string }[]; onApply: (layers: Layer[], replace: boolean) => void; onColour: (hex: string) => void };

/**
 * JARVIS inside Studio: a chat with SPP's production expert, plus the layout
 * engine. Assistive only — the layout is a proposal until the customer presses
 * Apply (a normal undoable edit). Nothing here saves, orders or contacts anyone.
 */
export function AiPanel(props: Props) {
  const auth = useAuth();
  const [tab, setTab] = useState<"chat" | "layout">("chat");
  const [brief, setBrief] = useState("");
  const { product, state, side } = props;

  if (!auth.configured)
    return (<div><JarvisTitle /><p className="mt-4 border border-gold/40 p-4 text-sm text-fog-300">Jarvis is not switched on yet. Templates, text, elements and uploads all work without him.</p></div>);

  const context = () => ({ product: product.slug, garment: state.doc.garment, colour: state.doc.colour, side, existingText: (state.doc.sides[side] ?? []).flatMap((l) => (l.type === "text" ? [l.text] : [])) });
  const label = (a: JarvisAction) => (a.type === "suggest_layout" ? "Draft this layout on the garment" : null);
  const onAction = (a: JarvisAction) => { if (a.type === "suggest_layout") { setBrief(a.prompt ?? ""); setTab("layout"); } };
  const tabCls = (on: boolean) => clsx("t-label min-h-10 flex-1 border-b-2 text-[0.625rem] transition-colors", on ? "border-gold text-gold" : "border-transparent text-fog-400 hover:text-fog-50");

  return (
    <div className="flex h-full min-h-[24rem] flex-col">
      <JarvisTitle className="mb-3" />
      <div role="tablist" aria-label="Jarvis" className="mb-3 flex border-b border-ink-700">
        <button role="tab" type="button" aria-selected={tab === "chat"} onClick={() => setTab("chat")} className={tabCls(tab === "chat")}>Ask Jarvis</button>
        <button role="tab" type="button" aria-selected={tab === "layout"} onClick={() => setTab("layout")} className={tabCls(tab === "layout")}>Lay it out</button>
      </div>
      {tab === "chat"
        ? <JarvisPanel mode="studio" context={context} onAction={onAction} actionLabel={label} compact className="min-h-0 flex-1" />
        : <LayoutTab key={brief} initial={brief} {...props} />}
    </div>
  );
}

function LayoutTab({ product, state, side, areaAspect, brand, onApply, onColour, initial }: Props & { initial: string }) {
  const auth = useAuth();
  const [prompt, setPrompt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiSuggestion | null>(null);

  const run = async () => {
    if (prompt.trim().length < 6) return setError("Describe what you are making in a few words.");
    setBusy(true); setError(null);
    try {
      await auth.ensureSession(); // the function only answers signed-in (incl. guest) sessions, so usage can be rate-limited per person
      const existingText = (state.doc.sides[side] ?? []).flatMap((l) => (l.type === "text" ? [l.text] : []));
      setResult(await askAssistant(prompt, { productSlug: product.slug, productName: product.name, garment: state.doc.garment, side, colour: state.doc.colour, areaAspect, availableColours: product.colours, brandColours: brand.map((b) => b.hex), existingText }));
      track("ai_assist_used", { product: product.slug });
    } catch (e) {
      setError(e instanceof BackendError ? e.message : "The layout engine is not available right now.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <p className="mb-3 text-sm leading-snug text-fog-400">Describe the idea. Jarvis drafts a layout, colours and wording on the print area you are editing — you decide what to keep.</p>
      <label htmlFor="ai-prompt" className="t-label mb-2 block text-[0.625rem] text-fog-500">The brief</label>
      <textarea id="ai-prompt" rows={3} maxLength={600} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. I need a premium black polo for a hotel." className="w-full resize-y border border-ink-600 bg-ink-950 p-3 text-base text-fog-50 placeholder:text-fog-500 focus:border-gold focus:outline-none" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setPrompt(e)} className="min-h-9 border border-ink-600 px-2.5 text-left text-xs text-fog-300 hover:border-gold hover:text-fog-50">{e}</button>)}
      </div>
      <Button onClick={() => void run()} loading={busy} className="mt-4 w-full">{busy ? "Drafting…" : "Draft a layout"}</Button>
      {error && <p role="alert" className="mt-3 border border-danger/40 bg-danger/10 p-3 text-sm text-fog-50">{error}</p>}

      {result && (
        <div aria-live="polite" className="mt-5 border-t border-gold/25 pt-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-fog-200">{result.message}</p>
          {result.layers.length > 0 && (
            <>
              <DesignThumb garment={state.doc.garment} side={side} colour={result.colour ?? state.doc.colour} layers={result.layers} className="mt-4 h-52 w-full border border-gold/30 bg-ink-900" title="Suggested layout" />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Button size="sm" onClick={() => onApply(result.layers, true)}>Replace this side</Button>
                <Button size="sm" variant="outline" onClick={() => onApply(result.layers, false)}>Add to design</Button>
              </div>
            </>
          )}
          {result.colour && result.colour.toLowerCase() !== state.doc.colour.toLowerCase() && (
            <button type="button" onClick={() => onColour(result.colour!)} className="mt-3 flex min-h-11 w-full items-center gap-3 border border-ink-600 px-3 text-sm text-fog-200 hover:border-gold">
              <span aria-hidden className="h-6 w-6 rounded-full border border-ink-500" style={{ background: result.colour }} />Use suggested garment colour {result.colour.toUpperCase()}
            </button>
          )}
          {result.ideas.length > 0 && (<><p className="t-label mb-2 mt-5 text-[0.625rem] text-fog-500">Wording ideas</p><ul className="flex flex-col gap-1 text-sm text-fog-300">{result.ideas.map((i) => <li key={i} className="border-l border-gold/50 pl-3">{i}</li>)}</ul></>)}
        </div>
      )}
      <p className="mt-5 border-t border-ink-700 pt-4 text-sm text-fog-400">Suggestions are a starting point and can be wrong. Jarvis never orders, approves artwork or contacts anyone — only you do.</p>
    </div>
  );
}

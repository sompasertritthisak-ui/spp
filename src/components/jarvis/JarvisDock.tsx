"use client";
import { clsx } from "clsx";
import { useState } from "react";
import type { ActionLabel } from "./JarvisPanel";
import { JarvisMark, JarvisPanel, JarvisTitle } from "./JarvisPanel";
import type { JarvisAction, JarvisContext, JarvisMode } from "@/lib/jarvis";

/**
 * A floating "Ask Jarvis" button that opens a chat panel beside the page —
 * the page stays usable, so Jarvis's suggestions can be applied and seen at once.
 */
export function JarvisDock({ mode, context, onAction, actionLabel, className }: { mode: JarvisMode; context: () => JarvisContext; onAction: (a: JarvisAction) => void; actionLabel: ActionLabel; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={open} aria-controls="jarvis-dock" onClick={() => setOpen((v) => !v)}
        className={clsx("fixed right-4 z-40 flex min-h-12 items-center gap-3 border border-gold bg-ink-950/90 pl-1.5 pr-4 text-fog-50 shadow-2xl shadow-black/60 backdrop-blur transition-colors hover:bg-gold hover:text-ink-950", className)}>
        <JarvisMark className="h-9 w-9" />
        <span className="t-label">{open ? "Close Jarvis" : "Ask Jarvis"}</span>
      </button>
      {open && (
        <section id="jarvis-dock" aria-label="Jarvis, SPP's production expert" className="fixed bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] right-4 z-40 flex h-[min(34rem,calc(100dvh-12rem))] w-[min(26rem,calc(100vw-2rem))] flex-col border border-gold/60 bg-ink-900 p-4 shadow-2xl shadow-black/70 [animation:register_.25s_var(--ease-press)] lg:bottom-24">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-gold/25 pb-3">
            <JarvisTitle />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Jarvis" className="flex h-9 w-9 items-center justify-center text-fog-400 hover:text-fog-50">
              <svg aria-hidden viewBox="0 0 14 14" className="h-3 w-3" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l12 12M13 1L1 13" /></svg>
            </button>
          </div>
          <JarvisPanel mode={mode} context={context} onAction={onAction} actionLabel={actionLabel} compact className="min-h-0 flex-1" />
        </section>
      )}
    </>
  );
}

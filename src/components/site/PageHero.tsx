import type { ReactNode } from "react";
import { Plate } from "@/components/ui/Plate";

/** Standard interior-page opener: plate marker, display headline, lede, optional actions/aside. */
export function PageHero({ plate, eyebrow, title, lede, actions, aside }: { plate?: string; eyebrow: string; title: ReactNode; lede?: ReactNode; actions?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="grain glow-brand relative isolate overflow-hidden border-b border-gold/30 pt-[calc(var(--nav-h)+4rem)] lg:pt-[calc(var(--nav-h)+7rem)]">
      <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 right-0 -z-10 w-2/3 text-gold/[0.16] [mask-image:radial-gradient(ellipse_at_80%_30%,black,transparent_70%)]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gold" />
      <div className="shell grid gap-10 pb-14 lg:grid-cols-[1fr_auto] lg:items-end lg:pb-20">
        <div className="max-w-5xl">
          <Plate n={plate} className="mb-7">{eyebrow}</Plate>
          <h1 className="t-display text-fog-50 [animation:ink-in_.9s_var(--ease-sheet)_both]">{title}</h1>
          {lede && <p className="t-lede mt-7 max-w-2xl [animation:register_.8s_var(--ease-press)_.25s_both]">{lede}</p>}
          {actions && <div className="mt-9 flex flex-wrap gap-3 [animation:register_.8s_var(--ease-press)_.4s_both]">{actions}</div>}
        </div>
        {aside && <div className="[animation:register_.8s_var(--ease-press)_.5s_both]">{aside}</div>}
      </div>
    </section>
  );
}

export type SectionTone = "ink" | "paper" | "raised" | "gold";

/**
 * Page section. Tones: ink (default ground) · raised (a shade lighter, gold-ruled) ·
 * paper (white) · gold (the signature surface — use for one band per page, ink text only).
 */
export function Section({ children, tone = "ink", className = "", id }: { children: ReactNode; tone?: SectionTone; className?: string; id?: string }) {
  const tones = { ink: "bg-ink-950", raised: "bg-ink-900 border-y border-gold/25", paper: "on-paper", gold: "on-gold" } as const;
  return (
    <section id={id} className={`${tones[tone]} py-20 lg:py-32 ${className}`}>
      <div className="shell">{children}</div>
    </section>
  );
}

export function SectionHead({ plate, eyebrow, title, lede, tone = "ink", action }: { plate?: string; eyebrow: string; title: ReactNode; lede?: ReactNode; tone?: "ink" | "paper" | "gold"; action?: ReactNode }) {
  const light = tone === "paper" || tone === "gold";
  return (
    <header className="mb-12 grid gap-6 lg:mb-16 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="max-w-4xl">
        <Plate n={plate} tone={tone} className="mb-6">{eyebrow}</Plate>
        <h2 className={`t-display ${light ? "text-paper-ink" : "text-fog-50"}`}>{title}</h2>
        {lede && <p className={`mt-6 max-w-2xl text-lg leading-relaxed ${tone === "paper" ? "text-paper-mute" : tone === "gold" ? "text-ink-950/75" : "text-fog-300"}`}>{lede}</p>}
        <span aria-hidden className={`gold-bar mt-7 ${tone === "gold" ? "!bg-ink-950" : ""}`} />
      </div>
      {action}
    </header>
  );
}

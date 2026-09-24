import { clsx } from "clsx";
import type { ReactNode } from "react";

/** Section marker in the printer's idiom: a registration target, a plate number, a name. */
export function Plate({ n, children, className, tone = "ink" }: { n?: string; children: ReactNode; className?: string; tone?: "ink" | "paper" | "gold" }) {
  return (
    <p className={clsx("t-label flex items-center gap-3", tone === "ink" ? "text-fog-400" : tone === "gold" ? "text-ink-950" : "text-paper-mute", className)}>
      <span aria-hidden className={clsx("reg", tone === "ink" ? "text-yellow" : "text-paper-ink")} />
      {n && <span className={tone === "ink" ? "text-fog-50" : "text-paper-ink"}>Plate {n}</span>}
      {n && <span aria-hidden className="h-px w-6 bg-current opacity-40" />}
      <span className={tone === "ink" ? "text-gold" : undefined}>{children}</span>
    </p>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" | "yellow" | "info"; className?: string }) {
  const tones = {
    neutral: "border-ink-500 text-fog-300",
    ok: "border-ok/50 text-ok",
    warn: "border-warn/50 text-warn",
    danger: "border-danger/50 text-danger",
    yellow: "border-yellow/60 text-yellow",
    info: "border-cyan/50 text-cyan",
  } as const;
  return <span className={clsx("t-label inline-flex items-center gap-1.5 border px-2 py-1 text-[0.625rem]", tones[tone], className)}>{children}</span>;
}

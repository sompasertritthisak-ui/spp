import { clsx } from "clsx";
import type { BillboardStatus } from "@/content/types";
import { STATUS } from "@/lib/geo/sites";

/**
 * One glyph per status, distinct in SHAPE as well as tone, so the map reads in
 * greyscale and for colour-blind visitors:
 *   available  solid disc      reserved     half-filled disc
 *   maintenance  open diamond  unavailable  cross
 */
export function StatusGlyph({ status, size = 16, className }: { status: BillboardStatus; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, className: clsx("flex-none", className) } as const;
  switch (status) {
    case "available":
      return <svg {...common}><circle cx="8" cy="8" r="6" className="fill-yellow" /><circle cx="8" cy="8" r="1.75" className="fill-ink-950" /></svg>;
    case "reserved":
      return <svg {...common}><circle cx="8" cy="8" r="5.5" className="fill-ink-950 stroke-fog-100" strokeWidth="1.5" /><path d="M8 2.5a5.5 5.5 0 0 0 0 11z" className="fill-fog-100" /></svg>;
    case "maintenance":
      return <svg {...common}><path d="M8 1.75 14.25 8 8 14.25 1.75 8z" className="fill-ink-950 stroke-warn" strokeWidth="1.5" /><path d="M8 5.5v3M8 10.2v.6" className="stroke-warn" strokeWidth="1.5" /></svg>;
    default:
      return <svg {...common}><circle cx="8" cy="8" r="6.25" className="fill-ink-950 stroke-fog-500" strokeWidth="1" /><path d="M5.25 5.25l5.5 5.5M10.75 5.25l-5.5 5.5" className="stroke-fog-400" strokeWidth="1.5" /></svg>;
  }
}

const tone: Record<BillboardStatus, string> = { available: "text-yellow", reserved: "text-fog-100", maintenance: "text-warn", unavailable: "text-fog-400" };

/** Glyph + word. The word is always present; the tone is reinforcement only. */
export function StatusTag({ status, className }: { status: BillboardStatus; className?: string }) {
  return (
    <span className={clsx("t-label inline-flex items-center gap-2", tone[status], className)}>
      <StatusGlyph status={status} size={14} />
      {STATUS[status].label}
    </span>
  );
}

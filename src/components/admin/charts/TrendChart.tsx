"use client";
import { useState } from "react";
import { formatDate, formatNumber } from "@/lib/format";

export type TrendPoint = { day: string; value: number };

/**
 * Single-series area/line with a hover + keyboard crosshair. Two measures of
 * different scale are drawn as two of these stacked (small multiples) — never
 * a dual axis.
 */
export function TrendChart({ name, points, tone = "yellow" }: { name: string; points: TrendPoint[]; tone?: "yellow" | "cyan" }) {
  const [at, setAt] = useState<number | null>(null);
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 60 - (v / max) * 54 - 2;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(" ");
  const stroke = tone === "yellow" ? "stroke-yellow" : "stroke-cyan", fill = tone === "yellow" ? "fill-yellow/10" : "fill-cyan/10", dot = tone === "yellow" ? "bg-yellow" : "bg-cyan";
  const peak = points.reduce((b, p, i) => (p.value > (points[b]?.value ?? -1) ? i : b), 0);
  const cur = at != null ? points[at] : null;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-fog-300"><span aria-hidden className={`h-0.5 w-4 ${dot}`} />{name}</p>
        <p className="t-data text-xs text-fog-400" aria-live="polite">{cur ? <><span className="text-fog-50">{formatNumber(cur.value)}</span> · {formatDate(cur.day, { day: "numeric", month: "short" })}</> : <>total <span className="text-fog-50">{formatNumber(total)}</span> · peak {formatNumber(points[peak]?.value ?? 0)}</>}</p>
      </div>
      <div
        role="img" tabIndex={0} aria-label={`${name}: ${formatNumber(total)} in total over ${n} days, peak ${formatNumber(points[peak]?.value ?? 0)} on ${formatDate(points[peak]?.day)}. Use arrow keys to read daily values.`}
        className="relative h-24 w-full cursor-crosshair border-b border-l border-ink-700 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setAt(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * (n - 1))))); }}
        onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setAt((a) => Math.min(n - 1, (a ?? -1) + 1)); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); setAt((a) => Math.max(0, (a ?? n) - 1)); }
          else if (e.key === "Escape") setAt(null);
        }}
      >
        <svg aria-hidden viewBox="0 0 100 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <line x1="0" x2="100" y1={y(max)} y2={y(max)} className="stroke-ink-700" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          {n > 1 && <path d={`${line} L100 60 L0 60 Z`} className={fill} />}
          {n > 1 && <path d={line} fill="none" className={stroke} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          {at != null && <line x1={x(at)} x2={x(at)} y1="0" y2="60" className="stroke-fog-400" vectorEffect="non-scaling-stroke" />}
        </svg>
        {at != null && cur && <span aria-hidden className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 ring-2 ring-ink-900 ${dot}`} style={{ left: `${x(at)}%`, top: `${(y(cur.value) / 60) * 100}%` }} />}
        <span className="t-data absolute left-1 top-0 text-[0.625rem] text-fog-500">{formatNumber(max)}</span>
      </div>
      <div className="t-data mt-1 flex justify-between text-[0.625rem] text-fog-500"><span>{formatDate(points[0]?.day, { day: "numeric", month: "short" })}</span><span>{formatDate(points[n - 1]?.day, { day: "numeric", month: "short" })}</span></div>
    </div>
  );
}

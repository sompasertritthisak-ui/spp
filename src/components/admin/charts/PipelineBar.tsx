import Link from "next/link";
import { formatLakShort, formatNumber } from "@/lib/format";
import { ChartFrame } from "./ChartFrame";

export type PipelineStage = { key: string; label: string; count: number; valueLak: number; href?: string };

// Ordered stages → one hue stepping up in strength (sequential), never a rainbow.
const RAMP = ["fill-yellow/20", "fill-yellow/35", "fill-yellow/50", "fill-yellow/65", "fill-yellow/80", "fill-yellow"];
const RAMP_BG = ["bg-yellow/20", "bg-yellow/35", "bg-yellow/50", "bg-yellow/65", "bg-yellow/80", "bg-yellow"];

/** Stacked pipeline bar + a directly-labelled stage strip underneath (numbered, so identity never rests on colour). */
export function PipelineBar({ title, desc, stages }: { title: string; desc?: string; stages: PipelineStage[] }) {
  const total = stages.reduce((s, x) => s + x.count, 0);
  const geo = stages.reduce<{ x: number; w: number }[]>((acc, s) => { const prev = acc[acc.length - 1]; const x = prev ? prev.x + prev.w : 0; return [...acc, { x, w: total ? (s.count / total) * 100 : 0 }]; }, []);
  return (
    <ChartFrame title={title} desc={desc} empty={total === 0} emptyText="No open leads in the pipeline yet. New enquiries land in NEW automatically." table={{ columns: ["Stage", "Leads", "Estimated value"], rows: stages.map((s) => [s.label, formatNumber(s.count), formatLakShort(s.valueLak)]) }}>
      <svg role="img" aria-label={`${title}: ${stages.map((s) => `${s.label} ${s.count}`).join(", ")}`} viewBox="0 0 100 6" preserveAspectRatio="none" className="h-3 w-full">
        {stages.map((s, i) => { const g = geo[i]!; return g.w > 0 ? <rect key={s.key} x={g.x + 0.15} y="0" width={Math.max(g.w - 0.3, 0.2)} height="6" className={RAMP[Math.min(i, RAMP.length - 1)]} /> : null; })}
      </svg>
      <ol className="mt-3 grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((s, i) => {
          const body = (
            <>
              <span className="t-label flex items-center gap-1.5 text-[0.625rem] text-fog-400"><span aria-hidden className={`h-2 w-2 flex-none ${RAMP_BG[Math.min(i, RAMP_BG.length - 1)]}`} />{String(i + 1).padStart(2, "0")} {s.label}</span>
              <span className="t-data mt-2 block text-2xl leading-none text-fog-50">{formatNumber(s.count)}</span>
              <span className="t-data mt-1.5 block text-xs text-fog-500">{s.valueLak > 0 ? formatLakShort(s.valueLak) : "no value set"}</span>
            </>
          );
          return <li key={s.key} className="bg-ink-900">{s.href ? <Link href={s.href} className="block p-3 transition-colors hover:bg-ink-850">{body}</Link> : <div className="p-3">{body}</div>}</li>;
        })}
      </ol>
    </ChartFrame>
  );
}

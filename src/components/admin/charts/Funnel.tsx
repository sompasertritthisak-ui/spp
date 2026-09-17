import { formatNumber } from "@/lib/format";
import { ChartFrame } from "./ChartFrame";

export type FunnelStep = { key: string; label: string; value: number };

/** Commercial funnel: bar width = share of the first step; the step-to-step conversion is written between rows. */
export function Funnel({ title, desc, steps }: { title: string; desc?: string; steps: FunnelStep[] }) {
  const top = Math.max(1, steps[0]?.value ?? 0, ...steps.map((s) => s.value));
  const rate = (a: number, b: number) => (a > 0 ? `${((b / a) * 100).toFixed(b / a < 0.1 ? 1 : 0)}%` : "—");
  let worst = -1, worstRate = Infinity;
  steps.forEach((s, i) => { const prev = steps[i - 1]; if (prev && prev.value > 0 && s.value / prev.value < worstRate) { worstRate = s.value / prev.value; worst = i; } });
  return (
    <ChartFrame
      title={title} desc={desc} empty={steps.every((s) => s.value === 0)} emptyText="No tracked sessions in this period yet. The funnel fills as visitors use the site."
      table={{ columns: ["Step", "Count", "From previous step", "From first step"], rows: steps.map((s, i) => [s.label, formatNumber(s.value), i ? rate(steps[i - 1]!.value, s.value) : "—", rate(steps[0]!.value, s.value)]) }}
    >
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.key}>
            {i > 0 && (
              <p className="t-data flex items-center gap-2 py-1 pl-7 text-[0.6875rem] text-fog-500">
                <span aria-hidden>↓</span>{rate(steps[i - 1]!.value, s.value)} continue
                {i === worst && <span className="t-label border border-warn/50 px-1.5 py-0.5 text-[0.5625rem] text-warn">Biggest drop-off</span>}
              </p>
            )}
            <div className="grid grid-cols-[1.25rem_1fr] items-center gap-2">
              <span className="t-data text-[0.625rem] text-fog-500">{String(i + 1).padStart(2, "0")}</span>
              <div className="relative flex min-h-9 items-center">
                <svg aria-hidden viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <rect width="100" height="10" className="fill-ink-850" />
                  <rect width={Math.max((s.value / top) * 100, s.value > 0 ? 0.8 : 0)} height="10" className={i === steps.length - 1 ? "fill-yellow/70" : "fill-fog-500/45"} />
                </svg>
                <span className="t-label relative flex w-full items-center justify-between gap-3 px-3 text-[0.6875rem] text-fog-50"><span className="truncate">{s.label}</span><span className="t-data text-sm">{formatNumber(s.value)}</span></span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </ChartFrame>
  );
}

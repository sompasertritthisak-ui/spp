/** Inline trend mark for stat tiles. Decorative alongside a number, so it carries a text alternative instead of axes. */
export function Sparkline({ values, label, className = "h-8 w-24" }: { values: number[]; label: string; className?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return <span className="t-label text-[0.625rem] text-fog-500">No trend yet</span>;
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 28 - ((v - min) / span) * 24 - 2] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 100 28" preserveAspectRatio="none" className={className}>
      <path d={`${line} L100 28 L0 28 Z`} className="fill-yellow/10" />
      <path d={line} fill="none" className="stroke-yellow" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="1.6" className="fill-yellow" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

import { formatNumber } from "@/lib/format";
import { ChartFrame } from "./ChartFrame";

export type BarDatum = { label: string; value: number; note?: string };

/** Ranked horizontal bars, one hue (magnitude, not identity). Every bar carries its label and value directly. */
export function BarList({ title, desc, data, unit = "", valueLabel = "Count", format = formatNumber, highlightFirst = false, emptyText }: { title: string; desc?: string; data: BarDatum[]; unit?: string; valueLabel?: string; format?: (n: number) => string; highlightFirst?: boolean; emptyText?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartFrame title={title} desc={desc} empty={data.length === 0 || total === 0} emptyText={emptyText} table={{ columns: ["Item", valueLabel, "Share"], rows: data.map((d) => [d.label, format(d.value), `${total ? Math.round((d.value / total) * 100) : 0}%`]) }}>
      <ul className="flex flex-col gap-2">
        {data.map((d, i) => (
          <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-fog-100" title={d.label}>{d.label}{d.note && <span className="ml-1.5 text-xs text-fog-500">{d.note}</span>}</span>
            <svg aria-hidden viewBox="0 0 100 8" preserveAspectRatio="none" className="h-2 w-full">
              <rect x="0" y="0" width="100" height="8" className="fill-ink-800" />
              <rect x="0" y="0" width={Math.max((d.value / max) * 100, d.value > 0 ? 1 : 0)} height="8" className={highlightFirst && i === 0 ? "fill-yellow" : "fill-fog-300"} />
            </svg>
            <span className="t-data min-w-10 text-right text-fog-50">{format(d.value)}{unit}</span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}

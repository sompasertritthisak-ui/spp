import { formatLakShort, formatNumber } from "@/lib/format";
import { Sparkline } from "../charts/Sparkline";
import type { FunnelSummary } from "./types";

/** Headline figures as an indexed ruled list — numbers first, not ten identical cards. */
export function Headline({ d, days }: { d: FunnelSummary; days: number }) {
  const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");
  const items: { k: string; v: string; hint: string; spark?: number[] }[] = [
    { k: "Visitors", v: formatNumber(d.visitors), hint: "unique cookieless sessions", spark: d.daily.map((x) => x.visitors) },
    { k: "Leads", v: formatNumber(d.leads), hint: `${formatNumber(d.qualifiedLeads)} qualified or beyond`, spark: d.daily.map((x) => x.leads) },
    { k: "Quotes", v: formatNumber(d.quotes), hint: "quote requests received" },
    { k: "Orders", v: formatNumber(d.orders), hint: `${pct(d.orders, d.quotes)} of quotes` },
    { k: "Conversion rate", v: pct(d.leads, d.visitors), hint: "visitor → lead" },
    { k: "Pipeline value", v: formatLakShort(Number(d.pipelineLak)), hint: "open leads, estimated — all time" },
    { k: "Order value", v: formatLakShort(Number(d.revenueLak)), hint: "orders placed, excl. cancelled" },
    { k: "Avg order value", v: d.orders ? formatLakShort(Math.round(Number(d.avgOrderLak))) : "—", hint: "priced orders only" },
    { k: "Repeat customers", v: formatNumber(d.repeatCustomers), hint: "accounts with 2+ orders — all time" },
    { k: "Reorders", v: formatNumber(d.reorders), hint: "orders cloned from a past order" },
  ];
  return (
    <dl aria-label={`Headline metrics, last ${days} days`} className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 md:grid-cols-3 xl:grid-cols-5">
      {items.map((m, i) => (
        <div key={m.k} className="bg-ink-900 p-4">
          <dt className="t-label flex items-center gap-2 text-[0.625rem] text-fog-500"><span className="t-data text-fog-500/70">{String(i + 1).padStart(2, "0")}</span>{m.k}</dt>
          <dd className="mt-3 flex items-end justify-between gap-2"><span className={`t-data text-3xl font-medium leading-none ${i === 0 ? "text-yellow" : "text-fog-50"}`}>{m.v}</span>{m.spark && <Sparkline values={m.spark} label={`${m.k} per day`} className="h-7 w-16" />}</dd>
          <dd className="mt-2 text-xs text-fog-500">{m.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

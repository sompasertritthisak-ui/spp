"use client";
import { Suspense } from "react";
import { clsx } from "clsx";
import { Headline } from "@/components/admin/analytics/Headline";
import type { FunnelSummary } from "@/components/admin/analytics/types";
import { BarList } from "@/components/admin/charts/BarList";
import { ChartFrame, LegendKey } from "@/components/admin/charts/ChartFrame";
import { Funnel } from "@/components/admin/charts/Funnel";
import { TrendChart } from "@/components/admin/charts/TrendChart";
import { db, useUrlState } from "@/components/admin/ops/data";
import { NoAccess } from "@/components/admin/ops/parts";
import { ErrorNote, PageHeader, Panel } from "@/components/admin/ui";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate, formatNumber, titleCase } from "@/lib/format";

const RANGES = [7, 30, 90] as const;

function Analytics() {
  const { profile } = useAuth();
  const url = useUrlState();
  const allowed = canDo(profile?.role, "analytics");
  const days = RANGES.find((r) => String(r) === url.get("range")) ?? 30;
  const q = useQuery<FunnelSummary>(() => db().rpc("funnel_summary", { since: new Date(Date.now() - days * 864e5).toISOString() }), [days], { enabled: allowed });
  if (!allowed) return <><PageHeader title="Analytics" /><NoAccess what="marketing analytics" /></>;
  const d = q.data;
  const ev = d?.sessionsByEvent ?? {};
  const daily = d?.daily.slice(-days) ?? [];
  const abandonment = (d?.abandonment ?? []).map((a) => ({ label: `${titleCase(a.flow)} → ${titleCase(a.stage)}`, value: a.count }));
  const worst = abandonment[0];

  return (
    <>
      <PageHeader title="Marketing intelligence" sub={d ? `First-party, cookieless measurement · since ${formatDate(d.since)}` : "First-party, cookieless measurement"} actions={
        <div role="group" aria-label="Date range" className="flex border border-ink-600">
          {RANGES.map((r) => <button key={r} type="button" aria-pressed={days === r} onClick={() => url.set({ range: r === 30 ? null : String(r) })} className={clsx("t-label min-h-10 px-4 text-[0.6875rem] transition-colors", days === r ? "bg-yellow text-ink-950" : "text-fog-400 hover:text-fog-50")}>{r} days</button>)}
        </div>} />
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !d && <div aria-busy="true" className="flex flex-col gap-6"><div className="skeleton h-40" /><div className="grid gap-6 lg:grid-cols-2"><div className="skeleton h-96" /><div className="skeleton h-96" /></div></div>}
      {d && (
        <div className={clsx("flex flex-col gap-6 transition-opacity", q.loading && "opacity-60")}>
          <Headline d={d} days={days} />
          <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
            <Panel>
              <Funnel title="Commercial funnel" desc="Steps 1–7 count unique sessions that reached the step; Qualified lead and Order count records created in the period. Percentages compare each step with the one before it." steps={[
                { key: "visitor", label: "Visitor", value: d.visitors }, { key: "product_view", label: "Product view", value: ev.product_view ?? 0 }, { key: "customizer_started", label: "Customizer started", value: ev.customizer_started ?? 0 },
                { key: "design_created", label: "Design created", value: ev.design_created ?? 0 }, { key: "design_saved", label: "Design saved", value: ev.design_saved ?? 0 }, { key: "mockup_downloaded", label: "Mockup downloaded", value: ev.mockup_downloaded ?? 0 },
                { key: "quote_requested", label: "Quote requested", value: ev.quote_requested ?? 0 }, { key: "qualified", label: "Qualified lead", value: d.qualifiedLeads }, { key: "order", label: "Order", value: d.orders },
              ]} />
            </Panel>
            <div className="flex flex-col gap-6">
              <Panel>
                <ChartFrame title="Daily visitors and leads" desc="Two scales, so two charts on a shared time axis — never a dual axis. Hover, or focus and use the arrow keys, to read a day." empty={daily.every((x) => x.visitors === 0 && x.leads === 0)} emptyText="No visits or leads recorded in this period yet."
                  legend={<><LegendKey swatch="bg-yellow">Visitors (sessions)</LegendKey><LegendKey swatch="bg-sky">Leads created</LegendKey></>} table={{ columns: ["Day", "Visitors", "Leads"], rows: daily.map((x) => [formatDate(x.day, { day: "numeric", month: "short" }), formatNumber(x.visitors), formatNumber(x.leads)]) }}>
                  <div className="flex flex-col gap-5"><TrendChart name="Visitors" tone="yellow" points={daily.map((x) => ({ day: x.day, value: x.visitors }))} /><TrendChart name="Leads" tone="sky" points={daily.map((x) => ({ day: x.day, value: x.leads }))} /></div>
                </ChartFrame>
              </Panel>
              <Panel><BarList title="Leads by source" desc="Where enquiries in this period came from." valueLabel="Leads" highlightFirst data={Object.entries(d.leadsBySource).map(([k, v]) => ({ label: titleCase(k), value: Number(v) })).sort((a, b) => b.value - a.value)} emptyText="No leads were created in this period." /></Panel>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Panel><BarList title="Product popularity" desc="Product page views, top 12." valueLabel="Views" highlightFirst data={d.productViews.map((p) => ({ label: titleCase(p.product), value: p.views }))} emptyText="No product views recorded in this period." /></Panel>
            <Panel><BarList title="QR scans by code" desc="Scans of printed QR codes, by code." valueLabel="Scans" highlightFirst data={d.qrByCode.map((c) => ({ label: c.label || c.code, note: c.label ? c.code : undefined, value: c.scans }))} emptyText={d.qrByCode.length ? "No QR codes were scanned in this period." : "No QR codes exist yet. Create them under Campaigns & QR."} /></Panel>
            <Panel className="lg:col-span-2 xl:col-span-1">
              <BarList title="Abandonment by flow and stage" desc="High-intent sessions that stopped and have not converted: where they stopped." valueLabel="Sessions" highlightFirst data={abandonment} emptyText="No abandoned high-intent sessions in this period." />
              {worst && worst.value > 0 && <p className="mt-4 border-l-2 border-warn pl-3 text-sm text-fog-100"><span className="t-label mr-2 text-[0.625rem] text-warn">Highest drop-off</span>{worst.label} — {formatNumber(worst.value)} session{worst.value === 1 ? "" : "s"}. Review that step of the flow, then follow up consenting visitors from Leads → Abandoned.</p>}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

export default function AnalyticsPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Analytics /></Suspense>;
}

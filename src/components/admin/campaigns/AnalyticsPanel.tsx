"use client";
import { useMemo } from "react";
import type { CampaignQrCodesRow } from "@/lib/backend/db-types";
import { formatNumber } from "@/lib/format";
import { Stat } from "../ui";
import { isoDay } from "../billboards/shared";
import type { ScanStats } from "./QrPanel";

export type Scan = { qr_id: string; at: string; session_id: string | null; ua_family: string | null };
const DAYS = 30;

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div>
      <h3 className="t-label mb-2 text-fog-300">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-fog-500">No scans yet.</p> : (
        <ul className="grid gap-1.5">{rows.map(([k, n]) => <li key={k} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm"><span className="truncate text-fog-200">{k}</span><span aria-hidden className="h-2 bg-ink-800"><span className="block h-2 bg-sky" style={{ width: `${(n / max) * 100}%` }} /></span><span className="t-data text-right text-fog-300">{formatNumber(n)}</span></li>)}</ul>
      )}
    </div>
  );
}

/** Scans over the last 30 days as inline SVG bars (with a text equivalent), plus simple breakdowns. */
export function AnalyticsPanel({ scans, codes, stats, today }: { scans: Scan[]; codes: Pick<CampaignQrCodesRow, "id" | "label" | "medium" | "code">[]; stats: ScanStats; today: Date }) {
  const days = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of scans) { const k = isoDay(new Date(s.at)); byDay.set(k, (byDay.get(k) ?? 0) + 1); }
    return Array.from({ length: DAYS }, (_, i) => { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1 - i)); return { d, n: byDay.get(isoDay(d)) ?? 0 }; });
  }, [scans, today]);
  const recent = days.reduce((n, d) => n + d.n, 0);
  const week = days.slice(-7).reduce((n, d) => n + d.n, 0);
  const total = [...stats.values()].reduce((n, s) => n + s.count, 0);
  const since = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1)).getTime();
  const sessions = new Set(scans.filter((s) => new Date(s.at).getTime() >= since && s.session_id).map((s) => s.session_id)).size;
  const max = Math.max(1, ...days.map((d) => d.n));
  const tally = (key: (s: Scan) => string) => { const m = new Map<string, number>(); for (const s of scans) { if (new Date(s.at).getTime() < since) continue; const k = key(s); m.set(k, (m.get(k) ?? 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6); };
  const codeById = new Map(codes.map((c) => [c.id, c]));
  const W = 600, H = 140, bw = W / DAYS;
  const peak = days.reduce((a, b) => (b.n > a.n ? b : a), days[0]!);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Scans · all time" value={formatNumber(total)} tone="yellow" />
        <Stat label="Last 30 days" value={formatNumber(recent)} />
        <Stat label="Last 7 days" value={formatNumber(week)} />
        <Stat label="Devices · 30 days" value={formatNumber(sessions)} hint="Distinct browser sessions" />
      </div>
      <figure>
        <figcaption className="t-label mb-2 text-fog-300">Scans per day · last {DAYS} days</figcaption>
        {recent === 0 ? <p className="border border-dashed border-ink-600 px-4 py-10 text-center text-sm text-fog-500">No scans in the last {DAYS} days.</p> : (
          <>
            <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${formatNumber(recent)} scans in the last ${DAYS} days; the busiest day was ${peak.d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} with ${peak.n}.`} className="w-full" preserveAspectRatio="none">
              <line x1="0" x2={W} y1={H} y2={H} className="stroke-ink-600" strokeWidth="1" />
              {days.map((d, i) => <rect key={i} x={i * bw + 2} width={bw - 4} y={H - (d.n / max) * (H - 8)} height={(d.n / max) * (H - 8)} className="fill-yellow"><title>{`${d.d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${d.n}`}</title></rect>)}
              {days.map((d, i) => (i % 7 === 0 || i === DAYS - 1) && <text key={`t${i}`} x={i * bw + bw / 2} y={H + 14} textAnchor="middle" className="fill-fog-500 font-mono text-[9px]">{d.d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</text>)}
            </svg>
            <table className="sr-only"><caption>Scans per day</caption><thead><tr><th scope="col">Day</th><th scope="col">Scans</th></tr></thead><tbody>{days.filter((d) => d.n > 0).map((d) => <tr key={d.d.toISOString()}><td>{d.d.toDateString()}</td><td>{d.n}</td></tr>)}</tbody></table>
          </>
        )}
      </figure>
      <div className="grid gap-6 md:grid-cols-3">
        <Breakdown title="By code · 30 days" rows={tally((s) => codeById.get(s.qr_id)?.label || codeById.get(s.qr_id)?.code || "Deleted code")} />
        <Breakdown title="By medium · 30 days" rows={tally((s) => codeById.get(s.qr_id)?.medium ?? "unknown")} />
        <Breakdown title="By device · 30 days" rows={tally((s) => s.ua_family || "Unknown")} />
      </div>
      <p className="text-xs leading-relaxed text-fog-500">A scan is counted when the QR landing page loads. Scanning twice from the same phone counts twice; “devices” groups scans by browser session instead. Paused codes and unknown codes are not counted. The chart uses the most recent 90 days of data.</p>
    </div>
  );
}

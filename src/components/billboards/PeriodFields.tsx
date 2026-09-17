"use client";
import { Input } from "@/components/ui/Field";
import { formatDate } from "@/lib/format";
import type { AvailabilityBlock } from "@/components/map/useLiveAvailability";
import { MAX_AHEAD_DAYS, addDays, type PeriodCheck } from "./period";

/** Campaign period inputs + what SPP's calendar already shows. Shared by the request flow and the enquiry fallback. */
export function PeriodFields({ start, end, today, minMonths, check, showErrors, blocks, onChange }: { start: string; end: string; today: string; minMonths: number; check: PeriodCheck; showErrors: boolean; blocks: AvailabilityBlock[]; onChange: (patch: { start?: string; end?: string }) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Campaign starts" type="date" required min={today} max={addDays(today, MAX_AHEAD_DAYS)} value={start} onChange={(e) => onChange({ start: e.target.value })} error={showErrors ? check.errors.start : undefined} />
        <Input label="Campaign ends" type="date" required min={start ? addDays(start, minMonths * 28) : today} max={addDays(today, MAX_AHEAD_DAYS)} value={end} onChange={(e) => onChange({ end: e.target.value })} error={showErrors ? check.errors.end : undefined} hint={`Minimum term ${minMonths} ${minMonths === 1 ? "month" : "months"} (${minMonths * 28} days).`} />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick campaign lengths">
        {[minMonths, 6, 12].filter((m, i, a) => m >= minMonths && a.indexOf(m) === i).map((m) => (
          <button key={m} type="button" disabled={!start} onClick={() => onChange({ end: addDays(start, m * 28) })} className="t-label min-h-11 border border-ink-600 px-3.5 text-[0.625rem] text-fog-300 transition-colors duration-150 hover:border-yellow hover:text-yellow disabled:opacity-40">{m} months</button>
        ))}
      </div>
      <div aria-live="polite" className="flex flex-col gap-3">
        {check.days > 0 && !check.errors.start && !check.errors.end && <p className="t-data text-sm text-fog-300">{check.days} days · about {Math.round(check.days / 28)} four-week periods</p>}
        {check.clashes.length > 0 && (
          <div className="border border-warn/50 bg-warn/10 p-4 text-sm text-fog-50">
            <p className="t-label mb-2 text-warn">These dates may clash — we will check</p>
            <ul className="flex flex-col gap-1 text-fog-300">{check.clashes.map((c) => <li key={c}>{c}</li>)}</ul>
            <p className="mt-2 text-fog-400">You can still send the request. SPP will confirm what is possible or suggest the nearest free dates.</p>
          </div>
        )}
      </div>
      {blocks.length > 0 && (
        <div>
          <p className="t-label mb-2 text-fog-400">Already on this site&rsquo;s calendar</p>
          <ul className="border-t border-ink-700">
            {blocks.map((b) => <li key={`${b.startsOn}${b.endsOn}${b.kind}`} className="flex justify-between gap-4 border-b border-ink-700 py-2.5 text-sm"><span className="t-data text-fog-100">{formatDate(b.startsOn)} – {formatDate(b.endsOn)}</span><span className="t-label text-[0.625rem] text-fog-400">{b.kind}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";
import { clsx } from "clsx";
import { Input } from "@/components/ui/Field";
import { formatDate } from "@/lib/format";
import type { AvailabilityBlock } from "@/components/map/useLiveAvailability";
import { MAX_AHEAD_DAYS, MAX_YEARS, addDays, type PeriodCheck } from "./period";
import { years as yearsLabel } from "./vocab";

type Props = { start: string; years: number; today: string; minYears: number; check: PeriodCheck; showErrors: boolean; blocks: AvailabilityBlock[]; onChange: (patch: { start?: string; years?: number }) => void };

/**
 * Campaign period = a start date and a term in whole years. The end date is
 * derived, never typed. Shared by the request flow and the enquiry fallback.
 */
export function PeriodFields({ start, years, today, minYears, check, showErrors, blocks, onChange }: Props) {
  const terms = Array.from({ length: Math.max(0, MAX_YEARS - minYears + 1) }, (_, i) => minYears + i);
  const yearsError = showErrors ? check.errors.years : undefined;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Campaign starts" type="date" required min={today} max={addDays(today, MAX_AHEAD_DAYS)} value={start} onChange={(e) => onChange({ start: e.target.value })} error={showErrors ? check.errors.start : undefined} />
        <fieldset aria-describedby="term-hint" className="min-w-0">
          <legend className="t-label mb-2 text-[0.625rem] text-fog-300">Term <span aria-hidden className="text-gold">*</span></legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Campaign term in years">
            {terms.map((n) => {
              const on = years === n;
              return (
                <label key={n} className={clsx("t-label flex min-h-11 cursor-pointer items-center border px-3.5 text-[0.625rem] transition-colors duration-150", on ? "border-gold bg-gold/10 text-gold" : "border-gold/40 text-fog-300 hover:border-gold hover:text-gold")}>
                  <input type="radio" name="term-years" value={n} checked={on} onChange={() => onChange({ years: n })} className="sr-only" />
                  {yearsLabel(n)}
                </label>
              );
            })}
          </div>
          <p id="term-hint" className={clsx("mt-2 text-sm", yearsError ? "text-danger" : "text-fog-400")}>{yearsError ?? `Minimum term ${yearsLabel(minYears)}. Longer terms are quoted together with the rental.`}</p>
        </fieldset>
      </div>
      <div aria-live="polite" className="flex flex-col gap-3">
        {check.end && !check.errors.start && !check.errors.years && (
          <p className="text-sm text-fog-300">Runs <span className="t-data text-gold">{formatDate(start)}</span> to <span className="t-data text-gold">{formatDate(check.end)}</span> · {yearsLabel(years)} · {check.days} days</p>
        )}
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
          <ul className="border-t border-gold/40">
            {blocks.map((b) => <li key={`${b.startsOn}${b.endsOn}${b.kind}`} className="flex justify-between gap-4 border-b border-gold/20 py-2.5 text-sm"><span className="t-data text-fog-100">{formatDate(b.startsOn)} – {formatDate(b.endsOn)}</span><span className="t-label text-[0.625rem] text-fog-400">{b.kind}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

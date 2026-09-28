import type { AvailabilityBlock } from "@/components/map/useLiveAvailability";
import { formatDate } from "@/lib/format";
import { years as yearsLabel } from "./vocab";

const DAY = 86400000;
/** Local calendar date as YYYY-MM-DD (toISOString would shift it across midnight in UTC+7). */
export const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return isoLocal(d); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY);
/** Last day of an n-year term that starts on `iso` (1 Feb 2027 + 1 year → 31 Jan 2028). */
export const termEnd = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setFullYear(d.getFullYear() + n); d.setDate(d.getDate() - 1); return isoLocal(d); };
export const MAX_YEARS = 5;
export const MAX_AHEAD_DAYS = 1826; // 5 years; the database allows a little more

export type PeriodCheck = { errors: { start?: string; years?: string }; end: string; days: number; clashes: string[] };

/** Mirrors the rules in submit_booking. Clashes never block — staff resolve them — but the customer is told. */
export function checkPeriod(start: string, years: number, today: string, minYears: number, site: { status: string; availableFrom: string | null }, blocks: AvailabilityBlock[]): PeriodCheck {
  const errors: PeriodCheck["errors"] = {};
  if (!start) errors.start = "Choose the day your campaign should start.";
  else if (start < today) errors.start = "The start date cannot be in the past.";
  if (!Number.isInteger(years) || years < 1) errors.years = "Choose how many years the campaign should run.";
  else if (years < minYears) errors.years = `The minimum term here is ${yearsLabel(minYears)}.`;
  else if (years > MAX_YEARS) errors.years = `Terms longer than ${yearsLabel(MAX_YEARS)} are agreed directly with SPP.`;
  const end = start && !errors.years ? termEnd(start, years) : "";
  if (end && !errors.start && end > addDays(today, MAX_AHEAD_DAYS)) errors.start = `Please keep the campaign within the next ${yearsLabel(MAX_YEARS)}.`;

  const clashes: string[] = [];
  if (start && end && !errors.start && !errors.years) {
    for (const b of blocks) if (b.startsOn <= end && b.endsOn >= start) clashes.push(`${b.kind === "maintenance" ? "Maintenance" : b.kind === "hold" ? "On hold" : "Booked"} ${formatDate(b.startsOn)} – ${formatDate(b.endsOn)}`);
    if (!clashes.length && site.status !== "available" && site.availableFrom && site.availableFrom > start) clashes.push(`Currently ${site.status} — expected free from ${formatDate(site.availableFrom)}`);
  }
  return { errors, end, days: start && end ? daysBetween(start, end) + 1 : 0, clashes };
}

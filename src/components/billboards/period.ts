import type { AvailabilityBlock } from "@/components/map/useLiveAvailability";
import { formatDate } from "@/lib/format";

const DAY = 86400000;
/** Local calendar date as YYYY-MM-DD (toISOString would shift it across midnight in UTC+7). */
export const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return isoLocal(d); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY);
export const MAX_AHEAD_DAYS = 1095; // ~3 years; the database allows a little more

export type PeriodCheck = { errors: { start?: string; end?: string }; days: number; clashes: string[] };

/** Mirrors the rules in submit_booking. Clashes never block — staff resolve them — but the customer is told. */
export function checkPeriod(start: string, end: string, today: string, minMonths: number, site: { status: string; availableFrom: string | null }, blocks: AvailabilityBlock[]): PeriodCheck {
  const errors: PeriodCheck["errors"] = {};
  const minDays = minMonths * 28;
  if (!start) errors.start = "Choose the day your campaign should start.";
  else if (start < today) errors.start = "The start date cannot be in the past.";
  if (!end) errors.end = "Choose the day your campaign should end.";
  else if (start && end <= start) errors.end = "The end date must be after the start date.";
  else if (start && daysBetween(start, end) < minDays) errors.end = `The minimum term here is ${minMonths} ${minMonths === 1 ? "month" : "months"} — end on or after ${formatDate(addDays(start, minDays))}.`;
  else if (end > addDays(today, MAX_AHEAD_DAYS)) errors.end = "Please keep the campaign within the next three years.";

  const clashes: string[] = [];
  if (start && end && !errors.start && !errors.end) {
    for (const b of blocks) if (b.startsOn <= end && b.endsOn >= start) clashes.push(`${b.kind === "maintenance" ? "Maintenance" : b.kind === "hold" ? "On hold" : "Booked"} ${formatDate(b.startsOn)} – ${formatDate(b.endsOn)}`);
    if (!clashes.length && site.status !== "available" && site.availableFrom && site.availableFrom > start) clashes.push(`Currently ${site.status} — expected free from ${formatDate(site.availableFrom)}`);
  }
  return { errors, days: start && end ? Math.max(0, daysBetween(start, end)) : 0, clashes };
}

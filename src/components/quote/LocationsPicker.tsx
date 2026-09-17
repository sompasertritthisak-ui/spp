"use client";
import { Chip, QtyStepper } from "@/components/forms/controls";
import type { ProductLite } from "@/components/catalogue/lite";

/** Print locations. Products with known print areas pick them by name; everything else picks a count. */
export function LocationsPicker({ areas, value, onChange }: { areas: ProductLite["areas"]; value: string[]; onChange: (v: string[]) => void }) {
  if (areas.length > 1) {
    return (
      <fieldset className="min-w-0">
        <legend className="t-label mb-2 text-fog-400">Where should we print?</legend>
        <div className="flex flex-wrap gap-2">
          {areas.map((a) => {
            const on = value.includes(a.key);
            return (
              <Chip key={a.key} checked={on} disabled={on && value.length === 1} onChange={(v) => onChange(v ? [...value, a.key] : value.filter((k) => k !== a.key))}>{a.label}</Chip>
            );
          })}
        </div>
      </fieldset>
    );
  }
  if (areas.length === 1) return null;
  return <QtyStepper label="Print locations" size="sm" min={1} max={6} value={Math.max(1, value.length)} onChange={(n) => onChange(Array.from({ length: n }, (_, i) => `location-${i + 1}`))} />;
}

export const defaultLocations = (areas: ProductLite["areas"]) => [areas[0]?.key ?? "location-1"];

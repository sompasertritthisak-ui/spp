import { DesignThumb } from "@/components/studio/DesignThumb";
import type { GarmentKey } from "@/content/types";

/** One restrained line glyph per category. No product photography exists, so
 *  the catalogue is drawn — in the same hand as the rest of the site. */
const GLYPHS: Record<string, string[]> = {
  apparel: ["M42 22c5 7 31 7 36 0l24 9 12 28-16 7-5-11v45H27V55l-5 11-16-7 12-28z", "M42 22c4 12 32 12 36 0"],
  accessories: ["M60 20c-27 0-46 18-48 42 6-6 12-6 16 0 4-6 12-6 16 0 4-6 12-6 16 0 4-6 12-6 16 0 4-6 12-6 16 0 4-6 10-6 16 0-2-24-21-42-48-42z", "M60 14v6M60 62v34c0 8-12 8-12 0"],
  promotional: ["M36 26h48l-6 72H42z", "M33 26h54M39 50h42M41 74h38", "M52 26l4-12h8"],
  print: ["M30 22h46l14 14v62H30z", "M76 22v14h14", "M40 52h40M40 64h40M40 76h26", "M22 30v76h56"],
  display: ["M34 104V16", "M34 18c34-6 52 10 50 40-1 22-20 34-50 34", "M22 104h24", "M46 40h22M46 54h26M46 68h18"],
  signage: ["M14 34h92v44H14z", "M26 66V46h10a6 6 0 010 12H26M48 66V46h10a6 6 0 010 12H48M70 66V46h10a6 6 0 010 12H70", "M30 34V22M90 34V22M8 22h104"],
  outdoor: ["M12 20h96v48H12z", "M22 30h76v28H22z", "M52 68v38M68 68v38M40 106h40", "M30 20v-6M60 20v-6M90 20v-6"],
  vehicle: ["M10 82V44h58v38", "M68 54h24l18 16v12H68z", "M10 82h100", "M76 60h13l9 8H76z", "M18 54h42v14H18z"],
};
const WHEELS: Record<string, [number, number][]> = { vehicle: [[32, 86], [90, 86]] };

export function CategoryGlyph({ category, className }: { category: string; className?: string }) {
  const paths = GLYPHS[category] ?? GLYPHS.print!;
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      {paths.map((d, i) => <path key={i} d={d} />)}
      {(WHEELS[category] ?? []).map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="8" fill="var(--color-ink-900)" />)}
    </svg>
  );
}

/** Studio-enabled products show their real garment geometry; everything else shows its category glyph. */
export function ProductVisual({ garment, colour, category, name, className, glyphClassName = "h-full w-full text-fog-400" }: {
  garment: GarmentKey | null; colour?: string; category: string; name: string; className?: string; glyphClassName?: string;
}) {
  if (garment) return <DesignThumb garment={garment} colour={colour ?? "#f5f5f2"} layers={[]} className={className} title={`${name} in the selected colour`} />;
  return <div className={className}><CategoryGlyph category={category} className={glyphClassName} /></div>;
}

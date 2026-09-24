"use client";
import { clsx } from "clsx";
import { useId, useState } from "react";
import { cmykToHex, hexToCmyk, hexToRgb, normaliseHex, rgbToHex, type Cmyk, type Rgb } from "@/lib/studio/colour";

/**
 * Exact colour entry: HEX, RGB or CMYK, plus the browser's own picker.
 * Every field round-trips through the hex value so the three notations never
 * disagree. CMYK is the plain conversion — SPP matches inks on press.
 */
export function ColourEntry({ value, onPick, label, className }: { value: string; onPick: (hex: string) => void; label: string; className?: string }) {
  const id = useId();
  const [hex, setHex] = useState(value);
  const [rgb, setRgb] = useState<Rgb>(() => hexToRgb(value));
  const [cmyk, setCmyk] = useState<Cmyk>(() => hexToCmyk(value));
  const [bad, setBad] = useState(false);

  // Follow the swatch selection / external changes (state adjusted during render, not in an effect).
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setHex(value); setRgb(hexToRgb(value)); setCmyk(hexToCmyk(value)); setBad(false); }

  const commit = (h: string) => { setHex(h); setRgb(hexToRgb(h)); setCmyk(hexToCmyk(h)); setBad(false); onPick(h); };
  const num = "min-h-9 w-full border border-ink-600 bg-ink-950 px-2 text-center text-sm tabular-nums text-fog-50 focus:border-gold focus:outline-none";
  const field = (k: string) => <span className="t-label block text-center text-[0.5625rem] text-fog-500">{k}</span>;

  return (
    <div className={clsx("border border-ink-600 bg-ink-900 p-3", className)} role="group" aria-label={`${label} — enter a colour code`}>
      <div className="flex items-center gap-2">
        <label className="relative h-9 w-9 flex-none cursor-pointer rounded-full border border-ink-500" style={{ background: hex }} title="Open the colour picker">
          <span className="sr-only">Pick {label.toLowerCase()} visually</span>
          <input type="color" value={normaliseHex(hex) ?? "#000000"} onChange={(e) => commit(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <div className="flex-1">
          <label htmlFor={`${id}-hex`} className="t-label block text-[0.5625rem] text-fog-500">HEX</label>
          <input id={`${id}-hex`} value={hex} inputMode="text" autoComplete="off" spellCheck={false} aria-invalid={bad || undefined}
            onChange={(e) => { setHex(e.target.value); const h = normaliseHex(e.target.value); if (h) { setBad(false); setRgb(hexToRgb(h)); setCmyk(hexToCmyk(h)); onPick(h); } else setBad(e.target.value.trim().length > 0); }}
            onBlur={() => { const h = normaliseHex(hex); if (h) commit(h); else { setHex(value); setBad(false); } }}
            className={clsx("min-h-9 w-full border bg-ink-950 px-2 font-mono text-sm uppercase text-fog-50 focus:outline-none", bad ? "border-danger" : "border-ink-600 focus:border-gold")} placeholder="#F5B81F" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(["r", "g", "b"] as const).map((k) => (
          <label key={k}>{field(k.toUpperCase())}
            <input type="number" min={0} max={255} value={rgb[k]} aria-label={`${label} ${k.toUpperCase()} 0–255`} className={num}
              onChange={(e) => { const next = { ...rgb, [k]: Math.min(255, Math.max(0, Math.round(+e.target.value || 0))) }; setRgb(next); const h = rgbToHex(next); setHex(h); setCmyk(hexToCmyk(h)); onPick(h); }} />
          </label>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {(["c", "m", "y", "k"] as const).map((k) => (
          <label key={k}>{field(`${k.toUpperCase()} %`)}
            <input type="number" min={0} max={100} value={cmyk[k]} aria-label={`${label} ${k.toUpperCase()} percent`} className={num}
              onChange={(e) => { const next = { ...cmyk, [k]: Math.min(100, Math.max(0, Math.round(+e.target.value || 0))) }; setCmyk(next); const h = cmykToHex(next); setHex(h); setRgb(hexToRgb(h)); onPick(h); }} />
          </label>
        ))}
      </div>
      <p className="mt-2 text-[0.6875rem] leading-snug text-fog-500">CMYK is an approximation on screen. Give SPP a Pantone or a printed sample for an exact match.</p>
    </div>
  );
}

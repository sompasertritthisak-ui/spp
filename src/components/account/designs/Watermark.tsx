"use client";
import { useId } from "react";
import { GARMENT_BOX } from "@/lib/garments";

/* One tile holds two staggered rows of the mark; the pattern repeats it across the whole preview. */
const FONT = 50;
const ROW = FONT * 3.3;
const CHAR = FONT * 0.62; // JetBrains Mono advance, near enough — textLength pins the exact width

/**
 * The SPP PREVIEW mark over every design shown in My SPP.
 *
 * Portal previews are drawn live as SVG from the design's layers (the stored
 * PNG is never shown), so the mark is a tiled, rotated SVG pattern laid on top
 * and carries the design reference. It is the on-screen twin of
 * stampWatermark() in lib/studio/export.ts, which stamps every exported file.
 * Two tones, so it reads on light and dark garments alike.
 */
export function PreviewWatermark({ designRef }: { designRef?: string | null }) {
  const id = `wm-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mark = `SPP PREVIEW  ·  ${designRef || "NOT SAVED"}  ·  `;
  const w = Math.round(mark.length * CHAR);
  const row = (x: number, y: number) => (
    <>
      <text x={x + 2} y={y + 2} textLength={w} lengthAdjust="spacingAndGlyphs" fill="#000" fillOpacity={0.15}>{mark}</text>
      <text x={x} y={y} textLength={w} lengthAdjust="spacingAndGlyphs" fill="#fff" fillOpacity={0.26}>{mark}</text>
    </>
  );
  return (
    <svg aria-hidden data-watermark="spp-preview" viewBox={`0 0 ${GARMENT_BOX.w} ${GARMENT_BOX.h}`} preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full select-none">
      <defs>
        <pattern id={id} width={w} height={ROW * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(-26)">
          <g fontFamily="var(--font-jetbrains), ui-monospace, Menlo, monospace" fontWeight={700} fontSize={FONT} style={{ whiteSpace: "pre" }}>
            {row(0, FONT)}
            {row(-w / 2, FONT + ROW)}
            {row(w / 2, FONT + ROW)}
          </g>
        </pattern>
      </defs>
      <rect width={GARMENT_BOX.w} height={GARMENT_BOX.h} fill={`url(#${id})`} />
    </svg>
  );
}

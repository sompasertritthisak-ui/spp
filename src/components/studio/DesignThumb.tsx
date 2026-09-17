import { useId } from "react";
import { getSide, isDark, shade, toSvgPath, GARMENT_BOX } from "@/lib/garments";
import type { GarmentKey } from "@/content/types";
import { AREA_W, FONT_VAR, type Layer } from "@/lib/studio/schema";
import { GRAPHICS, shapePath } from "@/lib/studio/shapes";

/**
 * Pure-SVG render of one side of a design on its garment. Used for template
 * galleries, My Designs, quote lines and the Command Center — anywhere a
 * design is shown but not edited. No canvas, no client JS required.
 *
 * Image layers are private storage objects; pass `imageUrl` to resolve a
 * layer to a (signed) URL. Unresolved images render as a labelled placeholder.
 */
export function DesignThumb({ garment, side = "front", colour, layers, imageUrl, className, showArea = false, title }: {
  garment: GarmentKey; side?: string; colour: string; layers: Layer[]; imageUrl?: (l: Extract<Layer, { type: "image" }>) => string | undefined; className?: string; showArea?: boolean; title?: string;
}) {
  const g = getSide(garment, side);
  const dark = isDark(colour);
  const seam = dark ? shade(colour, 0.22) : shade(colour, -0.2);
  const trim = dark ? shade(colour, 0.08) : shade(colour, -0.09);
  const k = g.area.w / AREA_W;
  // unique per instance: several thumbnails of the same garment often share a page
  const clip = `clip-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox={`0 0 ${GARMENT_BOX.w} ${GARMENT_BOX.h}`} className={className} role="img" aria-label={title ?? `${g.label} of design`} preserveAspectRatio="xMidYMid meet">
      <defs><clipPath id={clip}><rect x={g.area.x} y={g.area.y} width={g.area.w} height={g.area.h} /></clipPath></defs>
      <path d={toSvgPath(g.body)} fill={colour} stroke={seam} strokeWidth={3} strokeLinejoin="round" />
      {g.trims.map((d, i) => <path key={i} d={d} fill={trim} stroke={seam} strokeWidth={2.5} strokeLinejoin="round" />)}
      {g.seams.map((d, i) => <path key={i} d={d} fill="none" stroke={seam} strokeWidth={2.5} strokeLinecap="round" />)}
      {showArea && <rect x={g.area.x} y={g.area.y} width={g.area.w} height={g.area.h} fill="none" stroke={dark ? "#ffffff55" : "#00000040"} strokeWidth={2} strokeDasharray="10 8" />}
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(${g.area.x} ${g.area.y}) scale(${k})`}>
          {layers.filter((l) => !l.hidden).map((l) => <LayerSvg key={l.id} layer={l} imageUrl={imageUrl} />)}
        </g>
      </g>
    </svg>
  );
}

export function LayerSvg({ layer: l, imageUrl }: { layer: Layer; imageUrl?: (l: Extract<Layer, { type: "image" }>) => string | undefined }) {
  const t = `translate(${l.x} ${l.y}) rotate(${l.angle ?? 0})`;
  const o = l.opacity ?? 1;
  if (l.type === "text") {
    const lines = l.text.split("\n");
    const lh = l.size * 1.08;
    const anchor = l.align === "left" ? "start" : l.align === "right" ? "end" : "middle";
    return (
      <text transform={t} opacity={o} fill={l.fill} fontFamily={`var(${FONT_VAR[l.font]}), sans-serif`} fontWeight={l.weight} fontStyle={l.italic ? "italic" : "normal"} fontSize={l.size} letterSpacing={`${(l.tracking ?? 0) / 1000}em`} textAnchor={anchor} dominantBaseline="central">
        {lines.map((line, i) => <tspan key={i} x={0} y={(i - (lines.length - 1) / 2) * lh}>{line}</tspan>)}
      </text>
    );
  }
  if (l.type === "shape") return <path transform={t} opacity={o} d={shapePath(l.shape, l.w, l.h)} fill={l.fill} fillRule="evenodd" />;
  if (l.type === "graphic") {
    const g = GRAPHICS[l.graphic];
    if (!g) return null;
    return <path transform={`${t} scale(${l.w / 100} ${l.h / 100})`} opacity={o} d={g.d} fill={l.fill} fillRule="evenodd" />;
  }
  const href = imageUrl?.(l);
  if (href) return <image transform={t} opacity={o} href={href} x={-l.w / 2} y={-l.h / 2} width={l.w} height={l.h} preserveAspectRatio="none" />;
  return (
    <g transform={t} opacity={o}>
      <rect x={-l.w / 2} y={-l.h / 2} width={l.w} height={l.h} fill="#8884" stroke="#888" strokeWidth={3} strokeDasharray="12 8" />
      <text textAnchor="middle" dominantBaseline="central" fontSize={Math.min(34, l.w / 8)} fill="#888" fontFamily="var(--font-jetbrains), monospace">{l.name.slice(0, 18)}</text>
    </g>
  );
}

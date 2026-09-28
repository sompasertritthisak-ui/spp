import { useId } from "react";
import { getSide, handleColour, isDark, regionsOf, shade, toSvgPath, GARMENT_BOX } from "@/lib/garments";
import type { GarmentKey } from "@/content/types";
import { AREA_W, FONT_VAR, type Layer, type Sides } from "@/lib/studio/schema";
import { GRAPHICS, shapePath } from "@/lib/studio/shapes";

/**
 * Pure-SVG render of one side of a design on its garment. Used for template
 * galleries, My Designs, quote lines and the Command Center — anywhere a
 * design is shown but not edited. No canvas, no client JS required.
 *
 * Pass `layers` to draw one print region, or `sides` (the whole design) to draw
 * every region on that face — a front view then shows both chest logos.
 * Image layers are private storage objects; pass `imageUrl` to resolve a
 * layer to a (signed) URL. Unresolved images render as a labelled placeholder.
 */
export function DesignThumb({ garment, side = "front", colour, trimColour, layers, sides, imageUrl, className, showArea = false, title }: {
  garment: GarmentKey; side?: string; colour: string; trimColour?: string; layers?: Layer[]; sides?: Sides;
  imageUrl?: (l: Extract<Layer, { type: "image" }>) => string | undefined; className?: string; showArea?: boolean; title?: string;
}) {
  const g = getSide(garment, side);
  const dark = isDark(colour);
  const seam = dark ? shade(colour, 0.22) : shade(colour, -0.2);
  const trim = dark ? shade(colour, 0.08) : shade(colour, -0.09);
  const behind = dark ? shade(colour, 0.05) : shade(colour, -0.07);
  const regions = sides ? regionsOf(garment, g.view ?? g.key).map((r) => ({ r, layers: sides[r.key] ?? [] })) : [{ r: g, layers: layers ?? [] }];
  // unique per instance: several thumbnails of the same garment often share a page
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const body = toSvgPath(g.body);
  return (
    <svg viewBox={`0 0 ${GARMENT_BOX.w} ${GARMENT_BOX.h}`} className={className} role="img" aria-label={title ?? `${g.label} of design`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={`body-${uid}`}><path d={body} /></clipPath>
        {regions.map(({ r }) => <clipPath key={r.key} id={`clip-${uid}-${r.key}`}><rect x={r.area.x} y={r.area.y} width={r.area.w} height={r.area.h} /></clipPath>)}
      </defs>
      {(g.handles ?? []).map((d, i) => <path key={`h${i}`} d={d} fill={handleColour(colour, trimColour)} stroke={seam} strokeWidth={2.5} strokeLinejoin="round" />)}
      {(g.backdrop ?? []).map((d, i) => <path key={`b${i}`} d={d} fill={behind} stroke={seam} strokeWidth={3} strokeLinejoin="round" />)}
      {g.backdrop && <path d={body} transform="translate(0 10)" fill="#000" opacity={dark ? 0.35 : 0.16} />}
      <path d={body} fill={colour} stroke={seam} strokeWidth={3} strokeLinejoin="round" />
      {g.trims.map((d, i) => <path key={i} d={d} fill={trim} stroke={seam} strokeWidth={2.5} strokeLinejoin="round" />)}
      {g.seams.map((d, i) => <path key={i} d={d} fill="none" stroke={seam} strokeWidth={2.5} strokeLinecap="round" />)}
      {showArea && regions.map(({ r }) => (r.freeFlow
        ? <path key={r.key} d={body} fill="none" stroke={dark ? "#ffffff55" : "#00000040"} strokeWidth={2} strokeDasharray="10 8" />
        : <rect key={r.key} x={r.area.x} y={r.area.y} width={r.area.w} height={r.area.h} fill="none" stroke={dark ? "#ffffff55" : "#00000040"} strokeWidth={2} strokeDasharray="10 8" />))}
      {regions.map(({ r, layers: ls }) => (
        <g key={r.key} clipPath={`url(#${r.freeFlow ? `body-${uid}` : `clip-${uid}-${r.key}`})`}>
          <g transform={`translate(${r.area.x} ${r.area.y}) scale(${r.area.w / AREA_W})`}>
            {ls.filter((l) => !l.hidden).map((l) => <LayerSvg key={l.id} layer={l} imageUrl={imageUrl} />)}
          </g>
        </g>
      ))}
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

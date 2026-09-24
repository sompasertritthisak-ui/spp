import { OUTLINE, PROVINCES, VIEWBOX } from "@/lib/geo/laos.generated";
import { dms, type Site } from "@/lib/geo/sites";

/** Static "you are here" inset for a location page: the country, the site's province, a crosshair. No JS. */
export function LocatorMap({ site, others }: { site: Site; others: Site[] }) {
  const r = 9;
  return (
    <figure className="relative border border-gold/40 bg-ink-950">
      <svg viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} role="img" aria-label={`Locator map: ${site.name} in ${site.province}, Laos`} className="block h-auto w-full">
        {PROVINCES.map((p) => <path key={p.id} d={p.d} strokeWidth={1} vectorEffect="non-scaling-stroke" className={p.id === site.provinceId ? "fill-ink-700 stroke-gold/60" : "fill-ink-850 stroke-gold/15"} />)}
        <path d={OUTLINE} fill="none" strokeWidth={1.25} vectorEffect="non-scaling-stroke" className="stroke-gold/60" />
        {others.map((o) => <rect key={o.code} x={o.x - 4} y={o.y - 4} width={8} height={8} transform={`rotate(45 ${o.x} ${o.y})`} className="fill-ink-500" />)}
        <g className="stroke-gold" strokeWidth={1.25} fill="none" vectorEffect="non-scaling-stroke">
          <path d={`M${site.x} 0V${site.y - r * 2.2}M${site.x} ${site.y + r * 2.2}V${VIEWBOX.h}M0 ${site.y}H${site.x - r * 2.2}M${site.x + r * 2.2} ${site.y}H${VIEWBOX.w}`} className="opacity-35" vectorEffect="non-scaling-stroke" />
          <circle cx={site.x} cy={site.y} r={r * 2.2} vectorEffect="non-scaling-stroke" />
        </g>
        <circle cx={site.x} cy={site.y} r={r} className="fill-gold" />
      </svg>
      <figcaption className="t-label flex flex-wrap justify-between gap-2 border-t border-gold/25 px-4 py-3 text-[0.625rem] text-fog-400"><span>{site.province}</span><span className="t-data normal-case tracking-normal">{dms(site.lat, site.lng)}</span></figcaption>
    </figure>
  );
}

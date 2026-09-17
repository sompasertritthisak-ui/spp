/** A stylised locator, not a map: no tiles, no third parties. The coordinates are the content. */
export const formatCoords = (lat: number, lng: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;

export function Locator({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const coords = formatCoords(lat, lng);
  return (
    <figure className="crop relative border border-ink-700 bg-ink-900">
      <svg viewBox="0 0 400 260" role="img" aria-label={`Location marker for ${label} at ${coords}`} className="block h-auto w-full">
        <g stroke="var(--color-ink-700)" strokeWidth="1">
          {Array.from({ length: 9 }, (_, i) => <path key={`v${i}`} d={`M${40 * (i + 1)} 0V260`} />)}
          {Array.from({ length: 6 }, (_, i) => <path key={`h${i}`} d={`M0 ${40 * (i + 1) - 10}H400`} />)}
        </g>
        {/* the Mekong, as a gesture */}
        <path d="M-10 214C60 196 96 236 170 214S290 150 410 176" fill="none" stroke="var(--color-ink-600)" strokeWidth="14" strokeLinecap="round" />
        <path d="M-10 214C60 196 96 236 170 214S290 150 410 176" fill="none" stroke="var(--color-ink-500)" strokeWidth="1" strokeDasharray="2 6" />
        <g fill="none" stroke="var(--color-fog-500)" strokeWidth="1">
          <circle cx="200" cy="118" r="78" strokeDasharray="2 5" />
          <circle cx="200" cy="118" r="46" />
          <path d="M200 20v60M200 156v60M102 118h60M238 118h60" />
        </g>
        <circle cx="200" cy="118" r="7" fill="var(--color-yellow)" />
        <circle cx="200" cy="118" r="16" fill="none" stroke="var(--color-yellow)" strokeWidth="1.5" />
        <g fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.2" fill="var(--color-fog-500)">
          <text x="12" y="18">LAT {lat.toFixed(4)}</text>
          <text x="388" y="18" textAnchor="end">LNG {lng.toFixed(4)}</text>
          <text x="12" y="250">N ↑</text>
          <text x="388" y="250" textAnchor="end">NOT TO SCALE</text>
        </g>
      </svg>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-ink-700 px-5 py-4">
        <span className="t-label text-fog-400">{label}</span>
        <span className="t-data text-fog-50">{coords}</span>
      </figcaption>
    </figure>
  );
}

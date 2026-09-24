import { clsx } from "clsx";
import type { PortfolioProject } from "@/content/types";
import { BRAND } from "@/lib/brand";
import { isDark } from "@/lib/garments";

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * No project photography exists yet, so covers are composed from each
 * project's three-colour palette. The composition is picked from the slug, so
 * a project always gets the same cover — a printed swatch card, not a stock photo.
 */
export function CoverArt({ project, className }: { project: Pick<PortfolioProject, "slug" | "palette" | "sector" | "year"> & { cover?: PortfolioProject["cover"] }; className?: string }) {
  if (project.cover) {
    // eslint-disable-next-line @next/next/no-img-element -- CMS cover photo; static export has no image optimiser
    return <img src={project.cover.url} alt={project.cover.alt} width={project.cover.width ?? undefined} height={project.cover.height ?? undefined} loading="lazy" decoding="async" className={clsx("block h-full w-full object-cover", className)} />;
  }
  const [ground, form, accent] = project.palette;
  const h = hash(project.slug);
  const variant = h % 3;
  const ink = isDark(ground) ? BRAND.white : BRAND.inkRaised;
  const dots = `dots-${project.slug}`;
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden className={clsx("block h-full w-full", className)}>
      <defs>
        <pattern id={dots} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="2.6" fill={accent} />
        </pattern>
      </defs>
      <rect width="800" height="600" fill={ground} />
      {variant === 0 && (
        <>
          <circle cx="560" cy="330" r="250" fill={form} />
          <rect x="0" y="392" width="800" height="46" fill={accent} />
          <rect x="60" y="70" width="210" height="210" fill={`url(#${dots})`} />
          <circle cx="560" cy="330" r="250" fill="none" stroke={ink} strokeOpacity=".25" strokeDasharray="3 7" transform="translate(-26 -26)" />
        </>
      )}
      {variant === 1 && (
        <>
          <path d="M-40 600 L360 -20 L560 -20 L160 600 Z" fill={form} />
          <path d="M240 600 L640 -20 L700 -20 L300 600 Z" fill={accent} />
          <rect x="540" y="330" width="200" height="200" fill={`url(#${dots})`} />
          <circle cx="640" cy="150" r="64" fill={form} />
        </>
      )}
      {variant === 2 && (
        <>
          <path d="M120 600 V300 A220 220 0 0 1 560 300 V600 Z" fill={form} />
          <path d="M230 600 V310 A110 110 0 0 1 450 310 V600 Z" fill={ground} />
          <circle cx="340" cy="310" r="38" fill={accent} />
          <rect x="590" y="60" width="150" height="330" fill={`url(#${dots})`} />
          <rect x="590" y="430" width="150" height="40" fill={accent} />
        </>
      )}
      {/* press furniture: crop ticks, a colour strip cut from the project's own palette plus the house gold */}
      <g stroke={ink} strokeOpacity=".55" strokeWidth="1.5">
        <path d="M24 40H44M40 24V44M776 40H756M760 24V44M24 560H44M40 576V556M776 560H756M760 576V556" />
      </g>
      <g transform="translate(60 548)">
        {[ground, form, accent, BRAND.gold].map((c, i) => <rect key={i} x={i * 34} width="34" height="12" fill={c} stroke={ink} strokeOpacity=".4" />)}
      </g>
      <text x="740" y="558" textAnchor="end" fill={ink} fillOpacity=".8" fontFamily="var(--font-jetbrains), monospace" fontSize="15" letterSpacing="2.4">
        {project.sector.toUpperCase()} · {project.year}
      </text>
    </svg>
  );
}

/** CONVENTIONS §4: illustrative projects are always labelled where they appear. */
export function SampleBadge({ className }: { className?: string }) {
  return (
    <span className={clsx("t-label inline-flex items-center gap-2 bg-ink-950 px-2.5 py-1.5 text-[0.625rem] text-yellow", className)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-yellow" />
      Sample project
    </span>
  );
}

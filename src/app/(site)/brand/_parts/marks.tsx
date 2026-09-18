import type { ReactNode } from "react";
import { Logo, Roundel, RoundelG } from "@/components/brand/Logo";
import { ROUNDEL, ROUNDEL_ARC_TEXT, ROUNDEL_COLOURS as C, ROUNDEL_LETTERS, ROUNDEL_RIGHT, ROUNDEL_SPLIT } from "@/components/brand/logo-paths";
import { asset } from "@/lib/env";

const MONO = "var(--font-jetbrains), monospace";
const R = ROUNDEL.r;
const ARC_R = 41.8; // radius the base text sits on
const S_HEIGHT = 23.5; // cap height of the "S" — the clear-space unit

/** The roundel as a bare <g> (100 × 100 units) for placing inside other drawings. */
export function MarkG({ mono, transform, opacity }: { mono?: boolean; transform?: string; opacity?: number }) {
  return <RoundelG mono={mono} transform={transform} opacity={opacity} />;
}

/**
 * One-colour roundel where the knock-outs take the ground colour — the way a
 * single thread or a single screen actually reproduces it. (`RoundelG mono`
 * always knocks out in midnight indigo, so it only suits a light ink.)
 */
export function MonoMark({ ink, knock, transform, opacity }: { ink: string; knock: string; transform?: string; opacity?: number }) {
  return (
    <g transform={transform} opacity={opacity}>
      <circle cx={ROUNDEL.cx} cy={ROUNDEL.cy} r={R} fill={ink} />
      <path d={ROUNDEL_SPLIT} fill="none" stroke={knock} strokeWidth="1.8" strokeLinecap="round" />
      <g fill={knock}><path d={ROUNDEL_LETTERS.s} /><path d={ROUNDEL_LETTERS.p1} /><path d={ROUNDEL_LETTERS.p2} /></g>
      <path d={ROUNDEL_ARC_TEXT} fill={knock} />
    </g>
  );
}

/** Anatomy drawing: the circle, the wave seam, the stacked letters and the base text, called out. */
export function Anatomy() {
  const r45 = R * Math.SQRT1_2;
  return (
    <svg viewBox="-96 -14 336 128" role="img" aria-label="Anatomy of the SPP roundel: a circle of radius 48, a wave seam entering at the top and leaving at the base, the letters S, P, P stacked on the seam and the base text on a smaller arc" className="block h-auto w-full">
      <g stroke="var(--color-ink-600)" strokeWidth=".4">
        {Array.from({ length: 13 }, (_, i) => <path key={`v${i}`} d={`M${-10 + i * 10} -10V110`} />)}
        {Array.from({ length: 13 }, (_, i) => <path key={`h${i}`} d={`M-10 ${-10 + i * 10}H110`} />)}
      </g>
      <MarkG opacity={0.92} />
      {/* guides */}
      <g fill="none" stroke="var(--color-sky)" strokeWidth=".6">
        <circle cx="50" cy="50" r={R} strokeDasharray="1.5 2" opacity=".7" />
        <circle cx="50" cy="50" r={ARC_R} strokeDasharray="1 1.5" opacity=".6" />
        <path d="M47 50H53M50 47V53" />
        <path d={`M60 3.05V-8M42 97.33V108`} strokeDasharray="1.5 1.5" />
        <path d="M21.5 13.97H-6M21.5 81.5H-6" strokeDasharray="1.5 1.5" opacity=".7" />
      </g>
      <g fill="none" stroke="var(--color-gold)" strokeWidth=".6">
        <path d={`M50 50L${50 + r45} ${50 - r45}`} />
        <path d="M-2 13.97V81.5M-5 13.97H1M-5 81.5H1" />
        <path d={`M50 ${50 + ARC_R}H118`} strokeDasharray="1.5 1.5" opacity=".7" />
      </g>
      <g fontFamily={MONO} fontSize="5.2" letterSpacing=".5" fill="var(--color-fog-300)">
        <text x="-92" y="-6" fill="var(--color-fog-500)">grid: 10 units · box 100 × 100</text>
        <text x="86" y="16" fill="var(--color-gold)">r 48</text>
        <text x="63" y="-9">seam in · x 60</text>
        <text x="45" y="112" textAnchor="end">seam out · x 42</text>
        <text x="-92" y="12">indigo · left of the seam</text>
        <text x="-92" y="49" fill="var(--color-gold)">S · P · P</text>
        <text x="-92" y="56">gold italic serif,</text>
        <text x="-92" y="62">stacked down the seam</text>
        <text x="120" y="50">sky · right of the seam</text>
        <text x="120" y="93.5">base text · r 41.8</text>
        <text x="120" y="99.5">SOLE CO., LTD</text>
        <text x="120" y="62">seam · white, 1.8 wide</text>
      </g>
    </svg>
  );
}

type Version = { file: string; name: string; use: string; preview: ReactNode };
const SIZE = "h-28 w-28 sm:h-36 sm:w-36";

export function LogoVersions() {
  const versions: Version[] = [
    {
      file: "spp-logo.svg",
      name: "Full colour",
      use: "The primary version: indigo, sky and gold with white knock-outs. Because the colour lives inside the circle, the same file works on midnight indigo and on white — no outline, no plate behind it.",
      preview: (
        <div className="grid aspect-[16/9] grid-cols-2">
          <div className="flex items-center justify-center bg-ink-950"><Roundel className={SIZE} /></div>
          <div className="flex items-center justify-center bg-paper"><Roundel className={SIZE} /></div>
        </div>
      ),
    },
    {
      file: "spp-logo-mono-ink.svg",
      name: "One colour — indigo",
      use: "Indigo disc, the seam and letters knocked out to the ground. Embroidery, engraving, vinyl cut and single-colour screen print on light grounds.",
      preview: <div className="flex aspect-[16/9] items-center justify-center bg-paper"><svg viewBox="0 0 100 100" role="img" aria-label="SPP logo, one colour indigo" className={SIZE}><MonoMark ink="var(--color-ink-950)" knock="var(--color-paper)" /></svg></div>,
    },
    {
      file: "spp-logo-mono-white.svg",
      name: "One colour — white",
      use: "White disc, the seam and letters knocked out in indigo. For dark grounds in one-colour processes, watermarks and reverse printing.",
      preview: <div className="flex aspect-[16/9] items-center justify-center bg-ink-800"><Roundel mono className={`${SIZE} text-fog-50`} /></div>,
    },
  ];
  return (
    <ul className="grid gap-px border border-ink-700 bg-ink-700 md:grid-cols-3">
      {versions.map((v, i) => (
        <li key={v.file} className="flex flex-col bg-ink-950">
          {v.preview}
          <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
            <p className="t-label text-fog-500">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="t-heading text-fog-50">{v.name}</h3>
            <p className="flex-1 text-base text-fog-400">{v.use}</p>
            <a href={asset(`/brand/${v.file}`)} download={v.file} className="group/btn t-label mt-2 inline-flex min-h-11 items-center justify-between gap-4 border border-ink-500 px-4 text-fog-50 transition-colors duration-200 hover:border-yellow hover:text-yellow">
              <span>Download SVG · {v.file}</span>
              <svg aria-hidden viewBox="0 0 12 14" className="h-3.5 w-3 transition-transform duration-300 ease-[var(--ease-press)] group-hover/btn:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 0v10M2 6l4 4 4-4M0 13h12" /></svg>
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Clear space = the height of the "S" (about a quarter of the diameter) on every side. */
export function ClearSpace() {
  const x = S_HEIGHT;
  const o = 50 - R - x; // outer edge of the clear space
  const e = 50 + R + x;
  return (
    <svg viewBox="-70 -40 280 180" role="img" aria-label="Clear space diagram: keep a margin equal to the height of the S on every side of the roundel" className="block h-auto w-full">
      <rect x={o} y={o} width={e - o} height={e - o} fill="var(--color-gold)" fillOpacity=".07" stroke="var(--color-gold)" strokeWidth=".8" strokeDasharray="4 3" />
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-ink-500)" strokeWidth=".6" strokeDasharray="2 2" />
      <MarkG />
      <g stroke="var(--color-gold)" strokeWidth=".8">
        <path d={`M${o} 50H2M${o} 46V54M2 46V54`} /><path d={`M98 50H${e}M98 46V54M${e} 46V54`} />
        <path d={`M50 ${o}V2M46 ${o}H54M46 2H54`} /><path d={`M50 98V${e}M46 98H54M46 ${e}H54`} />
      </g>
      <g fontFamily={MONO} fontSize="8" fill="var(--color-gold)" textAnchor="middle">
        <text x={(o + 2) / 2} y="44">x</text><text x={(98 + e) / 2} y="44">x</text><text x="58" y={(o + 2) / 2 + 3}>x</text><text x="58" y={(98 + e) / 2 + 3}>x</text>
      </g>
      <g stroke="var(--color-sky)" strokeWidth=".6" strokeDasharray="1.5 1.5"><path d="M42 13.97H160M42 37.51H160" /></g>
      <g stroke="var(--color-fog-300)" strokeWidth=".8"><path d="M150 13.97V37.51M146 13.97H154M146 37.51H154" /></g>
      <g fontFamily={MONO} fontSize="7" fill="var(--color-fog-300)">
        <text x="158" y="23">x = height of the S</text>
        <text x="158" y="32">≈ ¼ of the diameter</text>
      </g>
    </svg>
  );
}

export function MinimumSize() {
  return (
    <div className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700">
      {[
        { label: "Roundel", render: <Roundel className="h-6 w-6" />, screen: "24 px", print: "10 mm" },
        { label: "Lockup", render: <Logo className="h-5 w-auto" />, screen: "20 px high", print: "8 mm high" },
      ].map((m) => (
        <div key={m.label} className="bg-ink-950 p-5">
          <div className="flex h-16 items-center">{m.render}</div>
          <p className="t-label mt-3 text-fog-50">{m.label}</p>
          <p className="t-label mt-2 leading-relaxed text-fog-400">Screen {m.screen}<br />Print {m.print}</p>
        </div>
      ))}
    </div>
  );
}

/** The roundel re-drawn part by part so a misuse tile can get one part wrong. */
function Parts({ disc = C.indigo, right = C.sky, seam = C.white, letters = C.gold, text = C.white, lettersTransform, transform }: { disc?: string; right?: string; seam?: string; letters?: string; text?: string; lettersTransform?: string; transform?: string }) {
  return (
    <g transform={transform}>
      <circle cx={ROUNDEL.cx} cy={ROUNDEL.cy} r={R} fill={disc} />
      <path d={ROUNDEL_RIGHT} fill={right} />
      <path d={ROUNDEL_SPLIT} fill="none" stroke={seam} strokeWidth="1.8" strokeLinecap="round" />
      <g fill={letters} transform={lettersTransform}><path d={ROUNDEL_LETTERS.s} /><path d={ROUNDEL_LETTERS.p1} /><path d={ROUNDEL_LETTERS.p2} /></g>
      <path d={ROUNDEL_ARC_TEXT} fill={text} />
    </g>
  );
}

const CENTRED = "translate(78 28)";

const MISUSE: { label: string; art: ReactNode; ground?: string }[] = [
  { label: "Don’t stretch or condense it.", art: <MarkG transform="translate(46 38) scale(1.64 .8)" /> },
  { label: "Don’t rotate it — the seam runs top to bottom.", art: <MarkG transform={`${CENTRED} rotate(-24 50 50)`} /> },
  { label: "Don’t recolour it — indigo, sky, gold and white only.", art: <Parts transform={CENTRED} disc="var(--color-magenta)" right="var(--color-ok)" letters="var(--color-fog-50)" /> },
  { label: "Don’t move the letters off the seam.", art: <Parts transform={CENTRED} lettersTransform="translate(30 0)" /> },
  { label: "Don’t outline it or invert the seam.", art: <g transform={CENTRED}><circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-fog-50)" strokeWidth="1.5" /><path d={ROUNDEL_SPLIT} fill="none" stroke="var(--color-fog-50)" strokeWidth="1.5" /><g fill="none" stroke="var(--color-gold)" strokeWidth=".8"><path d={ROUNDEL_LETTERS.s} /><path d={ROUNDEL_LETTERS.p1} /><path d={ROUNDEL_LETTERS.p2} /></g><path d={ROUNDEL_ARC_TEXT} fill="var(--color-fog-50)" /></g> },
  { label: "Don’t place it on a ground without contrast.", ground: "var(--color-sky)", art: <MarkG transform={CENTRED} /> },
  { label: "Don’t add shadows, glows or effects.", art: <g transform={CENTRED}><circle cx="50" cy="50" r="60" fill="var(--color-sky)" opacity=".25" /><circle cx="58" cy="58" r={R} fill="var(--color-ink-950)" opacity=".9" /><MarkG /></g> },
  { label: "Don’t crowd it — respect the clear space.", art: <g><MarkG transform="translate(84 32) scale(.86)" /><text x="128" y="146" textAnchor="middle" fontFamily="var(--font-bricolage), sans-serif" fontWeight="800" fontSize="22" fill="var(--color-fog-50)">MEGA SALE!!! 50% OFF</text><rect x="4" y="4" width="248" height="22" fill="var(--color-magenta)" /><text x="8" y="70" fontFamily="var(--font-bricolage), sans-serif" fontWeight="800" fontSize="26" fill="var(--color-gold)">NEW!</text></g> },
];

export function Misuse() {
  return (
    <ul className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 lg:grid-cols-4">
      {MISUSE.map((m) => (
        <li key={m.label} className="bg-ink-950">
          <div className="relative">
            <svg viewBox="0 0 256 156" aria-hidden className="block h-auto w-full" style={{ background: m.ground ?? "var(--color-ink-850)" }}>{m.art}</svg>
            <svg aria-hidden viewBox="0 0 16 16" className="absolute right-2.5 top-2.5 h-5 w-5 bg-ink-950 p-1 text-danger" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l12 12M14 2L2 14" /></svg>
          </div>
          <p className="p-4 text-base leading-snug text-fog-300">{m.label}</p>
        </li>
      ))}
    </ul>
  );
}

import type { ReactNode, SVGProps } from "react";
import { LOGO_DOT, LOGO_PATHS, Logo, LogoPlate } from "@/components/brand/Logo";
import { asset } from "@/lib/env";

const MONO = "var(--font-jetbrains), monospace";

/** The wordmark as a bare <g>, for placing inside other drawings (216 × 100 units). */
export function MarkG({ stroke = "#f6f4ef", dot = "#ffd60a", ...rest }: { stroke?: string; dot?: string } & SVGProps<SVGGElement>) {
  return (
    <g {...rest}>
      <g fill="none" stroke={stroke} strokeWidth={20}>
        <path d={LOGO_PATHS.s} /><path d={LOGO_PATHS.p1} /><path d={LOGO_PATHS.p2} />
      </g>
      <circle {...LOGO_DOT} fill={dot} />
    </g>
  );
}

/** Construction drawing: the module circle, its inner/outer stroke edges, cap and base lines. */
export function Construction() {
  const centres = [[32, 30], [32, 70], [110, 30], [184, 30]] as const;
  return (
    <svg viewBox="-30 -40 276 190" role="img" aria-label="Construction of the SPP wordmark from a single circle of radius 20" className="block h-auto w-full">
      <g stroke="#33333a" strokeWidth=".4">
        {Array.from({ length: 14 }, (_, i) => <path key={`v${i}`} d={`M${-20 + i * 20} -30V130`} />)}
        {Array.from({ length: 9 }, (_, i) => <path key={`h${i}`} d={`M-30 ${-20 + i * 20}H246`} />)}
      </g>
      <g stroke="#85827c" strokeWidth=".5" strokeDasharray="2 2"><path d="M-30 0H246M-30 100H246" /></g>
      <MarkG stroke="#f6f4ef" opacity=".92" />
      <g fill="none" stroke="#00aeef" strokeWidth=".6">
        {centres.map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="20" />
            <circle cx={cx} cy={cy} r="30" strokeDasharray="1.5 2" opacity=".6" />
            <circle cx={cx} cy={cy} r="10" strokeDasharray="1.5 2" opacity=".6" />
            <path d={`M${cx - 3} ${cy}H${cx + 3}M${cx} ${cy - 3}V${cy + 3}`} />
          </g>
        ))}
      </g>
      <g stroke="#ffd60a" strokeWidth=".6" fill="none">
        <path d="M110 30H130" /><path d="M222 0V100M219 0H225M219 100H225" /><path d="M74 112H94M74 109V115M94 109V115" />
        <circle cx="184" cy="30" r="9" strokeDasharray="1 1.5" />
      </g>
      <g fontFamily={MONO} fontSize="5.2" letterSpacing=".5" fill="#c4c1b9">
        <text x="113" y="27.5">r 20</text>
        <text x="227" y="52">cap 100</text>
        <text x="74" y="123">stroke 20</text>
        <text x="196" y="22" fill="#ffd60a">registration dot · r 5.5</text>
        <text x="-20" y="-24" fill="#85827c">grid: 20 units</text>
      </g>
    </svg>
  );
}

type Version = { file: string; name: string; use: string; ground: string; render: ReactNode };

export function LogoVersions() {
  const versions: Version[] = [
    { file: "spp-wordmark-ink.svg", name: "Wordmark — on ink", use: "The primary version. Use on ink and any dark ground.", ground: "bg-ink-950", render: <Logo className="h-14 w-auto sm:h-20" /> },
    { file: "spp-wordmark-paper.svg", name: "Wordmark — on paper", use: "For paper, white and light fabric.", ground: "bg-paper", render: <Logo tone="paper" className="h-14 w-auto sm:h-20" /> },
    { file: "spp-wordmark-mono.svg", name: "Wordmark — mono", use: "One-colour processes: embroidery, engraving, vinyl cut, single-colour screen print.", ground: "bg-fog-300", render: <Logo tone="mono" className="h-14 w-auto text-paper-ink sm:h-20" /> },
    { file: "spp-icon.svg", name: "Icon — yellow plate", use: "Favicons, app icons, avatars, stickers. Only when the square is under 64 px or the wordmark will not fit.", ground: "bg-ink-800", render: <LogoPlate className="h-24 w-24 sm:h-28 sm:w-28" /> },
  ];
  return (
    <ul className="grid gap-px border border-ink-700 bg-ink-700 md:grid-cols-2">
      {versions.map((v, i) => (
        <li key={v.file} className="flex flex-col bg-ink-950">
          <div className={`flex aspect-[16/9] items-center justify-center ${v.ground}`}>{v.render}</div>
          <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
            <p className="t-label text-fog-500">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="t-heading text-fog-50">{v.name}</h3>
            <p className="flex-1 text-base text-fog-400">{v.use}</p>
            <a href={asset(`/brand/${v.file}`)} download={v.file} className="group/btn t-label mt-2 inline-flex min-h-11 items-center justify-between gap-4 border border-ink-500 px-4 text-fog-50 transition-colors duration-200 hover:border-yellow hover:text-yellow">
              <span>Download SVG</span>
              <svg aria-hidden viewBox="0 0 12 14" className="h-3.5 w-3 transition-transform duration-300 ease-[var(--ease-press)] group-hover/btn:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 0v10M2 6l4 4 4-4M0 13h12" /></svg>
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Clear space = 2x on every side, where x is the stroke width (one fifth of the cap height). */
export function ClearSpace() {
  return (
    <svg viewBox="-70 -70 356 240" role="img" aria-label="Clear space diagram: keep a margin of two stroke-widths on every side of the wordmark" className="block h-auto w-full">
      <rect x="-40" y="-40" width="296" height="180" fill="#ffd60a" fillOpacity=".07" stroke="#ffd60a" strokeWidth=".8" strokeDasharray="4 3" />
      <rect x="0" y="0" width="216" height="100" fill="none" stroke="#4a4a52" strokeWidth=".6" />
      <MarkG />
      <g stroke="#ffd60a" strokeWidth=".8">
        <path d="M-40 50H0M-40 46V54M0 46V54" /><path d="M216 50H256M216 46V54M256 46V54" />
        <path d="M108 -40V0M104 -40H112M104 0H112" /><path d="M108 100V140M104 100H112M104 140H112" />
      </g>
      <g fontFamily={MONO} fontSize="8" fill="#ffd60a" textAnchor="middle">
        <text x="-20" y="42">2x</text><text x="236" y="42">2x</text><text x="122" y="-17">2x</text><text x="122" y="124">2x</text>
      </g>
      <g stroke="#c4c1b9" strokeWidth=".8"><path d="M74 -52H94M74 -56V-48M94 -56V-48" /></g>
      <text x="100" y="-49" fontFamily={MONO} fontSize="8" fill="#c4c1b9">x = stroke width</text>
    </svg>
  );
}

export function MinimumSize() {
  return (
    <div className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700">
      {[
        { label: "Wordmark", render: <Logo className="h-4 w-auto" />, screen: "16 px high", print: "6 mm high" },
        { label: "Icon", render: <LogoPlate className="h-4 w-4" />, screen: "16 px", print: "8 mm" },
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

const MISUSE: { label: string; art: ReactNode; ground?: string }[] = [
  { label: "Don’t stretch or condense it.", art: <MarkG transform="translate(18 40) scale(1.22 .6)" /> },
  { label: "Don’t rotate or skew it.", art: <MarkG transform="translate(40 52) rotate(-14 108 50) scale(.78)" /> },
  { label: "Don’t recolour the strokes.", art: <MarkG stroke="#ec008c" transform="translate(30 30) scale(.9)" /> },
  { label: "Don’t move, resize or remove the dot.", art: <g transform="translate(30 30) scale(.9)"><MarkG dot="none" /><circle cx="110" cy="76" r="11" fill="#ffd60a" /></g> },
  { label: "Don’t outline it.", art: <g transform="translate(30 30) scale(.9)"><MarkG dot="none" /><g fill="none" stroke="#141417" strokeWidth={16.5}><path d={LOGO_PATHS.s} /><path d={LOGO_PATHS.p1} /><path d={LOGO_PATHS.p2} /></g><circle {...LOGO_DOT} fill="none" stroke="#f6f4ef" strokeWidth="1.5" /></g> },
  { label: "Don’t place it on a ground without contrast.", ground: "#d9b700", art: <MarkG stroke="#ffd60a" dot="#f6f4ef" transform="translate(30 30) scale(.9)" /> },
  { label: "Don’t add shadows, glows or gradients.", art: <g transform="translate(30 30) scale(.9)"><MarkG stroke="#2a35d6" dot="#2a35d6" transform="translate(7 7)" opacity=".8" /><MarkG /></g> },
  { label: "Don’t crowd it — respect the clear space.", art: <g><MarkG transform="translate(30 30) scale(.9)" /><text x="128" y="146" textAnchor="middle" fontFamily="var(--font-bricolage), sans-serif" fontWeight="800" fontSize="22" fill="#f6f4ef">MEGA SALE!!! 50% OFF</text><rect x="4" y="4" width="248" height="22" fill="#ec008c" /></g> },
];

export function Misuse() {
  return (
    <ul className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 lg:grid-cols-4">
      {MISUSE.map((m) => (
        <li key={m.label} className="bg-ink-950">
          <div className="relative">
            <svg viewBox="0 0 256 156" aria-hidden className="block h-auto w-full" style={{ background: m.ground ?? "#141417" }}>{m.art}</svg>
            <svg aria-hidden viewBox="0 0 16 16" className="absolute right-2.5 top-2.5 h-5 w-5 bg-ink-950 p-1 text-danger" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l12 12M14 2L2 14" /></svg>
          </div>
          <p className="p-4 text-base leading-snug text-fog-300">{m.label}</p>
        </li>
      ))}
    </ul>
  );
}

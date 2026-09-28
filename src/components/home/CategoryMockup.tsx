import { RoundelG } from "@/components/brand/Logo";
import { GARMENTS, toSvgPath } from "@/lib/garments";

/**
 * One drawn mockup per catalogue category — the thing itself, carrying SPP's
 * mark, in the brand's navy, sky and gold. Pure SVG: no photographs to wait
 * for, sharp at any size, and they follow the light/dark theme through tokens.
 */
const NAVY = "var(--color-navy)";
const SKY = "var(--color-sky)";
const GOLD = "var(--color-gold)";
const CANVAS = "#f3ead6";
const WHITE = "#ffffff";
const LINE = "rgb(11 26 74 / 0.18)";
const SHADE = "rgb(11 26 74 / 0.10)";
const DISPLAY = "var(--font-bricolage), 'Helvetica Neue', Arial, sans-serif";

const Mark = ({ x, y, s, mono = false }: { x: number; y: number; s: number; mono?: boolean }) => <RoundelG mono={mono} transform={`translate(${x} ${y}) scale(${s})`} />;
const Ground = ({ y = 204 }: { y?: number }) => <ellipse cx="160" cy={y} rx="120" ry="7" fill={SHADE} />;

function Apparel() {
  const tee = toSvgPath(GARMENTS.tee.sides[0]!.body);
  return (
    <>
      <Ground />
      <g transform="translate(18 26) rotate(-8 100 100) scale(0.165)"><path d={tee} fill={SKY} stroke={LINE} strokeWidth="6" /></g>
      <g transform="translate(150 30) rotate(9 90 100) scale(0.155)"><path d={tee} fill={GOLD} stroke={LINE} strokeWidth="6" /></g>
      <g transform="translate(66 8) scale(0.19)">
        <path d={tee} fill={NAVY} />
        <path d="M352 96 C420 150 580 150 648 96" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="10" />
        <Mark x={560} y={300} s={1.5} />
      </g>
    </>
  );
}

function Accessories() {
  return (
    <>
      <Ground />
      {/* cap */}
      <path d="M30 138 C30 82 74 52 122 52 C170 52 208 84 210 136 Z" fill={GOLD} />
      <path d="M122 52 C122 84 122 110 122 138" stroke="rgb(11 26 74 / 0.18)" strokeWidth="2" fill="none" />
      <path d="M120 136 C166 126 222 134 252 158 C214 168 158 160 120 152 Z" fill={NAVY} />
      <circle cx="122" cy="52" r="5" fill={NAVY} />
      <Mark x={62} y={80} s={0.42} />
      {/* tote */}
      <path d="M214 96 C214 58 274 58 274 96" fill="none" stroke={NAVY} strokeWidth="7" strokeLinecap="round" />
      <path d="M196 94 H292 L300 200 H188 Z" fill={CANVAS} stroke={LINE} strokeWidth="1.5" />
      <Mark x={219} y={118} s={0.5} />
      <path d="M212 180 H276" stroke={NAVY} strokeWidth="3" />
    </>
  );
}

function Promotional() {
  return (
    <>
      <Ground />
      {/* paper cup */}
      <path d="M52 56 H150 V70 H52 Z" fill={NAVY} />
      <path d="M58 70 H144 L132 200 H70 Z" fill={WHITE} stroke={LINE} strokeWidth="1.5" />
      <path d="M62 112 H140 L135 164 H67 Z" fill={GOLD} />
      <Mark x={80} y={114} s={0.42} />
      {/* mug */}
      <path d="M262 112 C300 112 300 168 262 168" fill="none" stroke={SKY} strokeWidth="11" />
      <rect x="180" y="92" width="88" height="108" rx="10" fill={SKY} />
      <Mark x={198} y={118} s={0.52} />
      {/* pen */}
      <g transform="rotate(-32 300 60)"><rect x="276" y="52" width="70" height="9" rx="4.5" fill={NAVY} /><path d="M346 52 L360 56.5 L346 61 Z" fill={GOLD} /></g>
    </>
  );
}

function Print() {
  return (
    <>
      <Ground />
      <g transform="rotate(-12 110 120)"><rect x="52" y="40" width="118" height="158" fill={SKY} /></g>
      <g transform="rotate(7 200 120)"><rect x="150" y="42" width="118" height="158" fill={NAVY} /><circle cx="209" cy="104" r="30" fill={GOLD} /><path d="M170 160 H248 M170 174 H226" stroke="rgb(255 255 255 / 0.7)" strokeWidth="5" /></g>
      <rect x="100" y="30" width="122" height="166" fill={WHITE} stroke={LINE} strokeWidth="1.5" />
      <rect x="100" y="30" width="122" height="70" fill={NAVY} />
      <Mark x={136} y={40} s={0.5} />
      <path d="M116 122 H206 M116 138 H206 M116 154 H180" stroke={LINE} strokeWidth="5" />
      <rect x="116" y="170" width="46" height="12" fill={GOLD} />
    </>
  );
}

function Display() {
  return (
    <>
      <Ground />
      {/* A-board */}
      <path d="M58 200 L92 48 H162 L196 200" fill="none" stroke={NAVY} strokeWidth="6" strokeLinejoin="round" />
      <path d="M96 60 H158 L182 176 H72 Z" fill={WHITE} stroke={LINE} strokeWidth="1.5" />
      <Mark x={102} y={72} s={0.5} />
      <path d="M92 140 H162 M88 156 H166" stroke={LINE} strokeWidth="5" />
      {/* J-flag */}
      <path d="M244 26 V198" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
      <path d="M226 200 H262" stroke={NAVY} strokeWidth="7" strokeLinecap="round" />
      <path d="M246 30 C292 30 304 52 304 84 V172 H246 Z" fill={GOLD} />
      <Mark x={254} y={62} s={0.42} />
      <path d="M256 126 H294 M256 140 H286" stroke="rgb(11 26 74 / 0.5)" strokeWidth="4" />
    </>
  );
}

function Signage() {
  return (
    <>
      <Ground />
      <rect x="34" y="84" width="252" height="118" fill="var(--color-ink-700)" />
      <rect x="34" y="84" width="252" height="10" fill={SHADE} />
      {/* fascia sign */}
      <rect x="26" y="34" width="268" height="56" fill={NAVY} />
      <rect x="26" y="34" width="268" height="5" fill={GOLD} />
      <Mark x={44} y={40} s={0.44} />
      <text x="100" y="74" fontFamily={DISPLAY} fontWeight="800" fontSize="34" letterSpacing="-1" fill={GOLD}>SPP</text>
      <text x="176" y="72" fontFamily="var(--font-jetbrains), monospace" fontSize="9" letterSpacing="2" fill="rgb(255 255 255 / 0.8)">PRINT · SIGN</text>
      {/* door and window */}
      <rect x="60" y="112" width="52" height="90" fill={WHITE} stroke={LINE} strokeWidth="1.5" />
      <circle cx="102" cy="160" r="3" fill={NAVY} />
      <rect x="134" y="112" width="128" height="62" fill={SKY} opacity="0.55" />
      <path d="M134 112 H262 V174 H134 Z M198 112 V174" fill="none" stroke={WHITE} strokeWidth="3" />
      {/* projecting sign */}
      <path d="M286 100 H310" stroke={NAVY} strokeWidth="4" />
      <circle cx="310" cy="122" r="18" fill={GOLD} />
    </>
  );
}

function Outdoor() {
  return (
    <>
      <path d="M0 200 H320" stroke={LINE} strokeWidth="2" />
      <path d="M0 200 V168 H26 V150 H54 V176 H84 V160 H104 V200 Z M228 200 V164 H252 V146 H282 V172 H320 V200 Z" fill={SHADE} />
      <rect x="112" y="118" width="10" height="82" fill={NAVY} />
      <rect x="198" y="118" width="10" height="82" fill={NAVY} />
      <rect x="60" y="112" width="200" height="8" fill={NAVY} />
      <rect x="54" y="26" width="212" height="88" fill={NAVY} />
      <rect x="60" y="32" width="200" height="76" fill={GOLD} />
      <Mark x={72} y={40} s={0.6} />
      <text x="142" y="72" fontFamily={DISPLAY} fontWeight="800" fontSize="26" letterSpacing="-1" fill="var(--color-ink-950, #0b1a4a)" className="fill-[#0b1a4a]">YOUR</text>
      <text x="142" y="96" fontFamily={DISPLAY} fontWeight="800" fontSize="26" letterSpacing="-1" className="fill-[#0b1a4a]">BRAND</text>
      {[84, 160, 236].map((x) => <path key={x} d={`M${x} 26 V14 H${x + 12}`} fill="none" stroke={NAVY} strokeWidth="3" />)}
    </>
  );
}

function Vehicle() {
  return (
    <>
      <Ground y={206} />
      <g transform="translate(6 -14) scale(0.52)">
        <path d="M60 330V150Q60 130 80 130H400Q420 130 432 146L486 220H520Q548 224 552 256V330Z" fill={WHITE} stroke={LINE} strokeWidth="3" />
        <path d="M60 286H552V330H60Z" fill={GOLD} />
        <path d="M404 152H420L468 220H404Z" fill={SKY} opacity="0.7" />
        <path d="M392 140V286" stroke={LINE} strokeWidth="3" />
        <path d="M60 150Q60 130 80 130H392V286H60Z" fill={NAVY} />
        <Mark x={96} y={152} s={1.1} />
        <text x="220" y="232" fontFamily={DISPLAY} fontWeight="800" fontSize="64" letterSpacing="-2" fill={GOLD}>SPP</text>
        {[150, 462].map((cx) => (<g key={cx}><circle cx={cx} cy="334" r="36" fill="#0b1a4a" /><circle cx={cx} cy="334" r="15" fill={WHITE} /></g>))}
      </g>
    </>
  );
}

const ART: Record<string, () => React.ReactElement> = { apparel: Apparel, accessories: Accessories, promotional: Promotional, print: Print, display: Display, signage: Signage, outdoor: Outdoor, vehicle: Vehicle };

export function CategoryMockup({ slug, label, className }: { slug: string; label: string; className?: string }) {
  const Art = ART[slug] ?? Print;
  return (
    <svg viewBox="0 0 320 220" role="img" aria-label={`${label} — illustrated mockup carrying the SPP mark`} className={className} preserveAspectRatio="xMidYMid meet">
      <Art />
    </svg>
  );
}

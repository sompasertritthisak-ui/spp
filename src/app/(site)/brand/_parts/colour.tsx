import { BRAND } from "@/lib/brand";

type Swatch = { name: string; token: string; hex: string; role: string };

const rgb = (hex: string): [number, number, number] => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG 2 contrast ratio — computed from the tokens, so the table can never drift from the palette. */
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]; return (hi + 0.05) / (lo + 0.05); };
const onColour = (hex: string) => (contrast(hex, BRAND.white) >= contrast(hex, BRAND.ink) ? BRAND.white : BRAND.ink);

/** Device-independent arithmetic conversion — a starting point for prepress, never a colour-managed value. */
function cmyk(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => c / 255) as [number, number, number];
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return "0 / 0 / 0 / 100";
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100)).join(" / ");
}

const SIGNATURE: Swatch[] = [
  { name: "Midnight Indigo", token: "ink-950", hex: BRAND.ink, role: "The ground. SPP’s deep blue taken to night — most of what we publish sits on it." },
  { name: "SPP Gold", token: "gold", hex: BRAND.gold, role: "The signature. Primary actions, the active state, one highlighted word, the letters in the roundel." },
  { name: "Sky", token: "sky", hex: BRAND.sky, role: "The secondary accent. Links, information, data series, construction lines." },
];
const DEEP: Swatch[] = [
  { name: "SPP Navy", token: "navy", hex: BRAND.navy, role: "The heritage deep blue. Garments, vehicle livery, large printed solids." },
  { name: "Ultra", token: "ultra", hex: BRAND.ultra, role: "Links and focus rings on white." },
  { name: "Violet", token: "violet", hex: BRAND.violet, role: "The purple edge of the blue. Atmosphere and depth — never text on indigo." },
];
const NEUTRAL: Swatch[] = [
  { name: "Cool White", token: "paper", hex: BRAND.white, role: "“A bit of white”: inverse sections, long reading, text on indigo." },
  { name: "Indigo Raised", token: "ink-900", hex: BRAND.inkRaised, role: "Panels and raised surfaces; text on white." },
  { name: "Indigo Line", token: "ink-700", hex: BRAND.inkLine, role: "Hairline rules on indigo." },
  { name: "Fog", token: "fog-400", hex: BRAND.fog, role: "Labels and secondary text on indigo." },
];

function Values({ hex }: { hex: string }) {
  return (
    <dl className="t-data grid grid-cols-[3.75rem_1fr] gap-y-1 text-xs">
      <dt className="opacity-60">HEX</dt><dd className="uppercase">{hex}</dd>
      <dt className="opacity-60">RGB</dt><dd>{rgb(hex).join(" / ")}</dd>
      <dt className="opacity-60">CMYK≈</dt><dd>{cmyk(hex)}</dd>
    </dl>
  );
}

function Block({ s, className = "" }: { s: Swatch; className?: string }) {
  return (
    <li className={`flex flex-col justify-between gap-10 p-6 ${className}`} style={{ background: s.hex, color: onColour(s.hex) }}>
      <div>
        <p className="t-label opacity-70">{s.token}</p>
        <h3 className="t-title mt-3">{s.name}</h3>
        <p className="mt-3 max-w-[32ch] text-base opacity-85">{s.role}</p>
      </div>
      <Values hex={s.hex} />
    </li>
  );
}

const RATIO = [
  { name: "Midnight Indigo", pct: 60, bg: BRAND.ink },
  { name: "Cool White", pct: 16, bg: BRAND.white },
  { name: "Deep blues", pct: 12, bg: BRAND.navy },
  { name: "Gold", pct: 8, bg: BRAND.gold },
  { name: "Sky", pct: 4, bg: BRAND.sky },
];

const PAIRS: { fg: string; bg: string; label: string; use: string }[] = [
  { fg: BRAND.white, bg: BRAND.ink, label: "Cool White on Midnight Indigo", use: "Headlines and body" },
  { fg: BRAND.gold, bg: BRAND.ink, label: "Gold on Midnight Indigo", use: "The highlighted word, active states" },
  { fg: BRAND.sky, bg: BRAND.ink, label: "Sky on Midnight Indigo", use: "Links, information" },
  { fg: BRAND.fog, bg: BRAND.ink, label: "Fog on Midnight Indigo", use: "Labels, meta" },
  { fg: BRAND.ink, bg: BRAND.gold, label: "Midnight Indigo on Gold", use: "Primary buttons, the closing band" },
  { fg: BRAND.inkRaised, bg: BRAND.white, label: "Indigo on Cool White", use: "Text on white" },
  { fg: BRAND.ultra, bg: BRAND.white, label: "Ultra on Cool White", use: "Links on white" },
  { fg: BRAND.white, bg: BRAND.navy, label: "Cool White on SPP Navy", use: "Garments, livery" },
  { fg: BRAND.gold, bg: BRAND.white, label: "Gold on Cool White", use: "Never for text — use gold as a fill behind indigo" },
  { fg: BRAND.sky, bg: BRAND.white, label: "Sky on Cool White", use: "Never for text — use Ultra" },
  { fg: BRAND.white, bg: BRAND.gold, label: "Cool White on Gold", use: "Never — text on gold is always indigo" },
  { fg: BRAND.violet, bg: BRAND.ink, label: "Violet on Midnight Indigo", use: "Never for text — atmosphere only" },
];

const DOS = [
  "Let midnight indigo carry the layout; colour arrives as an event.",
  "One gold action per view. If two things are gold, neither is primary.",
  "Use sky for what informs — links, data, guides — and gold for what converts.",
  "Set text on gold in midnight indigo, always.",
  "Bring in cool white for long reading and a change of pace.",
];
const DONTS = [
  "Don’t use pure black or pure white. Our dark is indigo; our white is cool.",
  "Don’t give gold and sky equal weight — sky is always the quieter of the two.",
  "Don’t set gold or sky text on white; both fail contrast.",
  "Don’t turn gold into a gradient, a glow or a metallic effect.",
  "Don’t use orange as a brand colour — it is reserved for warnings.",
];

export function Palette() {
  return (
    <div>
      <ul className="grid gap-px border border-paper-line bg-paper-line lg:grid-cols-[5fr_3fr_2fr]">
        {SIGNATURE.map((s) => <Block key={s.token} s={s} className="min-h-[20rem] lg:min-h-[26rem]" />)}
      </ul>
      <ul className="mt-px grid gap-px border border-t-0 border-paper-line bg-paper-line sm:grid-cols-3">
        {DEEP.map((s) => <Block key={s.token} s={s} className="min-h-[15rem]" />)}
      </ul>
      <ul className="mt-px grid grid-cols-2 gap-px border border-t-0 border-paper-line bg-paper-line md:grid-cols-4">
        {NEUTRAL.map((s) => (
          <li key={s.token} className="flex flex-col bg-paper">
            <div className="h-20 border-b border-paper-line" style={{ background: s.hex }} />
            <div className="flex flex-1 flex-col gap-3 p-4 text-paper-ink">
              <h3 className="t-label">{s.name}</h3>
              <p className="flex-1 text-base leading-snug text-paper-mute">{s.role}</p>
              <Values hex={s.hex} />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-16 grid gap-x-16 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h3 className="t-heading text-paper-ink">Usage ratio</h3>
          <p className="mt-3 text-base leading-relaxed text-paper-mute">Gold works because there is so little of it, and sky works because there is even less. If a layout feels flat, add contrast in scale or tone before adding more colour.</p>
        </div>
        <div className="lg:col-span-8">
          <div className="flex h-20 border border-paper-ink" role="img" aria-label={`Usage ratio: ${RATIO.map((r) => `${r.name} ${r.pct} per cent`).join(", ")}`}>
            {RATIO.map((r) => <div key={r.name} style={{ width: `${r.pct}%`, background: r.bg }} />)}
          </div>
          <ul className="t-label mt-3 flex flex-wrap gap-x-6 gap-y-2 text-paper-mute">
            {RATIO.map((r) => <li key={r.name} className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 border border-paper-ink" style={{ background: r.bg }} />{r.name} {r.pct}%</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-16">
        <h3 className="t-heading text-paper-ink">Accessible pairings</h3>
        <p className="mt-3 max-w-[64ch] text-base leading-relaxed text-paper-mute">Contrast ratios are calculated from the values above (WCAG 2). Body text needs 4.5:1 (AA); large display type and interface graphics need 3:1.</p>
        <ul className="mt-6 grid gap-px border border-paper-line bg-paper-line sm:grid-cols-2 lg:grid-cols-3">
          {PAIRS.map((p) => {
            const ratio = contrast(p.fg, p.bg);
            const grade = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "Large type only" : "Fails";
            return (
              <li key={p.label} className="flex flex-col bg-paper">
                <div className="flex h-24 items-center justify-between gap-4 px-5" style={{ background: p.bg, color: p.fg }}>
                  <span className="font-display text-4xl font-bold tracking-[-0.03em]">Aa</span>
                  <span className="t-data text-sm">{ratio.toFixed(1)}:1</span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <p className="t-label flex items-center gap-2 text-paper-ink">
                    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="1.8">{ratio >= 3 ? <path d="M1 6.5l3.2 3L11 2.5" /> : <path d="M2 2l8 8M10 2l-8 8" />}</svg>
                    {grade}
                  </p>
                  <p className="text-base font-semibold text-paper-ink">{p.label}</p>
                  <p className="text-base text-paper-mute">{p.use}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-16 grid gap-x-16 gap-y-10 md:grid-cols-2">
        {[{ title: "Do", items: DOS, ok: true }, { title: "Don’t", items: DONTS, ok: false }].map((col) => (
          <div key={col.title}>
            <h3 className="t-heading text-paper-ink">{col.title}</h3>
            <ul className="mt-5 border-b border-paper-ink">
              {col.items.map((d) => (
                <li key={d} className="flex items-baseline gap-4 border-t border-paper-ink py-4 text-lg text-paper-ink">
                  <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="1.8">{col.ok ? <path d="M1 6.5l3.2 3L11 2.5" /> : <path d="M2 2l8 8M10 2l-8 8" />}</svg>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-12 max-w-[70ch] border-l-2 border-paper-ink pl-5 text-base leading-relaxed text-paper-mute">
        CMYK values are arithmetic approximations for orientation only. Deep blues and violets shift noticeably between screen and press, and gold depends on the substrate — SPP prepress sets the final build for each process and confirms it on a production proof.
      </p>
    </div>
  );
}

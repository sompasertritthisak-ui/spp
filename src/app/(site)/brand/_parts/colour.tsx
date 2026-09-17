type Swatch = { name: string; token: string; hex: string; role: string; light?: boolean };

const CORE: Swatch[] = [
  { name: "Press Ink", token: "ink-950", hex: "#09090a", role: "The ground. Most of what SPP publishes sits on it." },
  { name: "Paper", token: "paper", hex: "#f3f0e8", role: "The warm inverse. For long reading and a change of pace.", light: true },
  { name: "Process Yellow", token: "yellow", hex: "#ffd60a", role: "The only accent. Primary actions, the active state, one highlighted word.", light: true },
];
const SUPPORT: Swatch[] = [
  { name: "Ink 800", token: "ink-800", hex: "#1a1a1e", role: "Raised surfaces, panels." },
  { name: "Ink 700", token: "ink-700", hex: "#242429", role: "Hairline rules." },
  { name: "Fog 50", token: "fog-50", hex: "#f6f4ef", role: "Headlines on ink.", light: true },
  { name: "Fog 300", token: "fog-300", hex: "#c4c1b9", role: "Body text on ink.", light: true },
  { name: "Paper Ink", token: "paper-ink", hex: "#141414", role: "Text on paper." },
  { name: "Heritage Ultra", token: "ultra", hex: "#2a35d6", role: "Links and focus on paper. SPP’s original blue, refined." },
  { name: "Process Cyan", token: "cyan", hex: "#00aeef", role: "Print details only — colour bars, construction lines.", light: true },
  { name: "Process Magenta", token: "magenta", hex: "#ec008c", role: "Print details only. Never a ground." },
];

const rgb = (hex: string): [number, number, number] => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

/** Device-independent arithmetic conversion — a starting point for prepress, never a colour-managed value. */
function cmyk(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => c / 255) as [number, number, number];
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return "0 / 0 / 0 / 100";
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100)).join(" / ");
}

function Values({ s }: { s: Swatch }) {
  return (
    <dl className="t-data grid grid-cols-[3.5rem_1fr] gap-y-1 text-xs">
      <dt className="opacity-60">HEX</dt><dd className="uppercase">{s.hex}</dd>
      <dt className="opacity-60">RGB</dt><dd>{rgb(s.hex).join(" / ")}</dd>
      <dt className="opacity-60">CMYK≈</dt><dd>{cmyk(s.hex)}</dd>
    </dl>
  );
}

const RATIO = [
  { name: "Ink", pct: 68, bg: "#09090a", fg: "#f6f4ef" },
  { name: "Paper", pct: 20, bg: "#f3f0e8", fg: "#141414" },
  { name: "Yellow", pct: 8, bg: "#ffd60a", fg: "#141414" },
  { name: "Ultra", pct: 3, bg: "#2a35d6", fg: "#f6f4ef" },
  { name: "C/M", pct: 1, bg: "#ec008c", fg: "#f6f4ef" },
];

export function Palette() {
  return (
    <div>
      <ul className="grid gap-px border border-paper-line bg-paper-line lg:grid-cols-[5fr_3fr_2fr]">
        {CORE.map((s) => (
          <li key={s.token} className="flex min-h-[20rem] flex-col justify-between p-6 lg:min-h-[26rem]" style={{ background: s.hex, color: s.light ? "#141414" : "#f6f4ef" }}>
            <div>
              <p className="t-label opacity-70">{s.token}</p>
              <h3 className="t-title mt-3">{s.name}</h3>
              <p className="mt-3 max-w-[30ch] text-base opacity-80">{s.role}</p>
            </div>
            <Values s={s} />
          </li>
        ))}
      </ul>

      <ul className="mt-px grid grid-cols-2 gap-px border border-t-0 border-paper-line bg-paper-line md:grid-cols-4">
        {SUPPORT.map((s) => (
          <li key={s.token} className="flex flex-col bg-paper">
            <div className="h-20 border-b border-paper-line" style={{ background: s.hex }} />
            <div className="flex flex-1 flex-col gap-3 p-4 text-paper-ink">
              <h3 className="t-label">{s.name}</h3>
              <p className="flex-1 text-base leading-snug text-paper-mute">{s.role}</p>
              <Values s={s} />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-14 grid gap-x-16 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h3 className="t-heading text-paper-ink">Usage ratio</h3>
          <p className="mt-3 text-base leading-relaxed text-paper-mute">Yellow works because there is so little of it. If a layout feels flat, add contrast in scale or tone before adding more colour.</p>
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
      <p className="mt-10 max-w-[70ch] border-l-2 border-paper-ink pl-5 text-base leading-relaxed text-paper-mute">
        CMYK values are arithmetic approximations for orientation only. Colour on press depends on the substrate and process — SPP prepress sets the final build (including the rich-black recipe for large solids) and confirms it on a production proof.
      </p>
    </div>
  );
}

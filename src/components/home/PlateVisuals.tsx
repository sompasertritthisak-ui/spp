import type { CSSProperties, ReactNode } from "react";
import { ROUNDEL, ROUNDEL_ARC_TEXT, ROUNDEL_COLOURS as C, ROUNDEL_LETTERS, ROUNDEL_RIGHT, ROUNDEL_SPLIT } from "@/components/brand/logo-paths";
import { GARMENTS, toSvgPath } from "@/lib/garments";

/**
 * Five small drawings, one per plate. Each takes `on`: false = the make-ready
 * state (unregistered, undrawn), true = registered. CSS transitions do the
 * motion, so reduced-motion and no-JS visitors simply get the finished drawing.
 */
export type PlateKey = "idea" | "design" | "visualise" | "produce" | "promote";

const MONO = "var(--font-jetbrains), monospace";
const DISPLAY = "var(--font-bricolage), sans-serif";
const t = (ms: number, delay = 0, props = "transform, opacity"): CSSProperties => ({
  transitionProperty: props,
  transitionDuration: `${ms}ms`,
  transitionDelay: `${delay}ms`,
  transitionTimingFunction: "var(--ease-sheet)",
});
const draw = (on: boolean, ms: number, delay = 0): CSSProperties => ({ strokeDasharray: 1, strokeDashoffset: on ? 0 : 1, ...t(ms, delay, "stroke-dashoffset") });
const fade = (on: boolean, delay = 0): CSSProperties => ({ opacity: on ? 1 : 0, ...t(500, delay, "opacity") });

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 600 600" role="img" aria-label={label} className="block h-full w-full" style={{ isolation: "isolate" }}>
      {children}
    </svg>
  );
}

function Idea({ on }: { on: boolean }) {
  return (
    <Frame label="A rough pencil sketch of a letter S with handwritten notes">
      <g stroke="var(--color-ink-700)" strokeWidth="1">
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M60 ${100 + i * 50}H540`} />)}
      </g>
      <path pathLength={1} d="M398 196 C352 148 246 158 238 232 C231 304 384 296 374 384 C366 452 262 458 204 408" fill="none" stroke="var(--color-fog-300)" strokeWidth="3" strokeLinecap="round" style={draw(on, 1100)} />
      <path pathLength={1} d="M404 204 C350 160 256 172 250 236 C246 298 392 300 384 380 C374 446 270 466 210 420" fill="none" stroke="var(--color-fog-500)" strokeWidth="1.5" strokeLinecap="round" style={draw(on, 1100, 150)} />
      <path pathLength={1} d="M150 300 C150 120 470 110 470 300 C470 500 140 500 152 292" fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" style={draw(on, 1200, 500)} />
      <g fontFamily={MONO} fontSize="13" letterSpacing="1.5" fill="var(--color-fog-400)">
        <g style={fade(on, 900)}><path d="M432 168 L486 120" stroke="var(--color-ink-500)" /><text x="430" y="108">THE NAME?</text></g>
        <g style={fade(on, 1050)}><path d="M196 430 L150 486" stroke="var(--color-ink-500)" /><text x="70" y="508">ONE COLOUR. READS FROM 30 M.</text></g>
        <g style={fade(on, 1200)}><text x="70" y="82">V0 — NAPKIN</text></g>
      </g>
    </Frame>
  );
}

/** The roundel scaled from its 100-unit box into the 600 × 600 frame. */
const ROUNDEL_FIT = "translate(100 100) scale(4)";

function Design({ on }: { on: boolean }) {
  return (
    <Frame label="The SPP roundel being assembled: the circle, the wave seam, the sky-blue half, then the gold letters and the base text">
      <g transform={ROUNDEL_FIT}>
        <g fill="none" stroke="var(--color-sky)" strokeWidth=".5" strokeOpacity=".6" style={fade(on)}>
          <path d="M-12 50H112M50 -12V112" strokeDasharray="2 3" />
          <circle cx="50" cy="50" r="41.8" strokeDasharray="1.5 2.5" />
          <circle cx="50" cy="50" r="56" strokeOpacity=".4" />
        </g>
        <circle cx={ROUNDEL.cx} cy={ROUNDEL.cy} r={ROUNDEL.r} fill={C.indigo} style={fade(on, 150)} />
        <path pathLength={1} d={ROUNDEL_SPLIT} fill="none" stroke={C.white} strokeWidth="1.8" strokeLinecap="round" style={draw(on, 900, 400)} />
        <path d={ROUNDEL_RIGHT} fill={C.sky} style={fade(on, 1100)} />
        <path d={ROUNDEL_SPLIT} fill="none" stroke={C.white} strokeWidth="1.8" strokeLinecap="round" style={fade(on, 1100)} />
        <g fill={C.gold} stroke={C.goldDeep} strokeWidth=".7" strokeLinejoin="round" paintOrder="stroke">
          <path d={ROUNDEL_LETTERS.s} style={fade(on, 1500)} />
          <path d={ROUNDEL_LETTERS.p1} style={fade(on, 1620)} />
          <path d={ROUNDEL_LETTERS.p2} style={fade(on, 1740)} />
        </g>
        <path d={ROUNDEL_ARC_TEXT} fill={C.white} style={fade(on, 1900)} />
      </g>
      <g fontFamily={MONO} fontSize="13" letterSpacing="1.5" fill="var(--color-fog-400)" style={fade(on, 900)}>
        <text x="64" y="72">R 48 · SEAM · GOLD SERIF</text>
        <text x="64" y="548">ONE MARK. EVERY SURFACE.</text>
      </g>
    </Frame>
  );
}

function Visualise({ on }: { on: boolean }) {
  const [front, back] = GARMENTS.tee.sides;
  if (!front || !back) return null;
  return (
    <Frame label="A T-shirt mockup shown front and back with the print area marked">
      <g style={{ transform: on ? "none" : "translate(-30px, 0)", opacity: on ? 1 : 0, ...t(800, 200) }}>
        <g transform="translate(24 150) scale(.27)">
          <path d={toSvgPath(back.body)} fill="var(--color-ink-800)" stroke="var(--color-ink-500)" strokeWidth="5" />
          <text x="500" y="420" textAnchor="middle" fontFamily={DISPLAY} fontWeight="800" fontSize="120" fill="var(--color-fog-500)">CREW</text>
        </g>
        <text x="159" y="480" textAnchor="middle" fontFamily={MONO} fontSize="12" letterSpacing="2" fill="var(--color-fog-500)">BACK</text>
      </g>
      <g style={{ transform: on ? "none" : "translate(36px, 0)", opacity: on ? 1 : 0, ...t(800) }}>
        <g transform="translate(200 60) scale(.4)">
          <path d={toSvgPath(front.body)} fill="var(--color-paper)" />
          {front.seams.map((d) => <path key={d} d={d} fill="none" stroke="var(--color-paper-line)" strokeWidth="3" />)}
          <rect x={front.area.x} y={front.area.y} width={front.area.w} height={front.area.h} fill="none" stroke="var(--color-ink-900)" strokeOpacity=".45" strokeWidth="3" strokeDasharray="12 10" style={fade(on, 600)} />
          <g style={{ transform: on ? "none" : "translate(0, 40px)", opacity: on ? 1 : 0, ...t(700, 900) }}>
            <text x="500" y="440" textAnchor="middle" fontFamily={DISPLAY} fontWeight="800" fontSize="92" letterSpacing="-3" fill="var(--color-ink-900)">YOUR BRAND</text>
            <text x="500" y="540" textAnchor="middle" fontFamily="var(--font-instrument), serif" fontStyle="italic" fontSize="76" fill="var(--color-ink-900)">made real</text>
            <circle cx="660" cy="610" r="18" fill="var(--color-gold)" />
          </g>
        </g>
        <text x="400" y="540" textAnchor="middle" fontFamily={MONO} fontSize="12" letterSpacing="2" fill="var(--color-fog-300)">FRONT · PRINT AREA SHOWN</text>
      </g>
    </Frame>
  );
}

const REG_TARGETS = [[70, 110], [530, 110], [70, 490], [530, 490]] as const;

function Produce({ on }: { on: boolean }) {
  // the roundel's three inks, each on its own plate
  const plates = [
    { k: "indigo", off: "translate(-52px, -34px) rotate(-3deg)", art: <circle cx={ROUNDEL.cx} cy={ROUNDEL.cy} r={ROUNDEL.r} fill={C.indigo} /> },
    { k: "sky", off: "translate(44px, 26px) rotate(2deg)", art: <path d={ROUNDEL_RIGHT} fill={C.sky} /> },
    { k: "gold", off: "translate(-14px, 58px) rotate(-1deg)", art: <g fill={C.gold}><path d={ROUNDEL_LETTERS.s} /><path d={ROUNDEL_LETTERS.p1} /><path d={ROUNDEL_LETTERS.p2} /><path d={ROUNDEL_ARC_TEXT} /></g> },
  ];
  return (
    <Frame label="Three colour separations — indigo, sky and gold — sliding into register to form the SPP roundel">
      {plates.map((p, i) => (
        <g key={p.k} style={{ mixBlendMode: "screen", transform: on ? "none" : p.off, transformOrigin: "300px 300px", ...t(1100, i * 140, "transform") }}>
          <g transform={ROUNDEL_FIT}>{p.art}</g>
        </g>
      ))}
      <g stroke="var(--color-fog-500)" strokeWidth="1.2" fill="none">
        {REG_TARGETS.map(([x, y]) => (
          <g key={`${x}-${y}`}><circle cx={x} cy={y} r="9" /><path d={`M${x - 16} ${y}H${x + 16}M${x} ${y - 16}V${y + 16}`} /></g>
        ))}
      </g>
      <g transform="translate(64 520)">
        {["var(--color-ultra)", "var(--color-sky)", "var(--color-gold)", "var(--color-navy)"].map((c, i) => <rect key={c} x={i * 40} width="40" height="10" fill={c} stroke="var(--color-ink-600)" />)}
      </g>
      <text x="536" y="530" textAnchor="end" fontFamily={MONO} fontSize="12" letterSpacing="2" fill="var(--color-fog-400)" style={fade(on, 1200)}>IN REGISTER · PASSED QC</text>
      <text x="536" y="530" textAnchor="end" fontFamily={MONO} fontSize="12" letterSpacing="2" fill="var(--color-fog-500)" style={fade(!on)}>MAKE-READY…</text>
    </Frame>
  );
}

function Promote({ on }: { on: boolean }) {
  return (
    <Frame label="A roadside billboard carrying your brand">
      <path d="M0 520H600" stroke="var(--color-ink-600)" />
      <path d="M0 560H600" stroke="var(--color-ink-600)" strokeDasharray="28 22" />
      <g fill="var(--color-ink-850)" stroke="var(--color-ink-700)">
        <path d="M0 520V470H40V440H90V480H130V455H170V520Z" /><path d="M470 520V462H505V430H548V476H600V520Z" />
      </g>
      <g fill="var(--color-ink-800)" stroke="var(--color-ink-600)">
        <rect x="206" y="330" width="16" height="190" /><rect x="378" y="330" width="16" height="190" />
        <rect x="84" y="318" width="432" height="12" />
      </g>
      <rect x="92" y="112" width="416" height="206" fill="var(--color-ink-900)" stroke="var(--color-ink-500)" />
      <g style={{ clipPath: on ? "inset(0 0 0 0)" : "inset(0 100% 0 0)", ...t(1000, 150, "clip-path") }}>
        <rect x="100" y="120" width="400" height="190" fill="var(--color-gold)" />
        <text x="124" y="226" fontFamily={DISPLAY} fontWeight="800" fontSize="64" letterSpacing="-2.5" fill="var(--color-ink-950)">YOUR BRAND</text>
        <text x="124" y="274" fontFamily="var(--font-instrument), serif" fontStyle="italic" fontSize="34" fill="var(--color-ink-950)">seen from the road</text>
        <g fill="var(--color-ink-950)"><rect x="432" y="242" width="44" height="44" /><rect x="440" y="250" width="12" height="12" fill="var(--color-gold)" /><rect x="458" y="268" width="10" height="10" fill="var(--color-gold)" /></g>
      </g>
      <g stroke="var(--color-fog-500)" strokeWidth="1.5">{[150, 250, 350, 450].map((x) => <path key={x} d={`M${x} 112V92H${x + 16}`} fill="none" />)}</g>
      <g style={{ transform: on ? "none" : "translate(-120px, 0)", opacity: on ? 1 : 0, ...t(1200, 500) }}>
        <path d="M60 540 h64 l-8 -18 h-34 l-10 10 h-12 Z" fill="var(--color-fog-300)" /><circle cx="76" cy="542" r="6" fill="var(--color-ink-950)" stroke="var(--color-fog-300)" /><circle cx="110" cy="542" r="6" fill="var(--color-ink-950)" stroke="var(--color-fog-300)" />
      </g>
      <text x="508" y="348" textAnchor="end" fontFamily={MONO} fontSize="11" letterSpacing="2" fill="var(--color-fog-500)" style={fade(on, 1000)}>QR · TRACKED PER FACE</text>
    </Frame>
  );
}

export function PlateVisual({ plate, on }: { plate: PlateKey; on: boolean }) {
  switch (plate) {
    case "idea": return <Idea on={on} />;
    case "design": return <Design on={on} />;
    case "visualise": return <Visualise on={on} />;
    case "produce": return <Produce on={on} />;
    default: return <Promote on={on} />;
  }
}

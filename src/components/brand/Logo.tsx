import { clsx } from "clsx";
import { useId } from "react";
import { ROUNDEL, ROUNDEL_ARC_TEXT, ROUNDEL_COLOURS as C, ROUNDEL_LETTERS, ROUNDEL_RIGHT, ROUNDEL_SPLIT, ROUNDEL_VIEWBOX } from "./logo-paths";

/**
 * The SPP logo: the company's own roundel, redrawn as vector from its printed
 * collateral (see scripts/build-logo.ts). A circle divided by a wave into deep
 * indigo and sky blue, "SPP" in gold italic serif stacked down the seam, and
 * "SOLE CO., LTD" set along the base. All letterforms are outlines, so it never
 * waits on a webfont and renders identically in SVG, canvas and librsvg.
 *
 *   <Roundel/>  the circular mark alone (square)
 *   <Logo/>     the horizontal lockup: roundel + "SPP · Sole Co., Ltd"
 */

export type LogoTone = "ink" | "paper" | "mono";

type RoundelProps = {
  className?: string;
  title?: string;
  /** one-colour rendering in currentColor — embroidery, engraving, watermarks */
  mono?: boolean;
  /** colour of the seam and letters in mono mode: the ground the mark sits on (default: ink for a light currentColor) */
  knock?: string;
  animate?: boolean;
};

export function Roundel({ className, title = "SPP", mono = false, knock: knockIn, animate = false }: RoundelProps) {
  const id = useId();
  const ind = `${id}-ind`, sky = `${id}-sky`;
  const knock = mono ? (knockIn ?? "var(--color-ink-950, #0b0e2c)") : C.white;
  const pop = (delay: number) => (animate ? { opacity: 0, animation: `logo-pop .45s var(--ease-press, cubic-bezier(.2,.8,.2,1)) ${delay}s forwards` } : undefined);
  return (
    <svg viewBox={ROUNDEL_VIEWBOX} role="img" aria-label={title} className={clsx("block h-6 w-auto", className)} style={animate ? { animation: "logo-in .5s var(--ease-press, cubic-bezier(.2,.8,.2,1)) both" } : undefined}>
      {!mono && (
        <defs>
          <radialGradient id={ind} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor={C.indigo} /><stop offset="1" stopColor={C.indigoDeep} /></radialGradient>
          <linearGradient id={sky} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.skyLight} /><stop offset="1" stopColor={C.sky} /></linearGradient>
        </defs>
      )}
      <circle cx={ROUNDEL.cx} cy={ROUNDEL.cy} r={ROUNDEL.r} fill={mono ? "currentColor" : `url(#${ind})`} />
      {!mono && <path d={ROUNDEL_RIGHT} fill={`url(#${sky})`} style={pop(0.1)} />}
      <path d={ROUNDEL_SPLIT} fill="none" stroke={knock} strokeWidth="1.8" strokeLinecap="round" style={pop(0.15)} />
      <g fill={mono ? knock : C.gold} stroke={mono ? "none" : C.goldDeep} strokeWidth=".7" strokeLinejoin="round" paintOrder="stroke">
        <path d={ROUNDEL_LETTERS.s} style={pop(0.25)} />
        <path d={ROUNDEL_LETTERS.p1} style={pop(0.32)} />
        <path d={ROUNDEL_LETTERS.p2} style={pop(0.39)} />
      </g>
      <path d={ROUNDEL_ARC_TEXT} fill={knock} style={pop(0.5)} />
      {animate && <style>{`@keyframes logo-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}@keyframes logo-pop{to{opacity:1}}`}</style>}
    </svg>
  );
}

type LogoProps = {
  className?: string;
  /** "ink" = light text for dark grounds, "paper" = indigo text for light grounds, "mono" = everything in currentColor */
  tone?: LogoTone;
  title?: string;
  animate?: boolean;
};

/** Horizontal lockup. Height comes from className (h-6, h-9 …); width follows. */
export function Logo({ className, tone = "ink", title = "SPP Sole Co., Ltd", animate = false }: LogoProps) {
  const text = tone === "paper" ? "#0b0e2c" : "currentColor";
  return (
    <svg viewBox="0 0 262 100" role="img" aria-label={title} className={clsx("block h-6 w-auto overflow-visible", tone === "ink" && "text-fog-50", className)}>
      <RoundelG mono={tone === "mono"} animate={animate} />
      <g fill={text} style={animate ? { opacity: 0, animation: "logo-pop .5s ease-out .45s forwards" } : undefined}>
        <text x="118" y="61" fontFamily="var(--font-bricolage), 'Helvetica Neue', Arial, sans-serif" fontWeight="800" fontSize="66" letterSpacing="-2.5">SPP</text>
        <text x="120" y="86" fontFamily="var(--font-jetbrains), Menlo, monospace" fontSize="13.5" letterSpacing="3.2">SOLE CO., LTD</text>
      </g>
      {animate && <style>{`@keyframes logo-pop{to{opacity:1}}`}</style>}
    </svg>
  );
}

/** The roundel as a bare <g> (100 × 100 units) for composing into other drawings. */
export function RoundelG({ mono = false, knock: knockIn, animate = false, transform, opacity }: { mono?: boolean; knock?: string; animate?: boolean; transform?: string; opacity?: number }) {
  const id = useId();
  const ind = `${id}-ind`, sky = `${id}-sky`;
  const knock = mono ? (knockIn ?? "var(--color-ink-950, #0b0e2c)") : C.white;
  return (
    <g transform={transform} opacity={opacity} style={animate ? { animation: "logo-in .5s var(--ease-press, cubic-bezier(.2,.8,.2,1)) both", transformOrigin: "50px 50px" } : undefined}>
      {!mono && (
        <defs>
          <radialGradient id={ind} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor={C.indigo} /><stop offset="1" stopColor={C.indigoDeep} /></radialGradient>
          <linearGradient id={sky} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.skyLight} /><stop offset="1" stopColor={C.sky} /></linearGradient>
        </defs>
      )}
      <circle cx={ROUNDEL.cx} cy={ROUNDEL.cy} r={ROUNDEL.r} fill={mono ? "currentColor" : `url(#${ind})`} />
      {!mono && <path d={ROUNDEL_RIGHT} fill={`url(#${sky})`} />}
      <path d={ROUNDEL_SPLIT} fill="none" stroke={knock} strokeWidth="1.8" strokeLinecap="round" />
      <g fill={mono ? knock : C.gold} stroke={mono ? "none" : C.goldDeep} strokeWidth=".7" strokeLinejoin="round" paintOrder="stroke">
        <path d={ROUNDEL_LETTERS.s} /><path d={ROUNDEL_LETTERS.p1} /><path d={ROUNDEL_LETTERS.p2} />
      </g>
      <path d={ROUNDEL_ARC_TEXT} fill={knock} />
      {animate && <style>{`@keyframes logo-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}`}</style>}
    </g>
  );
}

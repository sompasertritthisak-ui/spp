import { clsx } from "clsx";

/**
 * SPP wordmark — constructed, not typeset.
 * Every curve comes from one r=20 circle module on a 100-unit cap height with a
 * 20-unit stroke. Because it is stroke-based it can be "printed" on screen with
 * a dash-offset animation (see <LogoPrint/>), and it never waits on a webfont.
 * The yellow dot in the final counter is the registration dot: the mark that
 * tells a press operator every plate is aligned.
 */

export const LOGO_VIEWBOX = "0 0 216 100";

export const LOGO_PATHS = {
  s: "M49.3 20 A20 20 0 1 0 32 50 A20 20 0 1 1 14.7 80",
  p1: "M84 0 V100 M84 10 H110 A20 20 0 0 1 110 50 H84",
  p2: "M158 0 V100 M158 10 H184 A20 20 0 0 1 184 50 H158",
} as const;

export const LOGO_DOT = { cx: 184, cy: 30, r: 5.5 } as const;

type LogoProps = {
  className?: string;
  /** "ink" = light strokes for dark grounds, "paper" = dark strokes for light grounds */
  tone?: "ink" | "paper" | "mono";
  title?: string;
  animate?: boolean;
};

export function Logo({ className, tone = "ink", title = "SPP", animate = false }: LogoProps) {
  const stroke = tone === "paper" ? "#0b0e2c" : "currentColor";
  const dot = tone === "mono" ? "currentColor" : "#f5b81f";
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      role="img"
      aria-label={title}
      className={clsx("block h-6 w-auto overflow-visible", tone === "ink" && "text-fog-50", className)}
      fill="none"
    >
      <g stroke={stroke} strokeWidth={20} strokeLinecap="butt" strokeLinejoin="miter">
        {Object.entries(LOGO_PATHS).map(([k, d], i) => (
          <path
            key={k}
            d={d}
            pathLength={1}
            style={
              animate
                ? {
                    strokeDasharray: 1,
                    strokeDashoffset: 1,
                    animation: `logo-print 0.7s cubic-bezier(.65,0,.35,1) ${0.12 * i}s forwards`,
                  }
                : undefined
            }
          />
        ))}
      </g>
      <circle
        {...LOGO_DOT}
        fill={dot}
        style={animate ? { opacity: 0, animation: "logo-dot 0.3s ease-out 0.85s forwards" } : undefined}
      />
      {animate && (
        <style>{`@keyframes logo-print{to{stroke-dashoffset:0}}@keyframes logo-dot{from{opacity:0;transform:scale(.2);transform-origin:184px 30px}to{opacity:1;transform:none;transform-origin:184px 30px}}`}</style>
      )}
    </svg>
  );
}

/** Square app-icon / favicon lockup: the mark on a process-yellow plate with crop marks. */
export function LogoPlate({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" role="img" aria-label="SPP" className={clsx("block", className)}>
      <rect width="128" height="128" fill="#f5b81f" />
      <g transform="translate(18 42) scale(0.426)" stroke="#070920" strokeWidth={20} fill="none">
        <path d={LOGO_PATHS.s} />
        <path d={LOGO_PATHS.p1} />
        <path d={LOGO_PATHS.p2} />
      </g>
      <circle cx={18 + 184 * 0.426} cy={42 + 30 * 0.426} r={2.6} fill="#070920" />
      <g stroke="#070920" strokeWidth="1.5">
        <path d="M6 14H12M14 6V12M122 14H116M114 6V12M6 114H12M14 122V116M122 114H116M114 122V116" />
      </g>
    </svg>
  );
}

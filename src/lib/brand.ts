/**
 * SPP brand colours for code that cannot use CSS tokens (canvas, WebGL, exported
 * PNG/SVG). These MUST mirror the @theme values in src/app/globals.css.
 *   Midnight indigo grounds · gold signature accent · sky blue secondary · cool white.
 */
export const BRAND = {
  ink: "#070920",
  inkRaised: "#0b0e2c",
  inkLine: "#1e2558",
  steel: "#161b45",
  navy: "#1a1a8c", // heritage SPP dark blue
  ultra: "#2326a8",
  violet: "#4b3fd1",
  gold: "#f5b81f",
  goldDeep: "#c9920a",
  sky: "#38b6f2",
  white: "#f5f7fd",
  garmentWhite: "#eef1f8",
  fog: "#9ca3c6",
  fogDim: "#8088b0",
  paperMute: "#545c80",
  cyan: "#00aeef",
  magenta: "#ec008c",
} as const;

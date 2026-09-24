/**
 * Colour-code conversions for Studio's colour entry: HEX ⇄ RGB ⇄ CMYK.
 * CMYK here is the plain device conversion (no ICC profile) — good enough to
 * pick a colour; SPP matches inks on press and the UI says so.
 */
export type Rgb = { r: number; g: number; b: number };
export type Cmyk = { c: number; m: number; y: number; k: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const to2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");

/** Accepts "#abc", "abc", "#aabbcc", "aabbcc", "rgb(1, 2, 3)" or "1, 2, 3"; returns "#rrggbb" or null. */
export function normaliseHex(input: string): string | null {
  const s = input.trim().toLowerCase();
  const short = /^#?([0-9a-f]{3})$/.exec(s);
  if (short) return `#${short[1]!.split("").map((c) => c + c).join("")}`;
  const long = /^#?([0-9a-f]{6})$/.exec(s);
  if (long) return `#${long[1]}`;
  const rgb = /^(?:rgb\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/.exec(s);
  if (rgb) return rgbToHex({ r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]! });
  return null;
}

export function hexToRgb(hex: string): Rgb {
  const h = normaliseHex(hex) ?? "#000000";
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
}

export const rgbToHex = ({ r, g, b }: Rgb) => `#${to2(r)}${to2(g)}${to2(b)}`;

/** Percentages 0–100. */
export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const R = clamp(r, 0, 255) / 255, G = clamp(g, 0, 255) / 255, B = clamp(b, 0, 255) / 255;
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const f = (v: number) => Math.round(((1 - v - k) / (1 - k)) * 100);
  return { c: f(R), m: f(G), y: f(B), k: Math.round(k * 100) };
}

export function cmykToRgb({ c, m, y, k }: Cmyk): Rgb {
  const C = clamp(c, 0, 100) / 100, M = clamp(m, 0, 100) / 100, Y = clamp(y, 0, 100) / 100, K = clamp(k, 0, 100) / 100;
  return { r: Math.round(255 * (1 - C) * (1 - K)), g: Math.round(255 * (1 - M) * (1 - K)), b: Math.round(255 * (1 - Y) * (1 - K)) };
}

export const hexToCmyk = (hex: string) => rgbToCmyk(hexToRgb(hex));
export const cmykToHex = (c: Cmyk) => rgbToHex(cmykToRgb(c));

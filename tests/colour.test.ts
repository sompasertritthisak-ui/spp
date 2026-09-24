import { describe, expect, it } from "vitest";
import { cmykToHex, hexToCmyk, hexToRgb, normaliseHex, rgbToHex } from "../src/lib/studio/colour";

describe("colour entry conversions", () => {
  it("normalises the ways people type a hex code", () => {
    expect(normaliseHex("#F5B81F")).toBe("#f5b81f");
    expect(normaliseHex("f5b81f")).toBe("#f5b81f");
    expect(normaliseHex("#fb1")).toBe("#ffbb11");
    expect(normaliseHex("rgb(245, 184, 31)")).toBe("#f5b81f");
    expect(normaliseHex("245 184 31")).toBe("#f5b81f");
    expect(normaliseHex("gold")).toBeNull();
    expect(normaliseHex("#12345")).toBeNull();
  });
  it("round-trips hex ⇄ rgb", () => {
    expect(hexToRgb("#f5b81f")).toEqual({ r: 245, g: 184, b: 31 });
    expect(rgbToHex({ r: 245, g: 184, b: 31 })).toBe("#f5b81f");
    expect(rgbToHex({ r: 300, g: -5, b: 12.6 })).toBe("#ff000d"); // clamped and rounded
  });
  it("converts to and from CMYK percentages", () => {
    expect(hexToCmyk("#000000")).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(hexToCmyk("#ffffff")).toEqual({ c: 0, m: 0, y: 0, k: 0 });
    expect(hexToCmyk("#f5b81f")).toEqual({ c: 0, m: 25, y: 87, k: 4 });
    expect(cmykToHex({ c: 0, m: 0, y: 0, k: 100 })).toBe("#000000");
    expect(cmykToHex({ c: 100, m: 0, y: 0, k: 0 })).toBe("#00ffff");
    // a CMYK → hex → CMYK trip lands within rounding
    const back = hexToCmyk(cmykToHex({ c: 20, m: 60, y: 0, k: 10 }));
    expect(Math.abs(back.c - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.m - 60)).toBeLessThanOrEqual(1);
    expect(back.y).toBe(0);
    expect(Math.abs(back.k - 10)).toBeLessThanOrEqual(1);
  });
});

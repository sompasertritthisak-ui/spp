import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillNumbers, keyOf, tokenize, validateTranslation, worthTranslating } from "@/lib/i18n/segments";

const dict = JSON.parse(readFileSync(new URL("../src/content/lao/segments.json", import.meta.url), "utf8")) as { segments: Record<string, string>; attrs: Record<string, string> };

describe("whole-page Lao · segment keys", () => {
  it("normalises whitespace and turns numbers into slots, but leaves tag numbers alone", () => {
    const { key, nums } = keyOf("  Up to <1>8 × 8</1>  cm,\n sizes XS to 8XL ");
    expect(key).toBe("Up to <1>{#} × {#}</1> cm, sizes XS to {#}XL");
    expect(nums).toEqual(["8", "8", "8"]);
    expect(keyOf("<12>Plate 03</12><13/>").key).toBe("<12>Plate {#}</12><13/>");
    expect(keyOf("1,250 ₭ at 09:30").nums).toEqual(["1,250", "09:30"]);
  });
  it("puts the numbers back in order", () => {
    expect(fillNumbers("ເຖິງ {#} × {#} ຊມ", ["8", "10"])).toBe("ເຖິງ 8 × 10 ຊມ");
  });
  it("tokenises tags and unescapes text", () => {
    expect(tokenize("a <1>b</1> &lt;c&amp; <2/>")).toEqual([
      { t: "text", v: "a " }, { t: "open", n: 1 }, { t: "text", v: "b" }, { t: "close", n: 1 }, { t: "text", v: " <c& " }, { t: "void", n: 2 },
    ]);
  });
  it("knows what is not worth translating", () => {
    expect(worthTranslating("SPP")).toBe(true);
    expect(worthTranslating("{#} × {#}")).toBe(false);
    expect(worthTranslating("<1/>·<2/>")).toBe(false);
    expect(worthTranslating("A")).toBe(false);
  });
  it("rejects a translation whose tags, nesting or number slots differ, or that is not Lao", () => {
    expect(validateTranslation("See <1>this</1> now", "ເບິ່ງ <1>ອັນນີ້</1> ຕອນນີ້")).toBeNull();
    expect(validateTranslation("See <1>this</1> now", "ເບິ່ງ ອັນນີ້ ຕອນນີ້")).toMatch(/tags differ/);
    expect(validateTranslation("<1>a</1><2>b</2>", "<1><2>ກ</1></2>")).toMatch(/nested/);
    expect(validateTranslation("{#} items", "ລາຍການ")).toMatch(/number slots/);
    expect(validateTranslation("Hello", "Hello")).toMatch(/no Lao/);
  });
});

describe("whole-page Lao · the shipped dictionary", () => {
  it("every entry validates against its key", () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(dict.segments)) { const p = validateTranslation(k, v); if (p) bad.push(`${k} → ${p}`); }
    for (const [k, v] of Object.entries(dict.attrs)) { const p = validateTranslation(k, v); if (p) bad.push(`${k} → ${p}`); }
    expect(bad).toEqual([]);
  });
  it("covers the site: thousands of segments, the brand kept in Latin", () => {
    expect(Object.keys(dict.segments).length).toBeGreaterThan(2400);
    expect(Object.keys(dict.attrs).length).toBeGreaterThan(300);
    for (const [k, v] of Object.entries(dict.segments)) if (/\bSPP\b/.test(k)) expect(v, k).toContain("SPP");
  });
  it("translates the things a customer reads first", () => {
    expect(dict.segments["Request this service"]).toBeTruthy();
    expect(dict.segments["Full front print (up to {#} × {#} cm)"]).toContain("{#} × {#}");
    expect(dict.attrs["Enter a garment colour code (HEX, RGB or CMYK)"]).toBeTruthy();
  });
});

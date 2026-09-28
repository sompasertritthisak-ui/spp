import { describe, expect, it } from "vitest";
import { dictionaries, interpolate, isLang, keyForLiteral, translate, translateLiteral, type Key } from "@/lib/i18n/core";
import { en } from "@/lib/i18n/en";
import { lo } from "@/lib/i18n/lo";

const keys = Object.keys(en) as Key[];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const LAO = /[຀-໿]/;

/* Brand names, product names and pure-format strings are the same in both languages on purpose. */
const SAME_ON_PURPOSE: Key[] = ["lang.en", "lang.lo", "common.whatsapp", "common.mySpp", "connect.titleFeel", "hero.studio", "cons.whatsapp", "portal.commandCenter"];

describe("i18n dictionaries", () => {
  it("has a Lao entry for every English key, and nothing extra", () => {
    expect(Object.keys(lo).sort()).toEqual([...keys].sort());
    for (const k of keys) expect(lo[k].trim(), k).not.toBe("");
  });

  it("keeps the same placeholders in both languages", () => {
    for (const k of keys) expect(placeholders(lo[k]), k).toEqual(placeholders(en[k]));
  });

  it("is written in Lao script, apart from names kept in Latin", () => {
    for (const k of keys) {
      if (SAME_ON_PURPOSE.includes(k)) { expect(lo[k], k).toBe(en[k]); continue; }
      // a string made only of placeholders and punctuation has nothing to translate
      if (!/[A-Za-z]/.test(en[k].replace(/\{\w+\}/g, ""))) continue;
      expect(LAO.test(lo[k]), `${k} → ${lo[k]}`).toBe(true);
    }
  });

  it("keeps the brand in Latin script inside Lao sentences", () => {
    for (const k of keys) if (/\bSPP\b/.test(en[k])) expect(lo[k], k).toContain("SPP");
  });
});

describe("translate", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(interpolate("Use {n}", { n: 12 })).toBe("Use 12");
    expect(interpolate("Use {n} of {m}", { n: 1 })).toBe("Use 1 of {m}");
    expect(translate("en", "des.copySaved", { ref: "SPP-DESIGN-2026-00001" })).toBe("Copy saved as SPP-DESIGN-2026-00001.");
    expect(translate("lo", "des.copySaved", { ref: "SPP-DESIGN-2026-00001" })).toContain("SPP-DESIGN-2026-00001");
  });

  it("serves both languages and rejects anything else", () => {
    expect(Object.keys(dictionaries).sort()).toEqual(["en", "lo"]);
    expect(isLang("lo")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(null)).toBe(false);
  });

  it("translates the known English literals pages hand to shared chrome", () => {
    expect(keyForLiteral("Request a quote")).toBe("common.requestQuote");
    expect(keyForLiteral("Let’s talk")).toBe("common.letsTalk");
    expect(keyForLiteral("Let's talk")).toBe("common.letsTalk");
    expect(translateLiteral("lo", "Request a quote")).toBe(lo["common.requestQuote"]);
    expect(translateLiteral("en", "Request a quote")).toBe("Request a quote");
    // authored content is never machine-translated
    expect(translateLiteral("lo", "Polo shirts for a new hotel")).toBe("Polo shirts for a new hotel");
  });
});

describe("SPP does not run promotions", () => {
  it("asks for consent to news only — never offers, deals or promotions", () => {
    for (const k of keys.filter((x) => x.startsWith("form.consent"))) expect(en[k], k).not.toMatch(/offer|deal|promotion|discount/i);
  });
});

describe("the design question sent to SPP", () => {
  it("carries the design reference and product in both languages", () => {
    for (const lang of ["en", "lo"] as const) {
      const msg = translate(lang, "des.askMessage", { ref: "SPP-DESIGN-2026-00427", product: "Polo Shirt" });
      expect(msg).toContain("SPP-DESIGN-2026-00427");
      expect(msg).toContain("Polo Shirt");
    }
  });
});

import { describe, expect, it } from "vitest";
import { PRINT_STYLES } from "@/components/hero/prints";
import { HOME_DEFAULTS } from "@/components/home/defaults";
import { seed } from "@/content/seed";
import { defaultHome, HOME_SECTION_ORDER } from "@/content/seed/home";
import type { HomeConfig } from "@/content/types";
import { HOME_LIMITS, isHomeHref, parseHome, plateNumbers, validateHome } from "@/lib/home";
import { pickBilingual } from "@/lib/i18n/core";

const keys = (c: HomeConfig) => c.sections.map((s) => s.key);
const section = (c: HomeConfig, key: string) => c.sections.find((s) => s.key === key)!;

describe("home page defaults", () => {
  it("is the page as designed: every section, in order, visible, with no wording of its own", () => {
    const d = defaultHome();
    expect(keys(d)).toEqual([...HOME_SECTION_ORDER]);
    expect(d.sections.every((s) => s.visible)).toBe(true);
    for (const s of d.sections) for (const f of ["eyebrow", "title", "lede", "body"] as const) expect(s[f], `${s.key}.${f}`).toEqual({ en: "", lo: "" });
    expect(d.hero.word).toBe("SPP");
    expect(d.hero.styles).toEqual([]);
    expect(d.announcement.visible).toBe(false);
    expect(d.seo).toEqual({ title: { en: "" }, description: { en: "" } });
    // new sections stay invisible until staff fill them
    expect(section(d, "featured").products).toEqual([]);
  });

  it("is what the seed ships and survives its own parser unchanged", () => {
    expect(seed.home).toEqual(defaultHome());
    expect(parseHome(defaultHome())).toEqual(defaultHome());
    expect(parseHome(JSON.parse(JSON.stringify(seed.home)))).toEqual(seed.home);
  });

  it("hands out a fresh object each time", () => {
    const a = defaultHome();
    a.sections[0]!.title.en = "changed";
    a.hero.styles.push("Stencil");
    expect(defaultHome().sections[0]!.title.en).toBe("");
    expect(defaultHome().hero.styles).toEqual([]);
  });

  it("keeps the site's own wording free of invented figures", () => {
    const all = JSON.stringify(HOME_DEFAULTS);
    expect(all).not.toMatch(/\d+\s?%|\baward|\b#1\b|\bbest in\b/i);
  });
});

describe("parseHome — bad input never breaks the build", () => {
  it("falls back to the defaults for anything that is not an object", () => {
    for (const bad of [undefined, null, "", "home", 42, true, [], [1, 2], () => 1]) expect(parseHome(bad), String(bad)).toEqual(defaultHome());
    expect(parseHome({})).toEqual(defaultHome());
  });

  it("repairs one bad field without discarding the rest", () => {
    const c = parseHome({
      hero: { word: 99, styles: "all", eyebrow: "not an object", lede: { en: "Made in Vientiane", lo: 7 }, primaryCta: { label: { en: "Go" }, href: "javascript:alert(1)" }, secondaryCta: null },
      announcement: { visible: "yes", text: { en: "Closed on Friday" }, tone: "pink", href: "ftp://x" },
      seo: { title: "string", description: { en: "A description" } },
      sections: "nope",
    });
    expect(c.hero.word).toBe("SPP");
    expect(c.hero.styles).toEqual([]);
    expect(c.hero.eyebrow).toEqual({ en: "", lo: "" });
    expect(c.hero.lede).toEqual({ en: "Made in Vientiane", lo: "" });
    expect(c.hero.primaryCta).toEqual({ label: { en: "Go", lo: "" }, href: "" });
    expect(c.hero.secondaryCta).toEqual({ label: { en: "", lo: "" }, href: "/services/" });
    expect(c.announcement).toEqual({ visible: false, text: { en: "Closed on Friday", lo: "" }, href: "", tone: "gold" });
    expect(c.seo).toEqual({ title: { en: "" }, description: { en: "A description" } });
    expect(keys(c)).toEqual([...HOME_SECTION_ORDER]);
  });

  it("never shows an announcement bar with nothing to say", () => {
    expect(parseHome({ announcement: { visible: true, text: { en: "  ", lo: "" } } }).announcement.visible).toBe(false);
    expect(parseHome({ announcement: { visible: true, text: { en: "", lo: "ປິດວັນສຸກ" } } }).announcement.visible).toBe(true);
  });

  it("ignores unknown section keys, duplicates and junk rows", () => {
    const c = parseHome({ sections: [
      { key: "cta", visible: true },
      { key: "carousel", visible: true, title: { en: "Not a section" } },
      null, 7, "faq", { visible: true },
      { key: "faq", visible: false, faqLimit: 3 },
      { key: "faq", visible: true, faqLimit: 9 },
      { key: "manifesto", visible: true },
    ] });
    expect(keys(c)).not.toContain("carousel");
    expect(new Set(keys(c)).size).toBe(HOME_SECTION_ORDER.length);
    expect([...keys(c)].sort()).toEqual([...HOME_SECTION_ORDER].sort());
    // the first of two duplicates wins
    expect(section(c, "faq")).toMatchObject({ visible: false, faqLimit: 3 });
  });

  it("keeps the order staff chose and puts sections it has never heard of back in their designed place", () => {
    const c = parseHome({ sections: [{ key: "faq" }, { key: "manifesto" }, { key: "cta" }] });
    const k = keys(c);
    expect(k.indexOf("faq")).toBeLessThan(k.indexOf("manifesto"));
    expect(k.indexOf("manifesto")).toBeLessThan(k.indexOf("cta"));
    expect(k.at(-1)).toBe("cta");
    // plates … capabilities follow the manifesto, as designed
    expect(k.slice(k.indexOf("manifesto"), k.indexOf("manifesto") + 3)).toEqual(["manifesto", "plates", "goals"]);
    expect(k).toHaveLength(HOME_SECTION_ORDER.length);
  });

  it("fills in a section saved by an older version of the editor", () => {
    const s = section(parseHome({ sections: [{ key: "cta", visible: false }] }), "cta");
    expect(s.visible).toBe(false);
    expect(s.primary.href).toBe("/request-quote/");
    expect(s.secondary.href).toBe("/consultation/");
    expect(s.faqLimit).toBe(5);
  });

  it("cuts over-long text to its limit instead of rejecting the page", () => {
    const long = "x".repeat(2000);
    const c = parseHome({
      hero: { word: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123", eyebrow: { en: long, lo: long }, line1: { en: long }, lede: { en: long }, primaryCta: { label: { en: long }, href: "/products/" } },
      announcement: { visible: true, text: { en: long, lo: "" } },
      seo: { title: { en: long }, description: { en: long } },
      sections: [{ key: "goals", eyebrow: { en: long }, title: { en: long, lo: long }, lede: { en: long }, body: { en: long } }],
    });
    expect(c.hero.word).toBe("ABCDEFGHIJKLMNOPQRSTUV");
    expect(c.hero.word).toHaveLength(HOME_LIMITS.word);
    expect(c.hero.eyebrow.en).toHaveLength(HOME_LIMITS.eyebrow);
    expect(c.hero.eyebrow.lo).toHaveLength(HOME_LIMITS.eyebrow);
    expect(c.hero.line1.en).toHaveLength(HOME_LIMITS.label);
    expect(c.hero.lede.en).toHaveLength(HOME_LIMITS.lede);
    expect(c.hero.primaryCta.label.en).toHaveLength(HOME_LIMITS.label);
    expect(c.announcement.text.en).toHaveLength(HOME_LIMITS.announcement);
    expect(c.seo.title.en).toHaveLength(HOME_LIMITS.seoTitle);
    expect(c.seo.description.en).toHaveLength(HOME_LIMITS.seoDescription);
    const g = section(c, "goals");
    expect([g.eyebrow.en.length, g.title.en.length, g.title.lo.length, g.lede.en.length, g.body.en.length]).toEqual([HOME_LIMITS.eyebrow, HOME_LIMITS.title, HOME_LIMITS.title, HOME_LIMITS.lede, HOME_LIMITS.body]);
  });

  it("trims text and turns a blank hero word back into SPP", () => {
    const c = parseHome({ hero: { word: "   ", eyebrow: { en: "  Vientiane  ", lo: " ວຽງຈັນ " } } });
    expect(c.hero.word).toBe("SPP");
    expect(c.hero.eyebrow).toEqual({ en: "Vientiane", lo: "ວຽງຈັນ" });
  });

  it("keeps only print styles that exist, without repeats", () => {
    const real = PRINT_STYLES.map((s) => s.name);
    expect(parseHome({ hero: { styles: ["Stencil", "Comic Sans", "Stencil", 4, "Lao"] } }).hero.styles).toEqual(["Stencil", "Lao"]);
    expect(parseHome({ hero: { styles: real } }).hero.styles).toEqual(real);
  });

  it("caps the pickers: 12 products, 6 projects, 12 questions — slugs and ids only", () => {
    const many = Array.from({ length: 40 }, (_, i) => `product-${i}`);
    const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const c = parseHome({ sections: [
      { key: "featured", products: [...many.slice(0, 3), many[0], "Not A Slug", "../etc", 12, ...many.slice(3)] },
      { key: "work", projects: many },
      { key: "capabilities", categories: ["apparel", "apparel", "signage", "<script>"] },
      { key: "faq", faqIds: ["not-a-uuid", ...Array.from({ length: 20 }, (_, i) => id(i))], faqLimit: 99 },
    ] });
    expect(section(c, "featured").products).toEqual(many.slice(0, HOME_LIMITS.products));
    expect(section(c, "work").projects).toHaveLength(HOME_LIMITS.projects);
    expect(section(c, "capabilities").categories).toEqual(["apparel", "signage"]);
    expect(section(c, "faq").faqIds).toHaveLength(HOME_LIMITS.faqs);
    expect(section(c, "faq").faqIds[0]).toBe(id(0));
    expect(section(c, "faq").faqLimit).toBe(5);
    expect(section(parseHome({ sections: [{ key: "faq", faqLimit: 2.5 }] }), "faq").faqLimit).toBe(5);
    expect(section(parseHome({ sections: [{ key: "faq", faqLimit: 8 }] }), "faq").faqLimit).toBe(8);
  });

  it("accepts site paths and https addresses as links, and nothing else", () => {
    for (const good of ["/", "/products/", "/solutions/?goal=launch", "/products/polo-shirt/", "https://www.facebook.com/spp", "https://wa.me/8562055518882"]) expect(isHomeHref(good), good).toBe(true);
    for (const bad of ["", "products/", "//evil.example", "http://plain.example", "javascript:alert(1)", "mailto:a@b.c", "/with space/", "https://", `/${"a".repeat(400)}`]) expect(isHomeHref(bad), bad).toBe(false);
    const c = parseHome({ sections: [{ key: "cta", primary: { href: "//evil.example" }, secondary: { href: "https://example.com/next" } }] });
    expect(section(c, "cta").primary.href).toBe("");
    expect(section(c, "cta").secondary.href).toBe("https://example.com/next");
  });

  it("drops fields it does not know", () => {
    const c = parseHome({ theme: "neon", hero: { word: "SPP", colour: "red" }, sections: [{ key: "goals", html: "<b>x</b>" }] });
    expect(c).not.toHaveProperty("theme");
    expect(c.hero).not.toHaveProperty("colour");
    expect(section(c, "goals")).not.toHaveProperty("html");
  });
});

describe("validateHome — what the editor refuses to save", () => {
  it("passes the defaults and a typical edit", () => {
    expect(validateHome(defaultHome())).toEqual({});
    const c = defaultHome();
    c.hero.word = "SABAIDEE";
    c.announcement = { visible: true, text: { en: "Closed for Lao New Year, 14–16 April", lo: "" }, href: "/contact/", tone: "navy" };
    section(c, "featured").products = ["custom-t-shirt", "polo-shirt"];
    expect(validateHome(c)).toEqual({});
  });

  it("names the field that is wrong", () => {
    const c = defaultHome();
    c.hero.word = "";
    c.hero.primaryCta.href = "";
    c.hero.secondaryCta.href = "www.example.com";
    c.hero.styles = ["Wingdings"];
    c.announcement = { visible: true, text: { en: "", lo: "" }, href: "javascript:void(0)", tone: "gold" };
    section(c, "goals").title.lo = "ກ".repeat(HOME_LIMITS.title + 1);
    section(c, "cta").primary.href = "";
    section(c, "faq").faqLimit = 0;
    c.seo.title.en = "t".repeat(HOME_LIMITS.seoTitle + 1);
    expect(Object.keys(validateHome(c)).sort()).toEqual(["announcement.href", "announcement.text.en", "hero.primaryCta.href", "hero.secondaryCta.href", "hero.styles", "hero.word", "sections.cta.primary.href", "sections.faq.faqLimit", "sections.goals.title.lo", "seo.title.en"]);
  });

  it("allows the second button to be removed", () => {
    const c = defaultHome();
    c.hero.secondaryCta.href = "";
    section(c, "cta").secondary.href = "";
    expect(validateHome(c)).toEqual({});
  });
});

describe("pickBilingual", () => {
  it("shows Lao to a Lao reader only when Lao was written", () => {
    expect(pickBilingual({ en: "Hello", lo: "ສະບາຍດີ" }, "lo")).toEqual({ text: "ສະບາຍດີ", lang: "lo" });
    expect(pickBilingual({ en: "Hello", lo: "" }, "lo")).toEqual({ text: "Hello", lang: "en" });
    expect(pickBilingual({ en: "Hello", lo: "   " }, "lo")).toEqual({ text: "Hello", lang: "en" });
    expect(pickBilingual({ en: "Hello", lo: "ສະບາຍດີ" }, "en")).toEqual({ text: "Hello", lang: "en" });
  });

  it("returns nothing when there is no override, so the default is used", () => {
    expect(pickBilingual({ en: "", lo: "" }, "lo")).toBeNull();
    expect(pickBilingual({ en: "", lo: "ສະບາຍດີ" }, "en")).toBeNull();
    expect(pickBilingual(undefined, "en")).toBeNull();
    expect(pickBilingual(null, "lo")).toBeNull();
  });
});

describe("plate numbers", () => {
  const designedShown = HOME_SECTION_ORDER.filter((k) => !["featured", "testimonials", "blocks"].includes(k));

  it("keeps the designed numbers on the designed page", () => {
    expect(plateNumbers(defaultHome().sections, designedShown)).toMatchObject({ manifesto: "01", plates: "02", goals: "03", studio: "04", outdoor: "05", capabilities: "06", work: "07", faq: "09", connect: "09" });
  });

  it("counts up in page order once a section is added, hidden or moved", () => {
    const withFeatured = [...designedShown.slice(0, 6), "featured" as const, ...designedShown.slice(6)];
    expect(plateNumbers(defaultHome().sections, withFeatured)).toMatchObject({ capabilities: "06", featured: "07", work: "08", faq: "09", connect: "10" });

    const hidden = defaultHome();
    section(hidden, "plates").visible = false;
    const shown = designedShown.filter((k) => k !== "plates");
    expect(plateNumbers(hidden.sections, shown)).toMatchObject({ manifesto: "01", goals: "02", studio: "03" });
    expect(plateNumbers(hidden.sections, shown)).not.toHaveProperty("plates");

    const moved = defaultHome();
    moved.sections.unshift(...moved.sections.splice(moved.sections.findIndex((s) => s.key === "faq"), 1));
    const order = moved.sections.map((s) => s.key).filter((k) => designedShown.includes(k));
    expect(plateNumbers(moved.sections, order)).toMatchObject({ faq: "01", manifesto: "02", plates: "03", connect: "09" });
    // free-form blocks and the closing band carry no plate
    expect(plateNumbers(moved.sections, [...order, "blocks"])).not.toHaveProperty("blocks");
    expect(plateNumbers(moved.sections, order)).not.toHaveProperty("cta");
  });
});

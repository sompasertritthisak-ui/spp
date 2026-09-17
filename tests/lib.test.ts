import { describe, expect, it } from "vitest";
import { seed } from "@/content/seed";
import { formatLak, formatLakShort, plural, titleCase } from "@/lib/format";
import { whatsappHref, whatsappMessage } from "@/lib/whatsapp";

describe("whatsapp deep links", () => {
  it("returns null when SPP has not configured a number (UI must hide the channel)", () => {
    expect(whatsappHref("", { kind: "general" })).toBeNull();
    expect(whatsappHref("12", { kind: "general" })).toBeNull();
  });
  it("writes the contextual message from the brief", () => {
    const msg = whatsappMessage({ kind: "design", product: "polo shirts", designRef: "SPP-DESIGN-2026-00427", qty: 150, sides: ["Front", "back"], neededBy: "2026-11-15" });
    expect(msg).toContain("150 custom polo shirts");
    expect(msg).toContain("Design ID: SPP-DESIGN-2026-00427.");
    expect(msg).toContain("Front + back printing.");
    expect(msg).toContain("15 November");
    const href = whatsappHref("+856 20 5555 0101", { kind: "quote", quoteRef: "SPP-QUOTE-2026-00001" })!;
    expect(href.startsWith("https://wa.me/8562055550101?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("SPP-QUOTE-2026-00001");
  });
});

describe("format", () => {
  it("formats kip and labels", () => {
    expect(formatLak(55000)).toBe("55,000 ₭");
    expect(formatLak(null)).toBe("—");
    expect(formatLakShort(27_500_000)).toBe("28M ₭");
    expect(titleCase("quality_control")).toBe("Quality Control");
    expect(plural(1, "piece")).toBe("1 piece");
    expect(plural(1200, "piece")).toBe("1,200 pieces");
  });
});

describe("seed content integrity (what the site builds from before a database exists)", () => {
  const slugs = new Set(seed.products.map((p) => p.slug));
  it("has unique slugs and valid cross-references", () => {
    expect(slugs.size).toBe(seed.products.length);
    const cats = new Set(seed.categories.map((c) => c.slug));
    for (const p of seed.products) { expect(cats.has(p.category), `${p.slug} → ${p.category}`).toBe(true); for (const r of p.related) expect(slugs.has(r), `${p.slug} related ${r}`).toBe(true); }
    for (const b of seed.bundles) for (const i of b.items) expect(slugs.has(i.product), `${b.slug} → ${i.product}`).toBe(true);
    for (const s of seed.solutions) { for (const g of s.recommend) for (const i of g.items) if (i.product) expect(slugs.has(i.product), `${s.slug} → ${i.product}`).toBe(true); if (s.bundle) expect(seed.bundles.some((b) => b.slug === s.bundle)).toBe(true); }
    for (const s of seed.services) for (const p of s.products) expect(slugs.has(p)).toBe(true);
  });
  it("never publishes a price for quote-only products", () => { for (const p of seed.products) if (p.pricingMode === "quote") expect(p.priceFromLak, p.slug).toBeNull(); });
  it("honesty rules: no invented phone numbers or testimonials; samples are flagged; billboards inside Laos", () => {
    expect(seed.settings.phone).toBe("");
    expect(seed.settings.whatsapp).toBe("");
    expect(seed.testimonials).toHaveLength(0);
    for (const p of seed.portfolio) expect(p.isSample).toBe(true);
    for (const b of seed.billboards) { expect(b.lat).toBeGreaterThan(13.9); expect(b.lat).toBeLessThan(22.6); expect(b.lng).toBeGreaterThan(100); expect(b.lng).toBeLessThan(107.8); expect(b.traffic).toBeNull(); expect(b.verified).toBe(false); }
    expect(new Set(seed.billboards.map((b) => b.code)).size).toBe(seed.billboards.length);
  });
});

import { describe, expect, it } from "vitest";
import { seed } from "@/content/seed";
import { GARMENTS, getSide, isDark, toSvgPath } from "@/lib/garments";
import { brandHints, contrast, runPreflight } from "@/lib/studio/preflight";
import { designDocSchema, layerSchema, normaliseLayers, normaliseSides, usedSides, type Layer } from "@/lib/studio/schema";
import { GRAPHICS, shapePath } from "@/lib/studio/shapes";
import { initialState, reducer } from "@/lib/studio/store";

const text = (over: Partial<Extract<Layer, { type: "text" }>> = {}): Layer => ({ id: "t1", type: "text", text: "HELLO", font: "display", weight: 800, size: 120, fill: "#ffffff", x: 500, y: 400, angle: 0, opacity: 1, tracking: 0, align: "center", ...over });
const doc = () => designDocSchema.parse({ productSlug: "custom-t-shirt", garment: "tee", colour: "#17171a", sides: {} });
const tee = seed.products.find((p) => p.slug === "custom-t-shirt")!;

describe("design schema", () => {
  it("rejects hostile or malformed layers instead of rendering them", () => {
    expect(layerSchema.safeParse({ ...text(), fill: "url(javascript:alert(1))" }).success).toBe(false);
    expect(layerSchema.safeParse({ ...text(), text: "x".repeat(500) }).success).toBe(false);
    expect(layerSchema.safeParse({ id: "i", type: "image", mime: "text/html", w: 10, h: 10, naturalW: 10, naturalH: 10, x: 0, y: 0 }).success).toBe(false);
    expect(normaliseLayers([{ type: "script", src: "x" }, null, 42, { type: "text", text: "ok", size: 50, fill: "#000000", x: 1, y: 1 }])).toHaveLength(1);
  });
  it("every seeded template is valid for every garment it claims", () => {
    for (const t of seed.templates) {
      const sides = normaliseSides(t.sides);
      const raw = Object.values(t.sides).flat().length, ok = Object.values(sides).flat().length;
      expect(ok, `${t.slug} has invalid layers`).toBe(raw);
      expect(usedSides(sides).length).toBeGreaterThan(0);
      for (const g of t.garments) expect(GARMENTS[g], `${t.slug} → ${g}`).toBeDefined();
    }
  });
  it("every studio product maps to real garment geometry with matching print areas", () => {
    for (const p of seed.products.filter((x) => x.studio)) {
      for (const a of p.studio!.areas) {
        const side = getSide(p.studio!.garment, a.key);
        expect(side.key, `${p.slug} area ${a.key}`).toBe(a.key);
        // on-screen print area must have the same proportions as the physical one (±12%)
        expect(Math.abs(side.area.h / side.area.w - a.heightMm / a.widthMm) / (a.heightMm / a.widthMm)).toBeLessThan(0.12);
      }
    }
  });
});

describe("geometry", () => {
  it("garment outlines and shapes produce closed, finite SVG paths", () => {
    for (const g of Object.values(GARMENTS)) for (const s of g.sides) { const d = toSvgPath(s.body); expect(d.startsWith("M")).toBe(true); expect(d.endsWith("Z")).toBe(true); expect(d).not.toMatch(/NaN|undefined/); }
    for (const s of ["rect", "circle", "ring", "triangle", "star", "burst", "shield", "badge", "line"] as const) expect(shapePath(s, 200, 100)).not.toMatch(/NaN|undefined/);
    for (const [k, g] of Object.entries(GRAPHICS)) expect(g.d, k).toMatch(/^M[-\d]/);
  });
  it("isDark picks the right ink", () => { expect(isDark("#17171a")).toBe(true); expect(isDark("#f5f5f2")).toBe(false); });
});

describe("editor store", () => {
  it("undo/redo restores exactly, and a drag is one undo step", () => {
    let s = initialState(doc(), "front");
    s = reducer(s, { type: "add", layer: text() });
    s = reducer(s, { type: "checkpoint" });
    for (let i = 1; i <= 20; i++) s = reducer(s, { type: "update", id: "t1", patch: { x: 500 + i }, transient: true });
    expect(s.doc.sides.front![0]!.x).toBe(520);
    s = reducer(s, { type: "undo" });
    expect(s.doc.sides.front![0]!.x).toBe(500);
    s = reducer(s, { type: "undo" });
    expect(s.doc.sides.front ?? []).toHaveLength(0);
    s = reducer(s, { type: "redo" }); s = reducer(s, { type: "redo" });
    expect(s.doc.sides.front![0]!.x).toBe(520);
  });
  it("front and back are independent; switching product keeps artwork", () => {
    let s = initialState(doc(), "front");
    s = reducer(s, { type: "add", layer: text() });
    s = reducer(s, { type: "setSide", side: "back" });
    s = reducer(s, { type: "add", layer: text({ id: "t2", text: "BACK" }) });
    expect(usedSides(s.doc.sides).sort()).toEqual(["back", "front"]);
    s = reducer(s, { type: "setProduct", productSlug: "polo-shirt", garment: "polo", sideKeys: ["front", "back"] });
    expect(s.doc.sides.front).toHaveLength(1);
  });
  it("duplicate, reorder, remove and the 60-layer cap", () => {
    let s = reducer(initialState(doc(), "front"), { type: "add", layer: text() });
    s = reducer(s, { type: "duplicate", id: "t1" });
    const copy = s.doc.sides.front![1]!;
    expect(copy.id).not.toBe("t1");
    s = reducer(s, { type: "reorder", id: "t1", to: "top" });
    expect(s.doc.sides.front!.at(-1)!.id).toBe("t1");
    s = reducer(s, { type: "remove", id: copy.id });
    expect(s.doc.sides.front).toHaveLength(1);
    s = reducer(s, { type: "addMany", layers: Array.from({ length: 80 }, (_, i) => text({ id: `x${i}` })) });
    expect(s.doc.sides.front!.length).toBeLessThanOrEqual(60);
  });
  it("saving keeps undo history", () => {
    let s = reducer(initialState(doc(), "front"), { type: "add", layer: text() });
    s = reducer(s, { type: "saved", remote: { id: "1", ref: "SPP-DESIGN-2026-00001", version: 1, status: "saved" } });
    expect(s.dirty).toBe(false);
    expect(s.past).toHaveLength(1);
  });
});

describe("artwork preflight (advisory)", () => {
  const run = (layers: Layer[], colour = "#17171a") => runPreflight({ sides: { front: layers }, colour, areas: tee.studio!.areas, assetMeta: () => undefined });
  const image = (naturalW: number, w: number): Layer => ({ id: "i1", type: "image", name: "logo.png", mime: "image/png", w, h: w, naturalW, naturalH: naturalW, x: 500, y: 500, angle: 0, opacity: 1 });
  it("clean artwork is READY FOR REVIEW", () => expect(run([text()]).verdict).toBe("ready"));
  it("a 200px logo printed 27cm wide is NOT PRODUCTION READY; a 3000px one is fine", () => {
    expect(run([image(200, 900)]).verdict).toBe("blocked");
    expect(run([image(3000, 600)]).checks.find((c) => c.id.startsWith("res-"))!.level).toBe("ok");
  });
  it("flags tiny text, invisible ink, safe-zone and off-area artwork", () => {
    expect(run([text({ size: 8 })]).verdict).toBe("blocked");
    expect(run([text({ fill: "#1a1a1d" })]).checks.some((c) => c.id.startsWith("contrast-"))).toBe(true);
    expect(run([text({ x: 60 })]).checks.some((c) => /safe|crop/.test(c.id))).toBe(true);
    expect(run([text({ x: 5000 })]).verdict).toBe("blocked");
  });
  it("hidden layers are ignored; empty design is not an error", () => {
    expect(run([text({ size: 8, hidden: true })]).verdict).toBe("ready");
    expect(run([]).checks[0]!.id).toBe("empty");
  });
  it("contrast maths and brand hints (hint only when far from the palette; neutrals never flagged)", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    const palette = [{ name: "Gold", hex: "#f5b81f" }];
    expect(brandHints({ front: [text({ fill: "#f5b920" })] }, palette)).toHaveLength(0);
    expect(brandHints({ front: [text({ fill: "#ffffff" })] }, palette)).toHaveLength(0);
    const hint = brandHints({ front: [text({ fill: "#d4302b" })] }, palette);
    expect(hint).toHaveLength(1);
    expect(hint[0]!.detail).toMatch(/hint only/);
  });
});

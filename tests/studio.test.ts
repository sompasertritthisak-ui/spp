import { describe, expect, it } from "vitest";
import { seed } from "@/content/seed";
import { facesOf, GARMENTS, getSide, isDark, isProfile, regionsOf, toSvgPath, viewsOf } from "@/lib/garments";
import { brandHints, contrast, runPreflight } from "@/lib/studio/preflight";
import { designDocSchema, layerSchema, normaliseLayers, normaliseSides, remapSides, usedSides, type Layer } from "@/lib/studio/schema";
import { GRAPHICS, shapePath } from "@/lib/studio/shapes";
import { initialState, reducer } from "@/lib/studio/store";

const text = (over: Partial<Extract<Layer, { type: "text" }>> = {}): Layer => ({ id: "t1", type: "text", text: "HELLO", font: "display", weight: 800, size: 120, fill: "#ffffff", x: 500, y: 400, angle: 0, opacity: 1, tracking: 0, align: "center", ...over });
const doc = () => designDocSchema.parse({ productSlug: "custom-t-shirt", garment: "tee", colour: "#17171a", sides: {} });
const tee = seed.products.find((p) => p.slug === "custom-t-shirt")!;
const chest = "left-chest"; // the small logo placement, where the size cap bites first

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
        // free-flow is a property of the area AND its geometry, so every renderer clips the same way
        expect(Boolean(side.freeFlow), `${p.slug} ${a.key} freeFlow`).toBe(Boolean(a.freeFlow));
      }
    }
  });
  it("legacy 'front' artwork moves to the chest on cotton products, and back again", () => {
    const sides = { front: [text()], back: [text({ id: "b" })] };
    const cotton = remapSides(sides, ["left-chest", "right-chest", "back"]);
    expect(Object.keys(cotton).sort()).toEqual(["back", "left-chest"]);
    expect(cotton["left-chest"]![0]!.id).toBe("t1");
    expect(remapSides(cotton, ["front", "back"]).front).toHaveLength(1);
    // a product that still has "front" (sports fabric, tote) is left exactly as it was
    expect(remapSides(sides, ["front", "back"])).toEqual(sides);
  });
});

describe("fabric rules (client requirements)", () => {
  const shirts = seed.products.filter((p) => p.studio && ["tee", "sports-tee", "polo", "sleeveless"].includes(p.studio.garment));
  it("every product declares a fabric; shirts run to 8XL", () => {
    for (const p of seed.products) expect(["cotton", "sports", "canvas", "other"], p.slug).toContain(p.fabric);
    for (const p of shirts) { expect(p.sizes.at(-1), p.slug).toBe("8XL"); expect(p.sizes[0], p.slug).toBe("XS"); }
    expect(seed.products.filter((p) => p.fabric === "cotton").length).toBeGreaterThanOrEqual(2);
    expect(seed.products.filter((p) => p.fabric === "sports" && p.studio).length).toBeGreaterThanOrEqual(2);
  });
  it("cotton: full front and back, chest logos, upper back and both sleeves — each capped, nothing free-flow", () => {
    for (const p of seed.products.filter((x) => x.fabric === "cotton" && x.studio)) {
      const areas = p.studio!.areas;
      const keys = areas.map((a) => a.key);
      for (const k of ["front", "left-chest", "right-chest", "back", "upper-back", "left-sleeve", "right-sleeve"]) expect(keys, p.slug).toContain(k);
      for (const a of areas) {
        expect(a.freeFlow ?? false, `${p.slug} ${a.key}`).toBe(false);
        if (a.key.includes("chest")) { expect(a.widthMm).toBeLessThanOrEqual(80); expect(a.heightMm).toBeLessThanOrEqual(80); }
        if (a.key === "front" || a.key === "back") { expect(a.widthMm).toBeLessThanOrEqual(300); expect(a.heightMm).toBeLessThanOrEqual(400); expect(a.widthMm).toBeGreaterThanOrEqual(250); }
        if (a.key === "upper-back") { expect(a.widthMm).toBeLessThanOrEqual(250); expect(a.heightMm).toBeLessThanOrEqual(100); }
        if (a.key.includes("sleeve")) { expect(a.widthMm).toBeLessThanOrEqual(100); expect(a.heightMm).toBeLessThanOrEqual(100); }
      }
    }
    // the T-shirt opens on its biggest canvas
    expect(tee.studio!.areas[0]!.key).toBe("front");
  });
  it("every print area a product offers is drawn on its garment, in the same proportions and inside the outline", () => {
    for (const p of seed.products.filter((x) => x.studio)) {
      for (const a of p.studio!.areas) {
        const side = getSide(p.studio!.garment, a.key);
        // getSide falls back to the first side for an unknown key, which would silently draw the wrong view
        expect(side.key, `${p.slug} ${a.key}`).toBe(a.key);
        if (a.freeFlow) continue;
        expect(Math.abs(side.area.h / side.area.w - a.heightMm / a.widthMm), `${p.slug} ${a.key} aspect`).toBeLessThan(0.03);
        const xs = side.body.flatMap((c) => (c[0] === "Z" ? [] : c.slice(1).filter((_, i) => i % 2 === 0) as number[]));
        const ys = side.body.flatMap((c) => (c[0] === "Z" ? [] : c.slice(1).filter((_, i) => i % 2 === 1) as number[]));
        expect(side.area.x, `${p.slug} ${a.key}`).toBeGreaterThan(Math.min(...xs));
        expect(side.area.x + side.area.w, `${p.slug} ${a.key}`).toBeLessThan(Math.max(...xs));
        expect(side.area.y, `${p.slug} ${a.key}`).toBeGreaterThan(Math.min(...ys));
        expect(side.area.y + side.area.h, `${p.slug} ${a.key}`).toBeLessThan(Math.max(...ys));
      }
    }
  });
  it("a sleeve is the shirt seen from the side: the sleeve in front, the torso behind, right mirroring left", () => {
    for (const g of ["tee", "polo", "sports-tee"] as const) {
      const l = getSide(g, "left-sleeve"), r = getSide(g, "right-sleeve");
      expect(l.key).toBe("left-sleeve");
      expect(l.backdrop?.length, g).toBeGreaterThan(0);
      expect(l.area.x + l.area.w / 2 + (r.area.x + r.area.w / 2)).toBeCloseTo(1000, 5);
      expect(toSvgPath(l.body)).not.toBe(toSvgPath(r.body));
      expect(isProfile(l.key)).toBe(true);
      // profiles are extra views, never one of the main mockup faces
      expect(facesOf(g).map((s) => s.key)).toEqual(["front", "back"]);
    }
    expect(facesOf("cap").map((s) => s.key)).toEqual(["panel", "back"]);
    expect(viewsOf("tee").map((s) => s.key)).toEqual(["front", "back", "left-sleeve", "right-sleeve"]);
    expect(regionsOf("tee", "back").map((s) => s.key).sort()).toEqual(["back", "upper-back"]);
  });
  it("sports fabric: every area is free-flow and the printable region is the whole garment outline", () => {
    for (const p of seed.products.filter((x) => x.fabric === "sports" && x.studio)) {
      for (const a of p.studio!.areas) {
        expect(a.freeFlow, `${p.slug} ${a.key}`).toBe(true);
        const side = getSide(p.studio!.garment, a.key);
        // the region is the body's bounding box: nothing of the garment lies outside it (curve control points may overshoot a little)
        const xs = side.body.flatMap((c) => (c[0] === "Z" ? [] : c.slice(1).filter((_, i) => i % 2 === 0) as number[]));
        const ys = side.body.flatMap((c) => (c[0] === "Z" ? [] : c.slice(1).filter((_, i) => i % 2 === 1) as number[]));
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(side.area.x);
        expect(Math.max(...xs)).toBeLessThanOrEqual(side.area.x + side.area.w);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(side.area.y);
        expect(Math.max(...ys)).toBeLessThanOrEqual(side.area.y + side.area.h + 8);
      }
    }
  });
  it("tote: the print area covers the full face and the straps are a separate, recolourable piece", () => {
    const tote = seed.products.find((p) => p.slug === "tote-bag")!;
    const side = getSide("tote", "front");
    expect(side.handles?.length).toBeGreaterThan(0);
    // body top edge runs x 170 → 830 at y 380; the area must span at least 95% of that width and most of the height
    expect(side.area.w / 660).toBeGreaterThan(0.95);
    expect(side.area.h / 690).toBeGreaterThan(0.9);
    expect(tote.studio!.areas.every((a) => a.widthMm >= 340 && a.heightMm >= 340)).toBe(true);
    expect(designDocSchema.parse({ productSlug: "tote-bag", garment: "tote", colour: "#e6dcc5", trimColour: "#17171a", sides: {} }).trimColour).toBe("#17171a");
    expect(designDocSchema.safeParse({ productSlug: "tote-bag", garment: "tote", colour: "#e6dcc5", trimColour: "red", sides: {} }).success).toBe(false);
  });
  it("the tee keeps 'front' first so the hero and home plates still find the full front", () => {
    expect(GARMENTS.tee.sides[0]!.key).toBe("front");
    expect(GARMENTS.tee.sides[1]!.key).toBe("back");
    expect(getSide("tee", "left-chest").view).toBe("front");
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
  it("handle colour is one undo step and survives a product switch", () => {
    let s = initialState(designDocSchema.parse({ productSlug: "tote-bag", garment: "tote", colour: "#e6dcc5", sides: {} }), "front");
    s = reducer(s, { type: "setTrim", colour: "#17171a" });
    expect(s.doc.trimColour).toBe("#17171a");
    s = reducer(s, { type: "setProduct", productSlug: "custom-t-shirt", garment: "tee", sideKeys: ["left-chest", "right-chest", "back"] });
    expect(s.doc.trimColour).toBe("#17171a");
    s = reducer(s, { type: "undo" }); s = reducer(s, { type: "undo" });
    expect(s.doc.trimColour).toBeUndefined();
  });
  it("saving keeps undo history", () => {
    let s = reducer(initialState(doc(), "front"), { type: "add", layer: text() });
    s = reducer(s, { type: "saved", remote: { id: "1", ref: "SPP-DESIGN-2026-00001", version: 1, status: "saved" } });
    expect(s.dirty).toBe(false);
    expect(s.past).toHaveLength(1);
  });
});

describe("artwork preflight (advisory)", () => {
  const run = (layers: Layer[], colour = "#17171a") => runPreflight({ sides: { [chest]: layers }, colour, areas: tee.studio!.areas, fabric: tee.fabric, assetMeta: () => undefined });
  const sports = seed.products.find((p) => p.slug === "sports-t-shirt")!;
  const runSports = (layers: Layer[]) => runPreflight({ sides: { front: layers }, colour: "#17171a", areas: sports.studio!.areas, fabric: sports.fabric, assetMeta: () => undefined });
  const image = (naturalW: number, w: number): Layer => ({ id: "i1", type: "image", name: "logo.png", mime: "image/png", w, h: w, naturalW, naturalH: naturalW, x: 500, y: 500, angle: 0, opacity: 1 });
  it("clean artwork is READY FOR REVIEW", () => expect(run([text()]).verdict).toBe("ready"));
  it("a 200px logo printed 7cm wide on the chest is NOT PRODUCTION READY; a 3000px one is fine", () => {
    expect(run([image(200, 900)]).verdict).toBe("blocked");
    expect(run([image(3000, 600)]).checks.find((c) => c.id.startsWith("res-"))!.level).toBe("ok");
  });
  it("flags tiny text, invisible ink, safe-zone and off-area artwork", () => {
    expect(run([text({ size: 8 })]).verdict).toBe("blocked");
    expect(run([text({ fill: "#1a1a1d" })]).checks.some((c) => c.id.startsWith("contrast-"))).toBe(true);
    expect(run([text({ x: 60 })]).checks.some((c) => /safe|crop/.test(c.id))).toBe(true);
    expect(run([text({ x: 5000 })]).verdict).toBe("blocked");
  });
  it("cotton: artwork bigger than the 8 × 8 cm chest cap is named as such; sports fabric never caps", () => {
    const big = run([{ id: "s1", type: "shape", shape: "rect", w: 1400, h: 300, fill: "#ffffff", x: 500, y: 500, angle: 0, opacity: 1 }]);
    const cap = big.checks.find((c) => c.id.startsWith("cap-"))!;
    expect(cap.level).toBe("attention");
    expect(cap.title).toMatch(/8 × 8 cm maximum for cotton/);
    // same oversized shape on the sports tee: free-flow, so no cap / crop / safe-margin warnings, just the free-flow note
    const flow = runSports([{ id: "s1", type: "shape", shape: "rect", w: 1400, h: 300, fill: "#ffffff", x: 500, y: 500, angle: 0, opacity: 1 }]);
    expect(flow.checks.some((c) => /^(cap|crop|safe)-/.test(c.id))).toBe(false);
    expect(flow.checks.some((c) => c.id.startsWith("flow-"))).toBe(true);
    expect(flow.verdict).toBe("ready");
    // but resolution still matters on sports fabric
    expect(runSports([{ id: "i1", type: "image", name: "logo.png", mime: "image/png", w: 900, h: 900, naturalW: 200, naturalH: 200, x: 500, y: 500, angle: 0, opacity: 1 }]).verdict).toBe("blocked");
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

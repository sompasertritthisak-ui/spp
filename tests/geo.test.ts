import { describe, expect, it } from "vitest";
import { billboards } from "../src/content/seed/billboards";
import { PROVINCES, VIEWBOX, project, unproject } from "../src/lib/geo/laos.generated";
import { pathRings, pointInProvince, provinceFor, provinceIdFor } from "../src/lib/geo/provinces";

describe("Laos map projection", () => {
  it("ships all 18 provinces inside the viewBox", () => {
    expect(PROVINCES).toHaveLength(18);
    for (const p of PROVINCES) for (const [x, y] of pathRings(p.d).flat()) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(VIEWBOX.w);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(VIEWBOX.h);
    }
  });

  it("places Vientiane inside the Vientiane Capital shape", () => {
    const vte = PROVINCES.find((p) => p.id === "vientiane-capital")!;
    const pts = pathRings(vte.d).flat();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const [x, y] = project(102.6331, 17.9757);
    expect(x).toBeGreaterThan(Math.min(...xs)); expect(x).toBeLessThan(Math.max(...xs));
    expect(y).toBeGreaterThan(Math.min(...ys)); expect(y).toBeLessThan(Math.max(...ys));
    expect(pointInProvince(vte, x, y)).toBe(true);
  });

  it("round-trips through unproject", () => {
    const [lng, lat] = unproject(...project(104.75, 16.55));
    expect(lng).toBeCloseTo(104.75, 6); expect(lat).toBeCloseTo(16.55, 6);
  });

  it("puts north up and east right", () => {
    expect(project(102, 21)[1]).toBeLessThan(project(102, 15)[1]);
    expect(project(106, 18)[0]).toBeGreaterThan(project(101, 18)[0]);
  });
});

describe("seed billboards on the map", () => {
  it("projects every site inside the viewBox", () => {
    for (const b of billboards) {
      const [x, y] = project(b.lng, b.lat);
      expect(x, b.code).toBeGreaterThan(0); expect(x, b.code).toBeLessThan(VIEWBOX.w);
      expect(y, b.code).toBeGreaterThan(0); expect(y, b.code).toBeLessThan(VIEWBOX.h);
    }
  });

  it("matches every seed province spelling to a map feature", () => {
    for (const b of billboards) expect(provinceFor(b.province), `${b.code} ${b.province}`).not.toBeNull();
    expect(provinceIdFor("Xiangkhouang")).toBe("xiengkhouang");
    expect(provinceIdFor("Bolikhamsai")).toBe("bolikhamxay");
    expect(provinceIdFor("Vientiane")).toBe("vientiane-province");
    expect(provinceIdFor("Vientiane Province")).toBe("vientiane-province");
    expect(provinceIdFor("Khammouane Province")).toBe("khammouane");
    expect(provinceIdFor("Atlantis")).toBeNull();
  });

  it("lands each site in (or on the simplified edge of) the province it names", () => {
    // Border-town sites sit on the Mekong, where the simplified outline can cut a few hundred metres inland.
    const strict = billboards.filter((b) => pointInProvince(provinceFor(b.province)!, ...project(b.lng, b.lat)));
    expect(strict.length).toBeGreaterThanOrEqual(billboards.length - 4);
  });
});

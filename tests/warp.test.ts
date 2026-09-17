import { describe, expect, it } from "vitest";
import { squareToQuad, type Quad } from "../src/components/billboards/warp";

describe("perspective quad warp", () => {
  const quad: Quad = [[100, 80], [620, 40], [640, 360], [90, 300]];
  const map = squareToQuad(quad);

  it("maps the unit square's corners onto the quad", () => {
    const corners: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    corners.forEach(([u, v], i) => { const [x, y] = map(u, v); expect(x).toBeCloseTo(quad[i]![0], 6); expect(y).toBeCloseTo(quad[i]![1], 6); });
  });

  it("is projective: the centre lands where the quad's diagonals cross", () => {
    const [x, y] = map(0.5, 0.5);
    const [a, b, c, d] = quad;
    const den = (a[0] - c[0]) * (b[1] - d[1]) - (a[1] - c[1]) * (b[0] - d[0]);
    const t = ((a[0] - b[0]) * (b[1] - d[1]) - (a[1] - b[1]) * (b[0] - d[0])) / den;
    expect(x).toBeCloseTo(a[0] + t * (c[0] - a[0]), 6);
    expect(y).toBeCloseTo(a[1] + t * (c[1] - a[1]), 6);
  });

  it("reduces to a plain affine map for a rectangle", () => {
    const [x, y] = squareToQuad([[10, 20], [210, 20], [210, 120], [10, 120]])(0.25, 0.5);
    expect(x).toBeCloseTo(60, 6); expect(y).toBeCloseTo(70, 6);
  });
});

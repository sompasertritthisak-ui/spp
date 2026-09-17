/**
 * Perspective quad warp for a 2D canvas.
 *
 * Canvas can only draw affine transforms, so the face is cut into a mesh and
 * every cell is drawn as two affine-mapped triangles. The mesh vertices are
 * placed with a true projective mapping (homography), so straight lines in the
 * artwork stay straight and foreshortening is correct — a bilinear mesh would
 * bend them. 16 × 8 cells is visually exact at billboard scale.
 */
export type Pt = readonly [number, number];
export type Quad = readonly [tl: Pt, tr: Pt, br: Pt, bl: Pt];

/** Homography taking the unit square (u,v ∈ [0,1]) to the quad (Heckbert, 1989). */
export function squareToQuad([p0, p1, p2, p3]: Quad): (u: number, v: number) => [number, number] {
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], sx = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1], sy = p0[1] - p1[1] + p2[1] - p3[1];
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den === 0 ? 0 : (sx * dy2 - dx2 * sy) / den;
  const h = den === 0 ? 0 : (dx1 * sy - sx * dy1) / den;
  const a = p1[0] - p0[0] + g * p1[0], b = p3[0] - p0[0] + h * p3[0], c = p0[0];
  const d = p1[1] - p0[1] + g * p1[1], e = p3[1] - p0[1] + h * p3[1], f = p0[1];
  return (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
}

function triangle(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: [Pt, Pt, Pt], d: [Pt, Pt, Pt]) {
  const [[u0, v0], [u1, v1], [u2, v2]] = s;
  const [[x0, y0], [x1, y1], [x2, y2]] = d;
  const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (Math.abs(det) < 1e-9) return;
  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det;
  const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det;
  const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det;
  const e = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det;
  // grow the clip a fraction of a pixel about the centroid so neighbouring triangles overlap and no seams show
  const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3;
  const grow = (x: number, y: number): [number, number] => { const dx = x - mx, dy = y - my, l = Math.hypot(dx, dy) || 1; return [x + (dx / l) * 0.6, y + (dy / l) * 0.6]; };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...grow(x0, y0)); ctx.lineTo(...grow(x1, y1)); ctx.lineTo(...grow(x2, y2));
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, e, x0 - a * u0 - c * v0, y0 - b * u0 - e * v0);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

export function drawWarped(ctx: CanvasRenderingContext2D, img: CanvasImageSource, imgW: number, imgH: number, quad: Quad, cols = 16, rows = 8) {
  const map = squareToQuad(quad);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const u0 = i / cols, u1 = (i + 1) / cols, v0 = j / rows, v1 = (j + 1) / rows;
    const s00: Pt = [u0 * imgW, v0 * imgH], s10: Pt = [u1 * imgW, v0 * imgH], s11: Pt = [u1 * imgW, v1 * imgH], s01: Pt = [u0 * imgW, v1 * imgH];
    const d00 = map(u0, v0), d10 = map(u1, v0), d11 = map(u1, v1), d01 = map(u0, v1);
    triangle(ctx, img, [s00, s10, s11], [d00, d10, d11]);
    triangle(ctx, img, [s00, s11, s01], [d00, d11, d01]);
  }
}

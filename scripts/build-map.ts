/**
 * Builds the bespoke Laos vector map used by the SPP Outdoor Network.
 *
 *   npx tsx scripts/build-map.ts            (uses the cached source file)
 *   npx tsx scripts/build-map.ts --refresh  (re-downloads the source first)
 *
 * Source   geoBoundaries gbOpen · LAO · ADM1 (simplified release)
 *          https://www.geoboundaries.org — Runfola et al. (2020), CC BY 4.0
 *          Underlying boundary data: OpenStreetMap contributors (via Wambacher),
 *          Open Data Commons Open Database License 1.0.
 *
 * d3-geo is a build-time tool only. The output file re-implements the fitted
 * Mercator as a few constants and a pure function, so the app ships no
 * projection library, no tiles and makes no map request at runtime.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator } from "d3-geo";

const SOURCE_URL = "https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1_simplified.geojson";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = resolve(root, "scripts/data/lao-adm1.raw.geojson");
const OUT = resolve(root, "src/lib/geo/laos.generated.ts");

const W = 1000;
const H = 1200;
const PAD = 48;
/** Douglas-Peucker tolerance in viewBox units (1 unit ≈ 0.9 km). */
const TOLERANCE = 1.15;

/** ISO 3166-2 → the id and spelling SPP uses. Seed/CMS spellings are matched by src/lib/geo/provinces.ts. */
const NAMES: Record<string, { id: string; name: string }> = {
  "LA-AT": { id: "attapeu", name: "Attapeu" },
  "LA-BK": { id: "bokeo", name: "Bokeo" },
  "LA-BL": { id: "bolikhamxay", name: "Bolikhamxay" },
  "LA-CH": { id: "champasak", name: "Champasak" },
  "LA-HO": { id: "houaphan", name: "Houaphan" },
  "LA-KH": { id: "khammouane", name: "Khammouane" },
  "LA-LM": { id: "luang-namtha", name: "Luang Namtha" },
  "LA-LP": { id: "luang-prabang", name: "Luang Prabang" },
  "LA-OU": { id: "oudomxay", name: "Oudomxay" },
  "LA-PH": { id: "phongsali", name: "Phongsali" },
  "LA-SL": { id: "salavan", name: "Salavan" },
  "LA-SV": { id: "savannakhet", name: "Savannakhet" },
  "LA-VT": { id: "vientiane-capital", name: "Vientiane Capital" },
  "LA-VI": { id: "vientiane-province", name: "Vientiane Province" },
  "LA-XA": { id: "xayabouly", name: "Xayabouly" },
  "LA-XE": { id: "sekong", name: "Sekong" },
  "LA-XI": { id: "xiengkhouang", name: "Xiengkhouang" },
  "LA-XN": { id: "xaisomboun", name: "Xaisomboun" },
};

type Pt = [number, number];
type Feature = { properties: { shapeISO: string; shapeName: string }; geometry: { type: "Polygon"; coordinates: Pt[][] } | { type: "MultiPolygon"; coordinates: Pt[][][] } };

async function load(): Promise<{ features: Feature[] }> {
  if (process.argv.includes("--refresh") || !existsSync(RAW)) {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    mkdirSync(dirname(RAW), { recursive: true });
    writeFileSync(RAW, await res.text());
  }
  return JSON.parse(readFileSync(RAW, "utf8")) as { features: Feature[] };
}

const key = (p: Pt) => `${p[0]},${p[1]}`;
const r1 = (v: number) => Math.round(v * 10) / 10;

function douglasPeucker(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a]!;
    const [bx, by] = pts[b]!;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!;
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol && at > 0) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function pointInRing(x: number, y: number, ring: Pt[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToRing(x: number, y: number, ring: Pt[]) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j]!, [bx, by] = ring[i]!;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** Label anchor: the interior point farthest from any edge (grid search), so
 *  labels of crescent-shaped provinces never land outside their own shape. */
function labelPoint(ring: Pt[]): Pt {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best: Pt = [(x0 + x1) / 2, (y0 + y1) / 2], bestD = -1;
  const N = 36;
  for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
    const x = x0 + ((x1 - x0) * i) / N, y = y0 + ((y1 - y0) * j) / N;
    if (!pointInRing(x, y, ring)) continue;
    const d = distToRing(x, y, ring);
    if (d > bestD) { bestD = d; best = [x, y]; }
  }
  return best;
}

async function main() {
  const { features } = await load();
  const polys = features.map((f) => {
    const meta = NAMES[f.properties.shapeISO];
    if (!meta) throw new Error(`unmapped province ${f.properties.shapeISO} ${f.properties.shapeName}`);
    const rings = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).map((poly) => poly[0]!);
    return { ...meta, iso: f.properties.shapeISO, rings };
  });
  if (polys.length !== 18) throw new Error(`expected 18 provinces, found ${polys.length}`);

  // Fit on a bare point cloud: independent of ring winding, which d3's spherical maths is fussy about.
  const cloud = { type: "MultiPoint" as const, coordinates: polys.flatMap((p) => p.rings.flat()) };
  const projection = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], cloud);
  const K = projection.scale();
  const [TX, TY] = projection.translate();
  const project = (lng: number, lat: number): Pt => [K * ((lng * Math.PI) / 180) + TX, TY - K * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
  const check = projection([102.6331, 17.9757])!;
  const mine = project(102.6331, 17.9757);
  if (Math.hypot(check[0] - mine[0], check[1] - mine[1]) > 1e-6) throw new Error("runtime projection drifted from d3");

  // Topology-aware simplification: shared borders are cut into arcs at the
  // points where the set of neighbours changes, and every arc is simplified in
  // one canonical direction — so both provinces get the identical polyline
  // and no slivers open up between them.
  const owners = new Map<string, Set<string>>();
  for (const p of polys) for (const ring of p.rings) for (const pt of ring) {
    const k = key(pt);
    if (!owners.has(k)) owners.set(k, new Set());
    owners.get(k)!.add(p.id);
  }
  const sig = (pt: Pt) => [...owners.get(key(pt))!].sort().join("|");
  const arcCache = new Map<string, Pt[]>();
  const outline: Pt[][] = [];

  function simplifyArc(raw: Pt[], shared: boolean): Pt[] {
    const forward = key(raw[0]!) < key(raw[raw.length - 1]!) || (key(raw[0]!) === key(raw[raw.length - 1]!) && key(raw[1]!) <= key(raw[raw.length - 2]!));
    const canon = forward ? raw : [...raw].reverse();
    const id = `${key(canon[0]!)}>${key(canon[1]!)}>${key(canon[canon.length - 1]!)}:${canon.length}`;
    let out = arcCache.get(id);
    if (!out) {
      out = douglasPeucker(canon.map(([lng, lat]) => project(lng, lat)), TOLERANCE).map(([x, y]) => [r1(x), r1(y)] as Pt);
      arcCache.set(id, out);
      if (!shared) outline.push(out);
    }
    return forward ? out : [...out].reverse();
  }

  const provinces = polys.map((p) => {
    const rings = p.rings.map((closed) => {
      const ring = closed.slice(0, -1); // drop the closing duplicate
      const n = ring.length;
      const sigs = ring.map(sig);
      const cuts: number[] = [];
      for (let i = 0; i < n; i++) if (sigs[i] !== sigs[(i + n - 1) % n] || sigs[i] !== sigs[(i + 1) % n] || sigs[i]!.split("|").length > 2) cuts.push(i);
      if (cuts.length < 2) return simplifyArc([...ring, ring[0]!], false).slice(0, -1);
      const out: Pt[] = [];
      for (let c = 0; c < cuts.length; c++) {
        const a = cuts[c]!, b = cuts[(c + 1) % cuts.length]!;
        const arc: Pt[] = [];
        for (let i = a; ; i = (i + 1) % n) { arc.push(ring[i]!); if (i === b && arc.length > 1) break; }
        // an arc is shared when its interior (or, for a two-point arc, both ends) belongs to two provinces
        const probe = arc.length > 2 ? arc[1]! : null;
        const shared = probe ? sig(probe).includes("|") : sig(arc[0]!).includes("|") && sig(arc[1]!).includes("|");
        out.push(...simplifyArc(arc, shared).slice(0, -1));
      }
      return out.filter((pt, i) => i === 0 || pt[0] !== out[i - 1]![0] || pt[1] !== out[i - 1]![1]);
    }).filter((r) => r.length >= 3);

    const main = rings.reduce((a, b) => (b.length > a.length ? b : a));
    const [cx, cy] = labelPoint(main);
    const all = rings.flat();
    const bbox = [Math.min(...all.map((q) => q[0])), Math.min(...all.map((q) => q[1])), Math.max(...all.map((q) => q[0])), Math.max(...all.map((q) => q[1]))].map(r1);
    const d = rings.map((r) => `M${r.map(([x, y]) => `${x} ${y}`).join(" ")}Z`).join("");
    return { id: p.id, iso: p.iso, name: p.name, d, cx: r1(cx), cy: r1(cy), bbox };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const outlineD = outline.map((a) => `M${a.map(([x, y]) => `${x} ${y}`).join(" ")}`).join("");
  const points = provinces.reduce((s, p) => s + p.d.split(" ").length / 2, 0);

  const file = `/* eslint-disable */
/**
 * GENERATED by scripts/build-map.ts — do not edit. Rebuild: npm run map:build
 *
 * Laos first-level administrative boundaries, simplified and pre-projected.
 * Source: geoBoundaries gbOpen LAO ADM1 (www.geoboundaries.org), CC BY 4.0 —
 *   Runfola, D. et al. (2020) geoBoundaries: A global database of political
 *   administrative boundaries. PLoS ONE 15(4): e0231866.
 * Boundary data © OpenStreetMap contributors, Open Database License (ODbL) 1.0.
 * Boundaries are indicative, heavily simplified and not authoritative.
 */
export type Province = { id: string; iso: string; name: string; /** SVG path in VIEWBOX units */ d: string; /** label anchor */ cx: number; cy: number; bbox: readonly [number, number, number, number] };

export const VIEWBOX = { w: ${W}, h: ${H} } as const;

/** Fitted spherical Mercator: x = K·λ + TX, y = TY − K·ln tan(π/4 + φ/2). */
export const PROJECTION = { k: ${K}, tx: ${TX}, ty: ${TY} } as const;

/** Longitude/latitude in degrees → VIEWBOX units. Pure; identical to the d3 projection used at build time. */
export function project(lng: number, lat: number): [number, number] {
  return [PROJECTION.k * ((lng * Math.PI) / 180) + PROJECTION.tx, PROJECTION.ty - PROJECTION.k * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
}

/** VIEWBOX units → [lng, lat] in degrees (for coordinate readouts and graticules). */
export function unproject(x: number, y: number): [number, number] {
  return [(((x - PROJECTION.tx) / PROJECTION.k) * 180) / Math.PI, ((2 * Math.atan(Math.exp((PROJECTION.ty - y) / PROJECTION.k)) - Math.PI / 2) * 180) / Math.PI];
}

/** The national outline (arcs that belong to one province only), for a heavier outer stroke. */
export const OUTLINE = ${JSON.stringify(outlineD)};

export const PROVINCES: readonly Province[] = ${JSON.stringify(provinces, null, 0).replace(/\},\{/g, "},\n  {").replace(/^\[/, "[\n  ").replace(/\]$/, ",\n]")};
`;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, file);
  process.stdout.write(`laos.generated.ts · ${provinces.length} provinces · ~${Math.round(points)} vertices · ${(Buffer.byteLength(file) / 1024).toFixed(1)} KB\n`);
}

main().catch((e) => { process.stderr.write(`${(e as Error).message}\n`); process.exit(1); });

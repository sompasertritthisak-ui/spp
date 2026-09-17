import { PROVINCES, type Province } from "./laos.generated";

/**
 * Lao province names are romanised a dozen different ways. Content (seed or
 * CMS) may use any common spelling; the map uses one id per province. Keys are
 * compared after lower-casing and stripping everything but letters.
 */
const ALIASES: Record<string, string> = {
  vientianecapital: "vientiane-capital", vientianeprefecture: "vientiane-capital", vientianecity: "vientiane-capital", vientianemunicipality: "vientiane-capital", nakhonluangviengchan: "vientiane-capital",
  vientiane: "vientiane-province", vientianeprovince: "vientiane-province",
  xiengkhouang: "xiengkhouang", xiangkhouang: "xiengkhouang", xiangkhoang: "xiengkhouang", xiengkhuang: "xiengkhouang", xiengkhoang: "xiengkhouang",
  khammouane: "khammouane", khammouan: "khammouane", khammuan: "khammouane", khammuane: "khammouane",
  bolikhamxay: "bolikhamxay", bolikhamsai: "bolikhamxay", bolikhamxai: "bolikhamxay", borikhamxay: "bolikhamxay", borikhamsai: "bolikhamxay",
  phongsali: "phongsali", phongsaly: "phongsali",
  oudomxay: "oudomxay", oudomxai: "oudomxay", oudomsai: "oudomxay", udomxai: "oudomxay",
  luangnamtha: "luang-namtha", louangnamtha: "luang-namtha",
  luangprabang: "luang-prabang", louangphabang: "luang-prabang", luangphabang: "luang-prabang",
  xayabouly: "xayabouly", xaignabouli: "xayabouly", sayabouly: "xayabouly", sainyabuli: "xayabouly", xayaboury: "xayabouly",
  houaphan: "houaphan", huaphanh: "houaphan", houaphanh: "houaphan", huaphan: "houaphan",
  xaisomboun: "xaisomboun", xaysomboun: "xaisomboun", saysomboun: "xaisomboun",
  savannakhet: "savannakhet", salavan: "salavan", saravan: "salavan", saravane: "salavan",
  sekong: "sekong", xekong: "sekong", champasak: "champasak", champassak: "champasak", champasack: "champasak",
  attapeu: "attapeu", attapu: "attapeu", bokeo: "bokeo",
};

const byId = new Map(PROVINCES.map((p) => [p.id, p]));

/** Map id for any reasonable spelling of a province name; null when unknown. */
export function provinceIdFor(name: string): string | null {
  const k = name.toLowerCase().replace(/province$/i, (m) => (/^vientiane\s*province$/i.test(name.trim()) ? m : "")).replace(/[^a-z]/g, "");
  return ALIASES[k] ?? (byId.has(name) ? name : null);
}

export const provinceById = (id: string): Province | null => byId.get(id) ?? null;
export const provinceFor = (name: string): Province | null => { const id = provinceIdFor(name); return id ? provinceById(id) : null; };

/** Parse a generated path ("M x y x y …Z" per ring) back into rings of points. */
export function pathRings(d: string): [number, number][][] {
  return d.split("M").filter(Boolean).map((ring) => {
    const n = ring.replace("Z", "").trim().split(/\s+/).map(Number);
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i]!, n[i + 1]!]);
    return pts;
  });
}

export function pointInProvince(p: Province, x: number, y: number): boolean {
  let inside = false;
  for (const ring of pathRings(p.d)) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

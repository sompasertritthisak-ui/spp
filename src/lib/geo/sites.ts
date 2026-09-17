import type { Billboard, BillboardStatus } from "@/content/types";
import { formatUsd } from "@/lib/format";
import { project } from "./laos.generated";
import { provinceIdFor } from "./provinces";

export type SizeClass = "compact" | "standard" | "large" | "landmark";

/** Face area bands. Labels describe the format, not a price tier. */
export const SIZE_CLASSES: { key: SizeClass; label: string; hint: string }[] = [
  { key: "compact", label: "Compact", hint: "under 25 m²" },
  { key: "standard", label: "Standard", hint: "25–44 m²" },
  { key: "large", label: "Large format", hint: "45–79 m²" },
  { key: "landmark", label: "Landmark", hint: "80 m² and over" },
];

export function sizeClassOf(b: Pick<Billboard, "widthM" | "heightM">): SizeClass {
  const a = b.widthM * b.heightM;
  return a < 25 ? "compact" : a < 45 ? "standard" : a < 80 ? "large" : "landmark";
}

/** Every status has a word, a glyph shape and a tone — colour is never the only signal. */
export const STATUS: Record<BillboardStatus, { label: string; short: string; blurb: string }> = {
  available: { label: "Available", short: "AVL", blurb: "Open for requests now" },
  reserved: { label: "Reserved", short: "RSV", blurb: "Currently held by a campaign" },
  maintenance: { label: "Maintenance", short: "MNT", blurb: "Structure being serviced" },
  unavailable: { label: "Unavailable", short: "N/A", blurb: "Not currently offered" },
};
export const STATUS_ORDER: BillboardStatus[] = ["available", "reserved", "maintenance", "unavailable"];

/** A billboard placed on the map. */
export type Site = Billboard & { x: number; y: number; provinceId: string | null; sizeClass: SizeClass };

export function toSite(b: Billboard): Site {
  const [x, y] = project(b.lng, b.lat);
  return { ...b, x, y, provinceId: provinceIdFor(b.province), sizeClass: sizeClassOf(b) };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function nearestSites<T extends { code: string; lat: number; lng: number }>(to: T, all: T[], n = 3): { site: T; km: number }[] {
  return all.filter((s) => s.code !== to.code).map((site) => ({ site, km: haversineKm(to, site) })).sort((a, b) => a.km - b.km).slice(0, n);
}

/** 17.9645, 102.6178 → 17°57′52″N 102°37′04″E */
export function dms(lat: number, lng: number): string {
  const one = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v), d = Math.floor(a), mFloat = (a - d) * 60, m = Math.floor(mFloat), s = Math.round((mFloat - m) * 60);
    const [mm, ss] = s === 60 ? [m + 1, 0] : [m, s];
    return `${d}°${String(mm).padStart(2, "0")}′${String(ss).padStart(2, "0")}″${v >= 0 ? pos : neg}`;
  };
  return `${one(lat, "N", "S")} ${one(lng, "E", "W")}`;
}

/** Public guide price — only the hint content already publishes, and only while online pricing is switched on. */
export function guidePrice(b: Pick<Billboard, "pricingMode" | "priceFromUsdMonth">, showPrices: boolean): string | null {
  return showPrices && b.pricingMode !== "quote" && b.priceFromUsdMonth != null ? `From ${formatUsd(b.priceFromUsdMonth)} / month` : null;
}

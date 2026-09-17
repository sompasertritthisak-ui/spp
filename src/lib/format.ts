const lak = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const formatLak = (v: number | null | undefined) => (v == null ? "—" : `${lak.format(v)} ₭`);
export const formatLakShort = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B ₭` : v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M ₭` : v >= 1e3 ? `${Math.round(v / 1e3)}K ₭` : `${v} ₭`);
export const formatUsd = (v: number | null | undefined) => (v == null ? "—" : `$${lak.format(v)}`);
export const formatNumber = (v: number) => lak.format(v);

export const formatDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", opts).format(d);
};

export const formatDateTime = (iso: string | null | undefined) => formatDate(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const relativeTime = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
};

export const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

import type { BundleLite, ProductLite } from "@/components/catalogue/lite";
import { METHODS } from "@/components/catalogue/methods";
import { formatDate, formatNumber } from "@/lib/format";
import type { ContactValue } from "@/components/forms/ContactFields";
import type { QuoteDraftItem } from "./draft";
import { defaultLocations } from "./LocationsPicker";

export type Line = QuoteDraftItem & { id: string };

let seq = 0;
export const lineId = () => `line-${++seq}`;

export const DESIGN_REF = /^SPP-DESIGN-\d{4}-\d{5,}$/;

export function newLine(p: ProductLite, patch: Partial<QuoteDraftItem> = {}): Line {
  return { id: lineId(), product: p.slug, qty: Math.max(1, p.moq), method: p.printMethods[0], locations: defaultLocations(p.areas), ...patch };
}

export function bundleLines(b: BundleLite, bySlug: Map<string, ProductLite>): Line[] {
  return b.items.flatMap((i) => {
    const p = bySlug.get(i.product);
    return p ? [newLine(p, { qty: i.qty, note: i.note })] : [];
  });
}

export const sizesTotal = (sizes?: Record<string, number>) => Object.values(sizes ?? {}).reduce((n, v) => n + (v || 0), 0);

export function locationLabel(l: Line, p: ProductLite | undefined) {
  const keys = l.locations ?? [];
  if (!p || p.areas.length <= 1) return keys.length > 1 ? `${keys.length} print locations` : "";
  return keys.map((k) => p.areas.find((a) => a.key === k)?.label ?? k).join(" + ");
}

/** The request as plain text — used for the email / WhatsApp hand-off when online requests are off. */
export function composeSummary(a: { lines: Line[]; bySlug: Map<string, ProductLite>; neededBy: string; needsDesignHelp: boolean; notes: string; contact: ContactValue; extra: string[] }) {
  const out = ["QUOTE REQUEST FOR SPP", ""];
  a.lines.forEach((l, i) => {
    const p = a.bySlug.get(l.product);
    out.push(`${i + 1}. ${formatNumber(l.qty)} x ${p?.name ?? l.product}${[l.colour, l.method ? METHODS[l.method].label : "", locationLabel(l, p), l.delivery ? "with delivery" : ""].filter(Boolean).map((s) => ` - ${s}`).join("")}`);
    if (sizesTotal(l.sizes) > 0) out.push(`   Sizes: ${Object.entries(l.sizes ?? {}).filter(([, n]) => n > 0).map(([s, n]) => `${s} ${n}`).join(", ")}`);
    if (l.designRef) out.push(`   Design ID: ${l.designRef}`);
    if (l.note) out.push(`   Note: ${l.note}`);
  });
  out.push("");
  if (a.neededBy) out.push(`Needed by: ${formatDate(a.neededBy)}`);
  out.push(`Design help needed: ${a.needsDesignHelp ? "Yes" : "No"}`);
  for (const e of a.extra) out.push(e);
  if (a.notes.trim()) out.push("", `Notes: ${a.notes.trim()}`);
  out.push("", `From: ${[a.contact.name, a.contact.company].filter(Boolean).join(", ")}`);
  if (a.contact.email) out.push(`Email: ${a.contact.email}`);
  if (a.contact.phone) out.push(`Phone: ${a.contact.phone}`);
  return out.join("\n");
}

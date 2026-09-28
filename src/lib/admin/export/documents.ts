import type { OrderItemsRow, OrdersRow, QuoteItemsRow, QuotesRow } from "@/lib/backend/db-types";
import type { Company } from "./company";
import { isoDate, numOrNull, type Sheet, type SheetColumn } from "./sheet";

/* Quotation / order documents and list exports, described once and rendered to
   .xlsx or .csv by the writers. Figures are LAK; the LAK number format keeps
   thousands separators without a currency symbol Excel might mis-localise. */

export const LAK = "#,##0";
type Contact = { name?: string; company?: string; email?: string; phone?: string; social?: string };
export const contactOf = (j: unknown): Contact => (j && typeof j === "object" && !Array.isArray(j) ? (j as Contact) : {});
const who = (c: Contact) => [c.name, c.company].filter(Boolean).join(" · ") || "—";
const reach = (c: Contact) => [c.email, c.phone, c.social].filter(Boolean).join(" · ") || "—";
const label = (s: string) => s.replace(/_/g, " ");

/** Configuration JSON → one readable line ("colour navy · sizes M×20 L×30"). */
export function describeConfig(c: unknown): string {
  if (!c || typeof c !== "object" || Array.isArray(c)) return "";
  return Object.entries(c as Record<string, unknown>).flatMap(([k, v]) => {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return [];
    if (k === "sizes" && typeof v === "object" && !Array.isArray(v)) return [`sizes ${Object.entries(v as Record<string, unknown>).filter(([, n]) => Number(n) > 0).map(([s, n]) => `${s}×${String(n)}`).join(" ")}`];
    return [`${k} ${Array.isArray(v) ? v.join(" + ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`];
  }).join(" · ");
}

const letterhead = (co: Company): [string, string | null][] => [
  ["Issued by", [co.legalName, co.legalNameLo].filter(Boolean).join(" / ")],
  ["Address", co.addressLine],
  ["Contact", [co.phone, co.landline, co.email].filter(Boolean).join(" · ") || null],
];

const ITEM_COLUMNS: SheetColumn[] = [
  { key: "n", header: "#", width: 5 },
  { key: "product", header: "Product", width: 34 },
  { key: "config", header: "Specification", width: 40 },
  { key: "qty", header: "Qty", width: 9, numFmt: "#,##0" },
  { key: "unit", header: "Unit price (LAK)", width: 17, numFmt: LAK },
  { key: "total", header: "Line total (LAK)", width: 17, numFmt: LAK },
  { key: "note", header: "Note", width: 32 },
  { key: "design", header: "Design ref", width: 26 },
];

export type DesignRefs = Record<string, string>; // design_id → ref (vN)
const designCell = (id: string | null, v: number | null, refs: DesignRefs) => (id ? `${refs[id] ?? id.slice(0, 8)}${v ? ` v${v}` : ""}` : null);

export function quoteDocument(q: QuotesRow, items: QuoteItemsRow[], co: Company, refs: DesignRefs = {}): Sheet {
  const c = contactOf(q.contact);
  const sum = items.reduce<number | null>((t, i) => (t == null || i.line_total_lak == null ? null : t + Number(i.line_total_lak)), 0);
  return {
    name: q.ref, title: `Quotation ${q.ref}`,
    meta: [...letterhead(co), ["Quote ref", q.ref], ["Status", label(q.status)], ["Kind", label(q.kind)], ["Requested", isoDate(q.created_at)], ["Sent", isoDate(q.sent_at)], ["Valid until", isoDate(q.valid_until)], ["Needed by", isoDate(q.needed_by)], ["Customer", who(c)], ["Customer contact", reach(c)]],
    columns: ITEM_COLUMNS,
    rows: items.map((i, n) => ({ n: n + 1, product: i.product_name, config: describeConfig(i.config), qty: i.qty, unit: numOrNull(i.unit_price_lak), total: numOrNull(i.line_total_lak), note: i.note || null, design: designCell(i.design_id, i.design_version, refs) })),
    totals: { config: q.total_lak != null && sum != null && Number(q.total_lak) !== sum ? `Quoted total (lines add up to ${sum.toLocaleString("en-US")})` : "Quoted total", total: numOrNull(q.total_lak) ?? sum, note: q.estimate_low_lak != null ? `Engine estimate at submit: ${Number(q.estimate_low_lak).toLocaleString("en-US")} – ${Number(q.estimate_high_lak).toLocaleString("en-US")} LAK` : null },
    notes: [q.terms ? `Terms: ${q.terms}` : "Terms: as agreed in writing with SPP.", q.customer_notes ? `Customer notes: ${q.customer_notes}` : "", "All prices in Lao kip (LAK). A quotation is confirmed only when issued in writing by SPP; on-screen estimates are guides."].filter(Boolean),
  };
}

export function orderDocument(o: OrdersRow, items: OrderItemsRow[], co: Company, refs: DesignRefs = {}, quoteRef: string | null = null): Sheet {
  const c = contactOf(o.contact);
  const sum = items.reduce<number | null>((t, i) => (t == null || i.line_total_lak == null ? null : t + Number(i.line_total_lak)), 0);
  return {
    name: o.ref, title: `Order ${o.ref}`,
    meta: [...letterhead(co), ["Order ref", o.ref], ["From quote", quoteRef], ["Status", label(o.status)], ["Payment", label(o.payment_status)], ["Created", isoDate(o.created_at)], ["Due", isoDate(o.due_on)], ["Delivery", `${label(o.delivery_method)}${o.delivery_address ? ` — ${o.delivery_address}` : ""}`], ["Customer", who(c)], ["Customer contact", reach(c)]],
    columns: ITEM_COLUMNS.filter((col) => col.key !== "note"),
    rows: items.map((i, n) => ({ n: n + 1, product: i.product_name, config: describeConfig(i.config), qty: i.qty, unit: numOrNull(i.unit_price_lak), total: numOrNull(i.line_total_lak), design: designCell(i.design_id, i.design_version, refs) })),
    totals: { config: "Order total", total: numOrNull(o.total_lak) ?? sum },
    notes: ["All prices in Lao kip (LAK). Payment status is recorded manually by SPP accounts; this document is not a tax invoice."],
  };
}

export function quotesList(rows: QuotesRow[]): Sheet {
  const total = rows.reduce((t, r) => t + Number(r.total_lak ?? 0), 0);
  return {
    name: "Quotes", title: `Quotes — ${rows.length} exported ${isoDate(new Date().toISOString())}`,
    columns: [
      { key: "ref", header: "Quote", width: 22 }, { key: "status", header: "Status", width: 12 }, { key: "kind", header: "Kind", width: 10 }, { key: "customer", header: "Customer", width: 30 }, { key: "reach", header: "Contact", width: 34 },
      { key: "total", header: "Quoted total (LAK)", width: 18, numFmt: LAK }, { key: "low", header: "Estimate low (LAK)", width: 18, numFmt: LAK }, { key: "high", header: "Estimate high (LAK)", width: 18, numFmt: LAK },
      { key: "needed", header: "Needed by", width: 12 }, { key: "created", header: "Requested", width: 12 }, { key: "sent", header: "Sent", width: 12 }, { key: "valid", header: "Valid until", width: 12 }, { key: "help", header: "Design help", width: 11 }, { key: "notes", header: "Customer notes", width: 40 },
    ],
    rows: rows.map((r) => { const c = contactOf(r.contact); return { ref: r.ref, status: label(r.status), kind: label(r.kind), customer: who(c), reach: reach(c), total: numOrNull(r.total_lak), low: numOrNull(r.estimate_low_lak), high: numOrNull(r.estimate_high_lak), needed: isoDate(r.needed_by), created: isoDate(r.created_at), sent: isoDate(r.sent_at), valid: isoDate(r.valid_until), help: r.needs_design_help, notes: r.customer_notes || null }; }),
    totals: { ref: `${rows.length} quotes`, total },
    notes: ["Quoted totals are what SPP priced, not invoiced or paid amounts."],
  };
}

export function ordersList(rows: OrdersRow[]): Sheet {
  const total = rows.reduce((t, r) => t + Number(r.total_lak ?? 0), 0);
  return {
    name: "Orders", title: `Orders — ${rows.length} exported ${isoDate(new Date().toISOString())}`,
    columns: [
      { key: "ref", header: "Order", width: 22 }, { key: "status", header: "Status", width: 14 }, { key: "payment", header: "Payment", width: 10 }, { key: "customer", header: "Customer", width: 30 }, { key: "reach", header: "Contact", width: 34 },
      { key: "total", header: "Total (LAK)", width: 16, numFmt: LAK }, { key: "due", header: "Due", width: 12 }, { key: "created", header: "Created", width: 12 }, { key: "completed", header: "Completed", width: 12 }, { key: "method", header: "Delivery", width: 12 }, { key: "address", header: "Address", width: 36 }, { key: "reorder", header: "Reorder", width: 8 },
    ],
    rows: rows.map((r) => { const c = contactOf(r.contact); return { ref: r.ref, status: label(r.status), payment: label(r.payment_status), customer: who(c), reach: reach(c), total: numOrNull(r.total_lak), due: isoDate(r.due_on), created: isoDate(r.created_at), completed: isoDate(r.completed_at), method: label(r.delivery_method), address: r.delivery_address || null, reorder: Boolean(r.reorder_of) }; }),
    totals: { ref: `${rows.length} orders`, total },
    notes: ["Totals are from quoted order values, not invoiced or paid amounts."],
  };
}

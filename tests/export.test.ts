import { describe, expect, it } from "vitest";
import { companyFrom } from "@/lib/admin/export/company";
import { describeConfig, orderDocument, quoteDocument, quotesList } from "@/lib/admin/export/documents";
import { isoDate, safeFileName, safeTabName, toCsv } from "@/lib/admin/export/sheet";
import type { OrderItemsRow, OrdersRow, QuoteItemsRow, QuotesRow } from "@/lib/backend/db-types";

const co = companyFrom({ companyName: "SPP", legalName: "SPP Sole Co., Ltd", legalNameLo: "ບໍລິສັດ SPP", address: { line1: "Nakham Village", city: "Vientiane", country: "Laos", lat: 17.9, lng: 102.6 }, phone: "+8562055518882", email: "spp_sole@yahoo.com" });
const quote = { id: "q1", ref: "SPP-QUOTE-2026-00001", lead_id: null, project_id: null, customer_id: null, contact: { name: "Kham", company: "Beerlao", email: "k@example.com" }, kind: "product", needed_by: "2026-11-01", needs_design_help: false, customer_notes: "", estimate_low_lak: 1000000, estimate_high_lak: 1200000, total_lak: 1100000, valid_until: "2026-10-15", terms: "50% deposit", status: "sent", reorder_of: null, sent_at: "2026-09-27T03:00:00Z", decided_at: null, created_at: "2026-09-26T10:00:00Z", updated_at: "2026-09-27T03:00:00Z" } as QuotesRow;
const items = [
  { id: "i1", quote_id: "q1", product_id: null, product_slug: "polo-shirt", product_name: "Polo shirt", design_id: "d1", design_version: 2, qty: 50, config: { colour: "navy", sizes: { M: 20, L: 30, XL: 0 } }, estimate_unit_lak: 20000, unit_price_lak: 22000, line_total_lak: 1100000, note: "=cmd", sort: 0 },
] as QuoteItemsRow[];

describe("export documents", () => {
  it("builds a quotation sheet with letterhead, lines, totals and terms", () => {
    const s = quoteDocument(quote, items, co, { d1: "SPP-DESIGN-2026-00007" });
    expect(s.title).toBe("Quotation SPP-QUOTE-2026-00001");
    expect(s.meta).toContainEqual(["Issued by", "SPP Sole Co., Ltd / ບໍລິສັດ SPP"]);
    expect(s.meta).toContainEqual(["Customer", "Kham · Beerlao"]);
    expect(s.rows[0]).toMatchObject({ n: 1, product: "Polo shirt", qty: 50, unit: 22000, total: 1100000, design: "SPP-DESIGN-2026-00007 v2", config: "colour navy · sizes M×20 L×30" });
    expect(s.totals).toMatchObject({ total: 1100000, config: "Quoted total" });
    expect(s.notes?.[0]).toBe("Terms: 50% deposit");
  });
  it("flags an overridden total and falls back to the sum of lines", () => {
    const s = quoteDocument({ ...quote, total_lak: 1000000 }, items, co);
    expect(String(s.totals?.config)).toMatch(/lines add up to 1,100,000/);
    expect(quoteDocument({ ...quote, total_lak: null }, items, co).totals?.total).toBe(1100000);
  });
  it("builds an order document and the list export with a totals row", () => {
    const o = { ...quote, id: "o1", ref: "SPP-ORDER-2026-00001", status: "approved", payment_status: "deposit", due_on: "2026-11-01", delivery_method: "delivery", delivery_address: "Vientiane", customer_confirmed_at: null, completed_at: null, quote_id: "q1" } as unknown as OrdersRow;
    const oi = [{ ...items[0]!, order_id: "o1", quote_item_id: "i1" }] as unknown as OrderItemsRow[];
    const s = orderDocument(o, oi, co, {}, "SPP-QUOTE-2026-00001");
    expect(s.meta).toContainEqual(["From quote", "SPP-QUOTE-2026-00001"]);
    expect(s.columns.some((c) => c.key === "note")).toBe(false);
    const list = quotesList([quote, { ...quote, id: "q2", total_lak: null }]);
    expect(list.rows).toHaveLength(2);
    expect(list.totals).toMatchObject({ ref: "2 quotes", total: 1100000 });
  });
  it("describes configuration and normalises dates to Vientiane days", () => {
    expect(describeConfig({ a: null, b: [], sizes: { S: 0, M: 3 }, method: ["screen", "dtf"] })).toBe("sizes M×3 · method screen + dtf");
    expect(isoDate("2026-09-26T18:30:00Z")).toBe("2026-09-27");
    expect(isoDate(null)).toBeNull();
  });
});

describe("csv writer", () => {
  it("quotes, escapes and guards against formula injection", () => {
    const csv = toCsv(quoteDocument(quote, items, co));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Quotation SPP-QUOTE-2026-00001");
    expect(csv).toContain("'=cmd"); // note starting with "=" is neutralised
    expect(csv).toContain("Kham · Beerlao");
    expect(csv).toContain("#,Product,Specification,Qty,Unit price (LAK),Line total (LAK),Note,Design ref");
  });
  it("sanitises tab and file names", () => {
    expect(safeTabName("Quotes: 2026/09 [draft]?")).toBe("Quotes  2026 09  draft");
    expect(safeFileName("SPP-QUOTE 2026/00001")).toBe("SPP-QUOTE-2026-00001");
  });
});

describe("company letterhead", () => {
  it("falls back honestly when settings are empty", () => {
    const c = companyFrom(null);
    expect(c.legalName).toBe("SPP Sole Co., Ltd");
    expect(c.addressLine).toBe("Vientiane, Lao PDR");
    expect(co.addressLine).toBe("Nakham Village, Vientiane, Laos");
  });
});

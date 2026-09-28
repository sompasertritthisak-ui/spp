import { BRAND } from "@/lib/brand";
import { downloadBlob, safeFileName, safeTabName, type Sheet } from "./sheet";

/**
 * Styled .xlsx from `Sheet` descriptions. exceljs (MIT) is imported lazily so
 * it lives in an admin-only chunk and never ships with public pages.
 */
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
const INK = argb(BRAND.ink), GOLD = argb(BRAND.gold), WHITE = "FFFFFFFF", RULE = "FFD9DCE8", PAPER = "FFF5F7FD";

export async function buildXlsx(sheets: Sheet[]): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "SPP Command Center";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(safeTabName(s.name), { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: s.columns.length > 7 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = s.columns.map((c) => ({ key: c.key, width: c.width ?? Math.max(12, Math.min(48, c.header.length + 6)) }));
    let r = 1;
    const title = ws.getCell(r, 1);
    title.value = s.title;
    title.font = { name: "Arial", size: 16, bold: true, color: { argb: INK } };
    ws.getRow(r).height = 26;
    r += 1;
    for (const [k, v] of s.meta ?? []) {
      const key = ws.getCell(r, 1), val = ws.getCell(r, 2);
      key.value = k; key.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF6B7194" } };
      val.value = v ?? "—"; val.font = { name: "Arial", size: 10, color: { argb: INK } }; val.alignment = { wrapText: false };
      r += 1;
    }
    if (s.meta?.length) r += 1;

    const head = ws.getRow(r);
    s.columns.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.header;
      cell.font = { name: "Arial", size: 9, bold: true, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      cell.alignment = { vertical: "middle", horizontal: c.align ?? (c.numFmt ? "right" : "left") };
      cell.border = { bottom: { style: "medium", color: { argb: GOLD } } };
    });
    head.height = 20;
    r += 1;

    const firstData = r;
    for (const row of s.rows) {
      const line = ws.getRow(r);
      s.columns.forEach((c, i) => {
        const cell = line.getCell(i + 1);
        const v = row[c.key];
        cell.value = v == null ? null : typeof v === "boolean" ? (v ? "yes" : "no") : v;
        cell.font = { name: "Arial", size: 10, color: { argb: INK } };
        cell.alignment = { vertical: "top", wrapText: true, horizontal: c.align ?? (c.numFmt ? "right" : "left") };
        cell.border = { bottom: { style: "thin", color: { argb: RULE } } };
        if (c.numFmt && typeof v === "number") cell.numFmt = c.numFmt;
      });
      r += 1;
    }
    if (s.totals) {
      const line = ws.getRow(r);
      s.columns.forEach((c, i) => {
        const cell = line.getCell(i + 1);
        const v = s.totals?.[c.key];
        cell.value = v == null ? null : v;
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: INK } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPER } };
        cell.alignment = { horizontal: c.align ?? (c.numFmt ? "right" : "left") };
        cell.border = { top: { style: "medium", color: { argb: GOLD } } };
        if (c.numFmt && typeof v === "number") cell.numFmt = c.numFmt;
      });
      r += 1;
    }
    if (s.rows.length) ws.autoFilter = { from: { row: firstData - 1, column: 1 }, to: { row: firstData - 1 + s.rows.length, column: s.columns.length } };
    ws.views = [{ state: "frozen", ySplit: firstData - 1, showGridLines: false }];
    r += 1;
    for (const n of s.notes ?? []) {
      const cell = ws.getCell(r, 1);
      cell.value = n;
      cell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B7194" } };
      cell.alignment = { wrapText: true, vertical: "top" };
      ws.mergeCells(r, 1, r, Math.max(2, s.columns.length));
      ws.getRow(r).height = Math.max(15, Math.ceil(n.length / 90) * 14);
      r += 1;
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function downloadXlsx(fileName: string, sheets: Sheet[]) {
  downloadBlob(`${safeFileName(fileName)}.xlsx`, await buildXlsx(sheets));
}

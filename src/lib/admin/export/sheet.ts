/**
 * Provider-neutral description of a tabular export. One `Sheet` renders to
 * CSV (here, no dependency) or to a styled .xlsx (`xlsx.ts`, lazy-loaded
 * exceljs) so every Command Center export shares the same shape and headers.
 */
export type Cell = string | number | boolean | null | undefined;
export type SheetColumn = { key: string; header: string; width?: number; /** exceljs number format, e.g. "#,##0" for LAK */ numFmt?: string; align?: "left" | "right" };
export type SheetRow = Record<string, Cell>;
export type Sheet = {
  /** Tab name, ≤ 31 chars, no []:*?/\ — sanitised by the writer. */
  name: string;
  /** Document title printed above the table. */
  title: string;
  /** Key/value block under the title: legal name, ref, dates, customer… */
  meta?: [string, Cell][];
  columns: SheetColumn[];
  rows: SheetRow[];
  /** Optional totals row; only the keys present are filled. */
  totals?: SheetRow;
  /** Free-text lines under the table (terms, disclaimers). */
  notes?: string[];
};

export const safeTabName = (s: string) => s.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
export const safeFileName = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "export";

const csvCell = (v: Cell) => {
  if (v == null) return "";
  const s = typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
  // Neutralise spreadsheet formula injection from user-typed fields ("=HYPERLINK…").
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Lao text correctly. Meta and notes are included as leading/trailing rows. */
export function toCsv(sheet: Sheet): string {
  const lines: string[] = [];
  lines.push(csvCell(sheet.title));
  for (const [k, v] of sheet.meta ?? []) lines.push(`${csvCell(k)},${csvCell(v)}`);
  if (sheet.meta?.length) lines.push("");
  lines.push(sheet.columns.map((c) => csvCell(c.header)).join(","));
  for (const r of sheet.rows) lines.push(sheet.columns.map((c) => csvCell(r[c.key])).join(","));
  if (sheet.totals) lines.push(sheet.columns.map((c) => csvCell(sheet.totals?.[c.key])).join(","));
  for (const n of sheet.notes ?? []) lines.push(csvCell(n));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Triggers a browser download; the object URL is released once the click has been dispatched. */
export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadCsv = (fileName: string, sheet: Sheet) => downloadBlob(`${safeFileName(fileName)}.csv`, new Blob([toCsv(sheet)], { type: "text/csv;charset=utf-8" }));

/** ISO date/timestamp → "YYYY-MM-DD" in Vientiane time; spreadsheets sort and filter this reliably. */
export const isoDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
};
export const numOrNull = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));

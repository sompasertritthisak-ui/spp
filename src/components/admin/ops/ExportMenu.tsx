"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/admin/export/sheet";
import type { Sheet } from "@/lib/admin/export/sheet";

/**
 * Excel / CSV / PDF actions for a record or a list. `build` runs only on click,
 * and the .xlsx writer (exceljs) is fetched on first use, so lists stay light.
 */
export function ExportMenu({ fileName, build, printHref, disabled, label = "Export", size = "sm" }: { fileName: string; build: () => Promise<Sheet[]>; printHref?: string; disabled?: boolean; label?: string; size?: "sm" | "md" }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"xlsx" | "csv" | null>(null);
  const run = async (kind: "xlsx" | "csv") => {
    setBusy(kind);
    try {
      const sheets = await build();
      if (kind === "csv") downloadCsv(sheets.length > 1 ? `${fileName}-${sheets[0]?.name ?? ""}` : fileName, sheets[0]!);
      else await (await import("@/lib/admin/export/xlsx")).downloadXlsx(fileName, sheets);
      toast(kind === "csv" ? "CSV downloaded." : "Excel workbook downloaded.", "ok");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "The export could not be prepared. Try again.", "danger");
    } finally { setBusy(null); }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="t-label mr-1 hidden text-[0.625rem] text-fog-500 sm:inline">{label}</span>
      <Button size={size} variant="outline" disabled={disabled || busy != null} loading={busy === "xlsx"} onClick={() => void run("xlsx")}>Excel</Button>
      <Button size={size} variant="ghost" disabled={disabled || busy != null} loading={busy === "csv"} onClick={() => void run("csv")}>CSV</Button>
      {printHref && <Button size={size} variant="ghost" href={printHref} target="_blank" rel="noopener">PDF</Button>}
    </span>
  );
}

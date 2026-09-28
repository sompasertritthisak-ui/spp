"use client";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import type { Company } from "@/lib/admin/export/company";
import type { Sheet } from "@/lib/admin/export/sheet";
import { ExportMenu } from "./ExportMenu";

/*
 * Print-quality paper document rendered inside the Command Center. Black on
 * white by design: the browser's "Save as PDF" is the PDF export, so nothing
 * here may depend on the dark theme or on background graphics being printed.
 * The @media print rules hide the shell and keep only #spp-print.
 */
const PRINT_CSS = `
@page { size: A4; margin: 14mm 14mm 16mm; }
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #spp-print, #spp-print * { visibility: visible !important; }
  #spp-print { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
  .no-print { display: none !important; }
  tr { break-inside: avoid; }
}`;

const fmt = (v: string | number | boolean | null | undefined, numFmt?: string) => (v == null || v === "" ? "—" : typeof v === "number" && numFmt ? v.toLocaleString("en-US") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

export function PrintDocument({ sheet, company, kind, backHref, exportName, exportBuild }: { sheet: Sheet; company: Company; kind: "Quotation" | "Order"; backHref: string; exportName: string; exportBuild: () => Promise<Sheet[]> }) {
  // Letterhead lines live in the sheet meta as well (for Excel); on paper they become the masthead.
  const meta = (sheet.meta ?? []).filter(([k]) => !["Issued by", "Address", "Contact"].includes(k));
  const cols = sheet.columns;
  return (
    <div className="mx-auto max-w-[210mm]">
      <style>{PRINT_CSS}</style>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={backHref} className="t-label text-[0.625rem] text-fog-400 hover:text-fog-50">← Back to {kind.toLowerCase()}</Link>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <ExportMenu fileName={exportName} build={exportBuild} />
          <Button size="sm" onClick={() => window.print()}>Download PDF</Button>
        </span>
      </div>
      <p className="no-print mb-3 text-xs text-fog-500">“Download PDF” opens the print dialog — choose <strong className="text-fog-300">Save as PDF</strong> as the destination. Layout is A4.</p>

      <article id="spp-print" className="bg-white p-[14mm] text-[#0b0e2c] shadow-2xl shadow-black/40 print:p-0 print:shadow-none" style={{ colorScheme: "light" }}>
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#0b0e2c] pb-5">
          <div>
            <Logo tone="paper" className="h-10" />
            <p className="mt-3 text-[15px] font-semibold leading-tight">{company.legalName}</p>
            {company.legalNameLo && <p className="text-[13px] leading-tight">{company.legalNameLo}</p>}
            <p className="mt-1 text-[12px] leading-snug text-[#3a3f5c]">{company.addressLine}</p>
            <p className="text-[12px] leading-snug text-[#3a3f5c]">{[company.phone, company.landline, company.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6b7194]">{kind}</p>
            <p className="mt-1 font-mono text-[22px] font-semibold tracking-tight">{sheet.name}</p>
            <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-1 text-[12px]">
              {meta.filter(([k]) => !["Customer", "Customer contact", "Delivery", "Quote ref", "Order ref"].includes(k)).map(([k, v]) => <div key={k} className="contents"><dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7194]">{k}</dt><dd className="text-right">{fmt(v)}</dd></div>)}
            </dl>
          </div>
        </header>

        <section className="mt-5 grid gap-4 text-[12px] sm:grid-cols-2">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7194]">Customer</p><p className="mt-1 text-[14px] font-semibold">{fmt(meta.find(([k]) => k === "Customer")?.[1])}</p><p className="text-[#3a3f5c]">{fmt(meta.find(([k]) => k === "Customer contact")?.[1])}</p></div>
          {meta.some(([k]) => k === "Delivery") && <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7194]">Delivery</p><p className="mt-1 text-[#3a3f5c]">{fmt(meta.find(([k]) => k === "Delivery")?.[1])}</p></div>}
        </section>

        <table className="mt-6 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b-2 border-[#f5b81f] text-left">
              {cols.map((c) => <th key={c.key} scope="col" className={`py-2 pr-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#0b0e2c] ${c.numFmt ? "text-right" : ""}`}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r, i) => (
              <tr key={i} className="border-b border-[#d9dce8] align-top">
                {cols.map((c) => <td key={c.key} className={`py-2 pr-3 ${c.numFmt ? "text-right font-mono tabular-nums" : ""} ${c.key === "product" ? "font-semibold" : ""}`}>{fmt(r[c.key], c.numFmt)}</td>)}
              </tr>
            ))}
            {sheet.rows.length === 0 && <tr><td colSpan={cols.length} className="py-6 text-center text-[#6b7194]">No line items.</td></tr>}
          </tbody>
          {sheet.totals && (
            <tfoot>
              <tr className="border-t-2 border-[#0b0e2c] font-semibold">
                {cols.map((c) => <td key={c.key} className={`py-2.5 pr-3 ${c.numFmt ? "text-right font-mono text-[14px] tabular-nums" : ""}`}>{c.key === "n" ? "" : sheet.totals?.[c.key] == null ? "" : fmt(sheet.totals[c.key], c.numFmt)}</td>)}
              </tr>
            </tfoot>
          )}
        </table>

        <footer className="mt-8 border-t border-[#d9dce8] pt-4 text-[11px] leading-relaxed text-[#3a3f5c]">
          {(sheet.notes ?? []).map((n, i) => <p key={i} className={i === 0 ? "text-[12px] text-[#0b0e2c]" : "mt-1.5"}>{n}</p>)}
          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-[#6b7194]">{company.legalName} · {company.addressLine} · Generated by SPP Command Center</p>
        </footer>
      </article>
    </div>
  );
}

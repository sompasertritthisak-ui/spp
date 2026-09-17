import type { ReactNode } from "react";

export type TableData = { columns: string[]; rows: (string | number)[][] };

/** Shared chart anatomy: title, one-line reading, legend, plot, and a data-table alternative. */
export function ChartFrame({ title, desc, legend, table, children, empty, emptyText = "No data for this period yet." }: { title: string; desc?: string; legend?: ReactNode; table?: TableData; children: ReactNode; empty?: boolean; emptyText?: string }) {
  return (
    <figure className="m-0">
      <figcaption className="mb-3">
        <p className="t-label text-fog-300">{title}</p>
        {desc && <p className="mt-1 text-xs leading-relaxed text-fog-500">{desc}</p>}
      </figcaption>
      {empty ? (
        <div className="flex items-center gap-3 border border-dashed border-ink-600 px-4 py-8 text-sm text-fog-500"><span aria-hidden className="reg h-4 w-4 flex-none" />{emptyText}</div>
      ) : (
        <>
          {legend && <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fog-300">{legend}</div>}
          {children}
          {table && (
            <details className="mt-3 text-xs">
              <summary className="t-label inline-flex min-h-8 cursor-pointer items-center text-[0.625rem] text-fog-500 hover:text-fog-100">View as table</summary>
              <div className="thin-scroll mt-2 overflow-x-auto border border-ink-700">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">{title} — data</caption>
                  <thead><tr>{table.columns.map((c) => <th key={c} scope="col" className="t-label border-b border-ink-700 px-3 py-2 text-[0.625rem] font-medium text-fog-500">{c}</th>)}</tr></thead>
                  <tbody>{table.rows.map((r, i) => <tr key={i} className="border-b border-ink-800 last:border-0">{r.map((c, j) => <td key={j} className={j === 0 ? "px-3 py-1.5 text-fog-100" : "t-data px-3 py-1.5 text-fog-300"}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </figure>
  );
}

export function LegendKey({ swatch, children }: { swatch: string; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><span aria-hidden className={`h-2 w-3 flex-none ${swatch}`} />{children}</span>;
}

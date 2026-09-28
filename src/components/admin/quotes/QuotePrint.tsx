"use client";
import { useSearchParams } from "next/navigation";
import { loadCompany, type Company } from "@/lib/admin/export/company";
import { quoteDocument } from "@/lib/admin/export/documents";
import { useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { QuoteItemsRow, QuotesRow } from "@/lib/backend/db-types";
import { db } from "../ops/data";
import { designRefs, quoteSheets } from "../ops/exports";
import { NoAccess, SkeletonRows } from "../ops/parts";
import { PrintDocument } from "../ops/PrintDocument";
import { ErrorNote } from "../ui";

type Bundle = { quote: QuotesRow; items: QuoteItemsRow[]; company: Company; refs: Record<string, string> };

/** /admin/quotes/print/?id=… — the quotation as a paper document; the browser's Save-as-PDF is the PDF export. */
export function QuotePrint() {
  const id = useSearchParams().get("id");
  const { can } = useAuth();
  const canRead = can("sales") || can("designs");
  const q = useQuery<Bundle | null>(async () => {
    const b = db();
    const [quote, items, company] = await Promise.all([b.from("quotes").select("*").eq("id", id ?? "").maybeSingle(), b.from("quote_items").select("*").eq("quote_id", id ?? "").order("sort"), loadCompany()]);
    if (quote.error) return { data: null, error: quote.error };
    if (!quote.data) return { data: null, error: null };
    const rows = (items.data ?? []) as QuoteItemsRow[];
    return { data: { quote: quote.data as QuotesRow, items: rows, company, refs: await designRefs(rows) }, error: null };
  }, [id], { enabled: Boolean(id) && canRead });
  if (!canRead) return <NoAccess what="quotations" />;
  if (!id) return <p className="text-sm text-fog-400">No quote selected. Open a quote and choose PDF.</p>;
  if (q.loading && !q.data) return <SkeletonRows n={8} />;
  if (q.error) return <ErrorNote message={q.error} onRetry={() => void q.reload()} />;
  if (!q.data) return <p className="text-sm text-fog-400">This quote could not be found, or your role cannot view it.</p>;
  const { quote, items, company, refs } = q.data;
  return <PrintDocument kind="Quotation" sheet={quoteDocument(quote, items, company, refs)} company={company} backHref={`/admin/quotes/?id=${quote.id}`} exportName={quote.ref} exportBuild={() => quoteSheets(quote, items)} />;
}

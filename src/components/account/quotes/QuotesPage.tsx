"use client";
import { useSearchParams } from "next/navigation";
import { ErrorNote, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate, formatLak, titleCase } from "@/lib/format";
import { usePortal } from "../PortalShell";
import { PortalHeader, RowLink, RowsSkeleton } from "../ui";
import { QuoteDetail } from "./QuoteDetail";
import { isExpired, isPriced, QUOTE_COLS, type QuoteLite } from "./shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function QuotesPage() {
  const id = useSearchParams().get("id");
  return id && UUID.test(id) ? <QuoteDetail key={id} id={id} /> : <QuoteList />;
}

function QuoteList() {
  const { uid } = usePortal();
  // Staff drafts are not yet the customer's business; they appear once submitted or sent.
  const q = useQuery<QuoteLite[]>(() => requireBackend().from("quotes").select(QUOTE_COLS).eq("customer_id", uid).neq("status", "draft").order("created_at", { ascending: false }).limit(200), [uid]);
  const waiting = q.data?.filter((x) => x.status === "sent" && !isExpired(x)).length ?? 0;
  return (
    <>
      <PortalHeader title="My Quotes" sub={waiting ? `${waiting} quotation${waiting === 1 ? " is" : "s are"} waiting for your decision.` : "Every request you have sent SPP, and every written quotation we have sent back."} actions={<Button href="/request-quote/" arrow>Request a quote</Button>} />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <RowsSkeleton rows={5} /> : q.data?.length === 0 ? (
        <EmptyState title="No quotes yet." body="Request a quote for any product, or straight from a saved design. SPP replies with a written quotation you can accept here." action={<Button href="/request-quote/" arrow>Request a quote</Button>} />
      ) : (
        <ul className="border-t border-ink-700">
          {q.data?.map((x) => {
            const expired = isExpired(x);
            return (
              <li key={x.id}>
                <RowLink href={`/account/quotes/?id=${x.id}`}>
                  {x.status === "sent" && !expired && <span aria-hidden className="h-2 w-2 flex-none bg-yellow" />}
                  <span className="min-w-0 flex-1">
                    <span className="t-data block truncate text-fog-50">{x.ref}</span>
                    <span className="block truncate text-sm text-fog-400">{x.kind === "reorder" ? "Reorder" : titleCase(x.kind)} · {formatDate(x.created_at)}{x.needed_by ? ` · needed ${formatDate(x.needed_by)}` : ""}</span>
                  </span>
                  <span className="hidden text-right sm:block">
                    {isPriced(x.status) && x.total_lak != null ? <span className="t-data block text-fog-50">{formatLak(x.total_lak)}</span>
                      : x.estimate_low_lak != null && x.estimate_high_lak != null ? <span className="t-data block text-sm text-fog-400">est. {formatLak(x.estimate_low_lak)} – {formatLak(x.estimate_high_lak)}</span>
                      : <span className="block text-sm text-fog-500">To be quoted</span>}
                  </span>
                  <StatusPill status={expired ? "expired" : x.status} />
                </RowLink>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

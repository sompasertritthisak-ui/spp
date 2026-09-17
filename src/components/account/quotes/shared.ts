import type { QuoteItemsRow, QuotesRow, QuoteStatus } from "@/lib/backend/db-types";

export const QUOTE_COLS = "id,ref,kind,status,needed_by,needs_design_help,customer_notes,estimate_low_lak,estimate_high_lak,total_lak,valid_until,terms,reorder_of,project_id,sent_at,decided_at,created_at";
export type QuoteLite = Pick<QuotesRow, "id" | "ref" | "kind" | "status" | "needed_by" | "needs_design_help" | "customer_notes" | "estimate_low_lak" | "estimate_high_lak" | "total_lak" | "valid_until" | "terms" | "reorder_of" | "project_id" | "sent_at" | "decided_at" | "created_at">;
export const QUOTE_ITEM_COLS = "id,quote_id,product_slug,product_name,design_id,design_version,qty,config,unit_price_lak,line_total_lak,note,sort";
export type QuoteItem = Pick<QuoteItemsRow, "id" | "quote_id" | "product_slug" | "product_name" | "design_id" | "design_version" | "qty" | "config" | "unit_price_lak" | "line_total_lak" | "note" | "sort">;

/** SPP's figures are shown only once the written quotation has been sent. Until then the customer sees the engine's estimate band. */
export const isPriced = (s: QuoteStatus) => s === "sent" || s === "accepted" || s === "declined" || s === "expired";

const today = () => new Date().toISOString().slice(0, 10);
export const isExpired = (q: Pick<QuotesRow, "status" | "valid_until">) => q.status === "expired" || (q.status === "sent" && Boolean(q.valid_until) && q.valid_until! < today());

export const QUOTE_NOTE: Record<QuoteStatus, string> = {
  draft: "SPP is preparing this quotation.",
  submitted: "Request received. SPP will review it and reply with a written quotation.",
  in_review: "SPP is reviewing your request and preparing the written quotation.",
  sent: "Your written quotation is ready. Accept it to go ahead, or decline it — either way, tell us what you think below.",
  accepted: "You accepted this quotation. SPP confirms the order next; it then appears under My Orders.",
  declined: "You declined this quotation. Message SPP below if you would like it revised.",
  expired: "This quotation has expired. Message SPP below and we will refresh it.",
};

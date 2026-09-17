"use client";
import { useRouter } from "next/navigation";
import { writeQuoteDraft, type QuoteDraft } from "./draft";

/** Hand a composed request to the quote builder. */
export function useStartQuote() {
  const router = useRouter();
  return (draft: QuoteDraft) => {
    writeQuoteDraft(draft);
    router.push("/request-quote/");
  };
}

import type { BillboardKind } from "@/content/types";

/**
 * Shared words for the outdoor network. Kept apart from the map library so the
 * admin editor can use them without pulling in the country geometry.
 */
export const KIND: Record<BillboardKind, { label: string; short: string; blurb: string }> = {
  static: { label: "Billboard", short: "BB", blurb: "Printed face on a fixed structure" },
  led: { label: "LED screen", short: "LED", blurb: "Digital screen — motion and shared airtime" },
};
export const KIND_ORDER: BillboardKind[] = ["static", "led"];
export const isKind = (v: string | null | undefined): v is BillboardKind => v === "static" || v === "led";

/** Suggested face materials. Free text is allowed; these are the ones SPP fits most often. */
export const MATERIALS = ["Die-cut vinyl", "Plastwood", "Flex banner", "Aluminium composite", "LED panel"] as const;

/** "1 year" / "3 years" */
export const years = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;

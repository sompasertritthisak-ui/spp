"use client";
import { useEffect, useRef, useState } from "react";
import { api, type Estimate } from "@/lib/backend/api";
import { BackendError } from "@/lib/backend/client";

export type EstimateRequest = { product: string; qty: number; options: Record<string, unknown> };
export type EstimateEntry =
  | { status: "loading" }
  | { status: "ready"; data: Estimate }
  | { status: "error"; message: string; code: BackendError["code"] };

export const estimateKey = (r: EstimateRequest) => `${r.product}|${r.qty}|${JSON.stringify(r.options)}`;

/**
 * Debounced, cached live estimates for any number of lines. Results are keyed
 * by product + quantity + options, so dragging a slider back to a previous
 * value costs nothing. Errors are cached too (so a rate limit is not hammered)
 * until retry() clears them.
 */
export function useEstimates(requests: EstimateRequest[], enabled: boolean) {
  const [cache, setCache] = useState<Record<string, EstimateEntry>>({});
  const [nonce, setNonce] = useState(0);
  const known = useRef(new Set<string>());
  const latest = useRef(requests);
  const keys = requests.map(estimateKey).join("\n");

  useEffect(() => { latest.current = requests; });

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      for (const r of latest.current) {
        const key = estimateKey(r);
        if (known.current.has(key) || r.qty < 1) continue;
        known.current.add(key);
        api.estimate(r.product, r.qty, r.options).then(
          (data) => setCache((c) => ({ ...c, [key]: { status: "ready", data } })),
          (e: unknown) => {
            const err = e instanceof BackendError ? e : new BackendError("We could not calculate an estimate just now.", "unknown");
            setCache((c) => ({ ...c, [key]: { status: "error", message: err.message, code: err.code } }));
          },
        );
      }
    }, 350);
    return () => clearTimeout(t);
  }, [keys, enabled, nonce]);

  const get = (r: EstimateRequest): EstimateEntry | null => (enabled ? cache[estimateKey(r)] ?? { status: "loading" } : null);
  const retry = () => {
    for (const [k, v] of Object.entries(cache)) if (v.status === "error") known.current.delete(k);
    setCache((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v.status !== "error")));
    setNonce((n) => n + 1);
  };
  return { get, retry };
}

/** Sum ready, priced lines into one band. `complete` is false when any line is unpriced, loading or failed. */
export function sumBand(entries: (EstimateEntry | null)[]) {
  let low = 0, high = 0, priced = 0;
  for (const e of entries) {
    if (e?.status === "ready" && e.data.mode !== "quote") { low += e.data.totalLow; high += e.data.totalHigh; priced += 1; }
  }
  return { low, high, priced, complete: priced === entries.length && entries.length > 0 };
}

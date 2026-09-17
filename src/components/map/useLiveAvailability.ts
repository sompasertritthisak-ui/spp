"use client";
import { useEffect, useState } from "react";
import type { BillboardStatus } from "@/content/types";
import { backend } from "@/lib/backend/client";

export type AvailabilityBlock = { startsOn: string; endsOn: string; kind: "booked" | "hold" | "maintenance" };
export type LiveSite = { status: BillboardStatus; availableFrom: string | null; blocks: AvailabilityBlock[] };
export type LiveState = { state: "static" | "loading" | "live"; byCode: Record<string, LiveSite> };

const STATUSES: readonly string[] = ["available", "reserved", "unavailable", "maintenance"];

/**
 * Pages are baked at build time, but availability moves between rebuilds. When
 * the back-end is configured, read the current status and the public date
 * blocks (RLS: published billboards, availability is world-readable) and let
 * the caller overlay them. Any failure leaves the build-time data in place.
 */
export function useLiveAvailability(only?: string): LiveState {
  const [live, setLive] = useState<LiveState>({ state: backend() ? "loading" : "static", byCode: {} });

  useEffect(() => {
    const b = backend();
    if (!b) return;
    let alive = true;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      try {
        let q = b.from("billboards").select("id,code,status,available_from");
        if (only) q = q.eq("code", only);
        const { data: rows, error } = await q;
        if (error || !rows?.length) throw new Error("no rows");
        const ids = rows.map((r) => r.id as string);
        const { data: blocks } = await b.from("billboard_availability").select("billboard_id,starts_on,ends_on,kind").in("billboard_id", ids).gte("ends_on", today).order("starts_on");
        const byCode: Record<string, LiveSite> = {};
        for (const r of rows) {
          if (!STATUSES.includes(r.status as string)) continue;
          byCode[r.code as string] = {
            status: r.status as BillboardStatus,
            availableFrom: (r.available_from as string | null) ?? null,
            blocks: (blocks ?? []).filter((k) => k.billboard_id === r.id).map((k) => ({ startsOn: k.starts_on as string, endsOn: k.ends_on as string, kind: k.kind as AvailabilityBlock["kind"] })),
          };
        }
        if (alive) setLive({ state: "live", byCode });
      } catch {
        if (alive) setLive({ state: "static", byCode: {} });
      }
    })();
    return () => { alive = false; };
  }, [only]);

  return live;
}

"use client";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { backend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { AppRole } from "@/lib/backend/db-types";

/** Admin pages render only behind the shell's auth gate, so the client exists. */
export const db = () => backend()!;

type Res<T> = { data: T | null; error: { message?: string; code?: string; hint?: string } | null };
export type Outcome<T> = { data: T | null; error: string | null };

/** Awaits a query/RPC and returns a message that is safe to show, never a raw SQL error. */
export async function exec<T>(q: PromiseLike<Res<T>>): Promise<Outcome<T>> {
  try {
    const r = await q;
    return r.error ? { data: null, error: toBackendError(r.error).message } : { data: r.data, error: null };
  } catch {
    return { data: null, error: "We could not reach the server. Check your connection and try again." };
  }
}

/** For `.update(…).select("id")` / `.delete().select("id")`: RLS refusing a row looks like "0 rows", not an error. */
export async function write<T>(q: PromiseLike<Res<T[]>>): Promise<Outcome<T[]>> {
  const r = await exec(q);
  if (!r.error && (!r.data || r.data.length === 0)) return { data: null, error: "Nothing was changed — your role may not be allowed to edit this record." };
  return r;
}

/** Query-string state (`?id=…&view=…`). Static export: records are addressed by query, never by path. */
export function useUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback((patch: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") p.delete(k); else p.set(k, v); }
    const base = pathname.endsWith("/") ? pathname : `${pathname}/`;
    const qs = p.toString();
    router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
  }, [params, router, pathname]);
  return { get: (k: string) => params.get(k), set };
}

export type StaffMember = { id: string; full_name: string; email: string; role: AppRole };
export function useStaff() {
  const q = useQuery<StaffMember[]>(() => db().from("profiles").select("id,full_name,email,role").neq("role", "customer").order("full_name"), []);
  const byId = useMemo(() => new Map((q.data ?? []).map((s) => [s.id, s])), [q.data]);
  const name = useCallback((id: string | null | undefined) => { if (!id) return "Unassigned"; const s = byId.get(id); return s ? s.full_name || s.email : "Former staff"; }, [byId]);
  return { staff: q.data ?? [], name };
}

/** Optimistic overlay on a fetched list: patch now, roll back if the server refuses. */
export function useOptimistic<T extends { id: string }>(rows: T[] | null) {
  const [over, setOver] = useState<Record<string, Partial<T>>>({});
  const merged = useMemo(() => rows?.map((r) => (over[r.id] ? { ...r, ...over[r.id] } : r)) ?? null, [rows, over]);
  const patch = useCallback((id: string, p: Partial<T>) => setOver((o) => ({ ...o, [id]: { ...o[id], ...p } })), []);
  const clear = useCallback((id: string) => setOver((o) => { const n = { ...o }; delete n[id]; return n; }), []);
  return { rows: merged, patch, clear };
}

/** One stable "now" per mount — render must stay pure. */
export function useNow() {
  const [now] = useState(() => Date.now());
  return now;
}
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const daysUntil = (iso: string | null | undefined, now: number) => (iso ? Math.round((new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${isoDay(now)}T00:00:00Z`).getTime()) / 864e5) : null);

export const likeTerm = (s: string) => `%${s.trim().replace(/[%_,()]/g, "")}%`;
export const num = (v: string) => { const n = Number(v.replace(/[,\s]/g, "")); return v.trim() === "" || !Number.isFinite(n) ? null : n; };
export type Contact = { name?: string; company?: string; email?: string; phone?: string; social?: string };
export const asContact = (j: unknown): Contact => (j && typeof j === "object" && !Array.isArray(j) ? (j as Contact) : {});

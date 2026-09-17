"use client";
import { useCallback, useEffect, useState } from "react";
import { backend } from "@/lib/backend/client";
import { useAuth } from "@/lib/backend/auth";
import { adminError } from "../resource/errors";

export type PublishEntry = { at: string; by: string | null; by_name: string; ok?: boolean; message?: string };
export type PublishState = { loading: boolean; error: string | null; last: PublishEntry | null; history: PublishEntry[]; latestChange: { at: string; table: string } | null; pending: boolean };

/* Tables whose published rows are baked into the static site. The second list
   only gains `updated_at` with migration 0012 — a missing column is skipped. */
const TRACKED = ["products", "bundles", "billboards", "portfolio_projects", "blog_posts", "design_templates", "pages", "campaigns", "feature_flags"] as const;
const TRACKED_0012 = ["categories", "services", "solutions", "faqs", "testimonials", "team_members", "page_sections", "bundle_items", "product_variants"] as const;
const LABEL: Record<string, string> = { portfolio_projects: "portfolio", blog_posts: "journal", design_templates: "design templates", feature_flags: "feature flags", team_members: "team", page_sections: "page sections", bundle_items: "bundles", product_variants: "product variants", settings: "site settings", media: "media" };

async function latestChange(isAdmin: boolean): Promise<PublishState["latestChange"]> {
  const b = backend()!;
  const probes: Promise<{ at: string; table: string } | null>[] = [...TRACKED, ...TRACKED_0012].map(async (t) => {
    const r = await b.from(t).select("updated_at").order("updated_at", { ascending: false }).limit(1);
    const at = r.error ? null : (r.data?.[0] as { updated_at?: string } | undefined)?.updated_at;
    return at ? { at, table: t } : null;
  });
  probes.push((async () => { const r = await b.from("settings").select("updated_at").eq("key", "site").maybeSingle(); return r.data?.updated_at ? { at: r.data.updated_at as string, table: "settings" } : null; })());
  // Admins can read the audit log, which also catches deletions and tables without updated_at.
  if (isAdmin) probes.push((async () => {
    const r = await b.from("audit_log").select("at,entity").in("entity", [...TRACKED, ...TRACKED_0012, "media", "product_media", "product_relations", "billboard_media", "billboard_availability"]).order("at", { ascending: false }).limit(1);
    const row = r.data?.[0] as { at: string; entity: string } | undefined;
    return row ? { at: row.at, table: row.entity } : null;
  })());
  const found = (await Promise.all(probes)).filter((x): x is { at: string; table: string } => x !== null);
  const top = found.sort((a, z) => z.at.localeCompare(a.at))[0] ?? null;
  return top ? { at: top.at, table: LABEL[top.table] ?? top.table } : null;
}

async function fetchState(isAdmin: boolean): Promise<PublishState> {
  const blank: PublishState = { loading: false, error: null, last: null, history: [], latestChange: null, pending: false };
  const b = backend();
  if (!b) return blank;
  const [s, change] = await Promise.all([b.from("settings").select("key,value").in("key", ["last_publish", "publish_history"]), latestChange(isAdmin)]);
  if (s.error) return { ...blank, error: adminError(s.error) };
  const get = (k: string) => (s.data as { key: string; value: unknown }[]).find((r) => r.key === k)?.value;
  const last = (get("last_publish") as PublishEntry | undefined) ?? null;
  const history = Array.isArray(get("publish_history")) ? (get("publish_history") as PublishEntry[]) : [];
  return { ...blank, last, history, latestChange: change, pending: Boolean(change && (!last?.at || new Date(change.at) > new Date(last.at))) };
}

export function usePublishState() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const [state, setState] = useState<PublishState>({ loading: true, error: null, last: null, history: [], latestChange: null, pending: false });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void fetchState(isAdmin).then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [isAdmin, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export type PublishResult = { ok: boolean; message: string; recordWarning: string | null };

/** Pulls the Edge Function's own `{ message }` out of a non-2xx response where there is one. */
async function functionError(error: { message?: string; context?: unknown }): Promise<string> {
  const ctx = error.context as { status?: number; json?: () => Promise<unknown> } | undefined;
  if (ctx?.status === 404) return "The “publish” Edge Function is not deployed yet (supabase/functions/publish). Nothing was rebuilt.";
  if (typeof ctx?.json === "function") {
    try { const body = (await ctx.json()) as { message?: string; error?: string } | null; const m = body?.message ?? body?.error; if (m) return String(m).slice(0, 400); } catch { /* not JSON */ }
  }
  if (ctx?.status === 401 || ctx?.status === 403) return "The publish function refused this account. Ask an administrator to check your role.";
  if (/fetch|network|Failed to send/i.test(error.message ?? "")) return "The publish function could not be reached. It may not be deployed yet, or the connection dropped. Nothing was rebuilt.";
  return "The publish function returned an error and did not say why. Nothing was rebuilt.";
}

async function record(ok: boolean, message: string, who: { id: string; name: string } | null): Promise<string | null> {
  const b = backend()!;
  const rpc = await b.rpc("record_publish", { p_ok: ok, p_message: message });
  if (!rpc.error) return null;
  const missing = rpc.error.code === "PGRST202" || rpc.error.code === "42883";
  if (!missing) return `The publish log could not be updated: ${adminError(rpc.error)}`;
  // Migration 0012 not applied yet → write the settings rows directly (admins only under RLS).
  const entry: PublishEntry = { at: new Date().toISOString(), by: who?.id ?? null, by_name: who?.name ?? "", ok, message: message.slice(0, 500) };
  const prev = await b.from("settings").select("value").eq("key", "publish_history").maybeSingle();
  const history = [entry, ...(Array.isArray(prev.data?.value) ? (prev.data.value as PublishEntry[]) : [])].slice(0, 25);
  const writes = [b.from("settings").upsert({ key: "publish_history", value: history, is_public: false, updated_by: who?.id ?? null })];
  if (ok) writes.push(b.from("settings").upsert({ key: "last_publish", value: { at: entry.at, by: entry.by, by_name: entry.by_name }, is_public: false, updated_by: who?.id ?? null }));
  const failed = (await Promise.all(writes)).find((w) => w.error);
  return failed ? "The publish time could not be recorded for your role until database migration 0012 is applied, so “Unpublished changes” may stay on." : null;
}

export async function publishSite(who: { id: string; name: string } | null): Promise<PublishResult> {
  const b = backend();
  if (!b) return { ok: false, message: "The back-end is not connected.", recordWarning: null };
  let ok = false;
  let message: string;
  try {
    const { data, error } = await b.functions.invoke("publish", { body: { source: "command-center" } });
    if (error) message = await functionError(error as { message?: string; context?: unknown });
    else {
      const d = (typeof data === "string" ? safeJson(data) : data) as { ok?: unknown; message?: unknown } | null;
      ok = d?.ok === true;
      message = typeof d?.message === "string" && d.message ? d.message.slice(0, 400) : ok ? "Site build started." : "The publish function answered, but did not confirm that a build started.";
    }
  } catch {
    message = "The publish function could not be reached. Nothing was rebuilt.";
  }
  return { ok, message, recordWarning: await record(ok, message, who) };
}

const safeJson = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };

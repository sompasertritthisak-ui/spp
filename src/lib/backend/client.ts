"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { backendConfigured, env } from "../env";

/**
 * The ONLY place the app touches the back-end provider. Everything else goes
 * through src/lib/backend/api.ts, so replacing Supabase (should its domain
 * prove unreachable from Laos) means rewriting this folder and nothing else.
 */
let client: SupabaseClient | null = null;

export function backend(): SupabaseClient | null {
  if (!backendConfigured) return null;
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "spp.auth" },
  });
  return client;
}

export class BackendError extends Error {
  constructor(message: string, public code: "not_configured" | "rate_limited" | "forbidden" | "invalid" | "not_found" | "network" | "unknown" = "unknown") {
    super(message);
  }
}

/** Translate provider errors into messages that are safe and useful to show. */
export function toBackendError(e: { message?: string; code?: string; hint?: string } | null | undefined): BackendError {
  const msg = e?.message ?? "";
  if (/rate_limited/.test(msg)) return new BackendError(e?.hint || "Too many requests. Please try again in a few minutes.", "rate_limited");
  if (e?.code === "42501" || /forbidden|row-level security|permission denied/i.test(msg)) return new BackendError("You do not have permission to do that.", "forbidden");
  if (e?.code === "22023") return new BackendError(msg, "invalid"); // our own require() messages — written for customers
  if (e?.code === "P0002" || /not found/i.test(msg)) return new BackendError("We could not find that.", "not_found");
  if (/fetch|network|Failed to/i.test(msg)) return new BackendError("We could not reach the server. Check your connection and try again.", "network");
  return new BackendError("Something went wrong behind the scenes. Please try again.", "unknown");
}

export function requireBackend(): SupabaseClient {
  const b = backend();
  if (!b) throw new BackendError("Online requests are not switched on yet. Please contact SPP directly.", "not_configured");
  return b;
}

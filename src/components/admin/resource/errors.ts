import { toBackendError } from "@/lib/backend/client";

export type RawError = { message?: string; code?: string; hint?: string; details?: string } | null | undefined;

/**
 * Staff-facing error text. Constraint failures are an everyday part of
 * editing, so they get a useful sentence rather than the generic fallback —
 * still without leaking SQL. Everything else defers to toBackendError().
 */
export function adminError(e: RawError): string {
  if (!e) return "Something went wrong behind the scenes. Please try again.";
  if (e.code === "23505") return "That value is already in use — slugs, codes and SKUs must be unique.";
  if (e.code === "23503") return "This record is still linked to other records, so that change is not allowed.";
  if (e.code === "23514") return /consent/i.test(e.message ?? "") || /testimonials/i.test(e.message ?? "") ? "A testimonial can only be published once consent is recorded." : "The database rejected one of the values (it is outside the allowed range).";
  if (e.code === "23502") return "A required value is missing.";
  if (e.code === "22P02" || e.code === "22007") return "One of the values has the wrong format.";
  if (e.code === "PGRST202" || e.code === "42883") return "That server function is not installed yet. Ask an administrator to apply the latest database migrations.";
  return toBackendError(e).message;
}

/** Unwraps a Supabase `{ data, error }` result, throwing a readable Error. */
export function unwrap<T>(r: { data: T | null; error: RawError }): T {
  if (r.error) throw new Error(adminError(r.error));
  return r.data as T;
}

export const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong behind the scenes. Please try again.");

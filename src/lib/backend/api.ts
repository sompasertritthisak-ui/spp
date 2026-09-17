"use client";
import { z } from "zod";
import { requireBackend, toBackendError } from "./client";
import { sessionId } from "./session";

/* ── Shared validation (mirrors the SQL rules; the database is the authority) ── */
export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Please tell us your name.").max(120),
    company: z.string().trim().max(160).optional().default(""),
    email: z.union([z.literal(""), z.email("That email address does not look right.")]).optional().default(""),
    phone: z.union([z.literal(""), z.string().trim().regex(/^[0-9+()\-\s]{6,40}$/, "That phone number does not look right.")]).optional().default(""),
  })
  .refine((c) => c.email || c.phone, { message: "Please give us an email or a phone number.", path: ["email"] });
export type Contact = z.infer<typeof contactSchema>;

export type QuoteItemInput = { product: string; qty: number; designRef?: string; note?: string; config?: Record<string, unknown> };
export type Estimate =
  | { mode: "quote"; moq: number; belowMoq: boolean }
  | { mode: "estimated" | "fixed"; moq: number; belowMoq: boolean; currency: "LAK"; unitLow: number; unitHigh: number; totalLow: number; totalHigh: number; lines: { label: string }[]; disclaimer: string };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireBackend().rpc(fn, args);
  if (error) throw toBackendError(error);
  return data as T;
}

export const api = {
  estimate: (product: string, qty: number, options: Record<string, unknown> = {}) => rpc<Estimate>("estimate_price", { product_slug: product, qty, options }),

  submitContact: (p: { contact: Contact; message: string; consent: boolean; website?: string }) =>
    rpc<{ ref: string }>("submit_contact", { payload: { ...p, path: location.pathname } }),

  submitQuote: (p: { kind?: "product" | "project" | "bundle" | "campaign"; contact: Contact; items: QuoteItemInput[]; neededBy?: string; notes?: string; needsDesignHelp?: boolean; consent?: boolean; project?: Record<string, unknown>; source?: string; website?: string }) =>
    rpc<{ ref: string; leadRef: string; estimateLow: number | null; estimateHigh: number | null }>("submit_quote", { payload: { ...p, sessionId: sessionId() } }),

  submitConsultation: (p: { contact: Contact; topic: string; goal: string; durationMins: 15 | 30 | 45 | 60; preferredAt: string; alternativeAt?: string; channel: string; info?: string; consent?: boolean; website?: string }) =>
    rpc<{ ref: string }>("submit_consultation", { payload: p }),

  submitBooking: (p: { contact: Contact; billboard: string; startsOn: string; endsOn: string; artworkAssetId?: string; needsDesign: boolean; needsPrintInstall: boolean; notes?: string; consent?: boolean; website?: string }) =>
    rpc<{ ref: string; possibleClash: boolean; message: string }>("submit_booking", { payload: { ...p, sessionId: sessionId() } }),

  trackQr: (code: string) => rpc<{ destination: string; campaign?: string; code?: string }>("track_qr_scan", { qr_code: code, session: sessionId(), ua: navigator.userAgent.slice(0, 40), ref: document.referrer.slice(0, 200) }),
  sharedDesign: (token: string) => rpc<Record<string, unknown> | null>("get_shared_design", { token }),
};

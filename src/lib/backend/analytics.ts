"use client";
import { backend } from "./client";
import { sessionId } from "./session";

export type EventName =
  | "page_view" | "product_view" | "customizer_started" | "design_created" | "design_saved" | "mockup_downloaded"
  | "artwork_uploaded" | "quote_started" | "quote_requested" | "project_builder_started" | "project_builder_completed"
  | "billboard_viewed" | "billboard_booking_started" | "billboard_booking_requested" | "consultation_requested"
  | "contact_submitted" | "whatsapp_click" | "ai_assist_used" | "qr_landing" | "bundle_viewed" | "reorder_requested";

type Extra = { product?: string; ref?: string; step?: string; source?: string; value?: number };

/** Fire-and-forget. Analytics must never break or slow a customer journey. */
export function track(name: EventName, extra: Extra = {}) {
  const b = backend();
  if (!b || typeof window === "undefined") return;
  if (navigator.doNotTrack === "1") return;
  const source = extra.source ?? new URLSearchParams(location.search).get("utm_source") ?? sessionStorage.getItem("spp.src") ?? undefined;
  void b.rpc("track_event", { payload: { sessionId: sessionId(), name, path: location.pathname, ...extra, source } }).then(() => {}, () => {});
}

type Flow = "design" | "quote" | "billboard_booking" | "project_builder";

/** Record progress through a high-intent flow so SPP can see where people stop.
 *  An email is only ever sent when the visitor ticked the recovery-consent box. */
export function recordIntent(flow: Flow, stage: string, extra: { product?: string; ref?: string; email?: string; recoveryConsent?: boolean } = {}) {
  const b = backend();
  if (!b || typeof window === "undefined" || navigator.doNotTrack === "1") return;
  void b.rpc("record_intent", { payload: { sessionId: sessionId(), flow, stage, resumeHref: location.pathname + location.search, ...extra } }).then(() => {}, () => {});
}

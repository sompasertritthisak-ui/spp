"use client";
/** First-party, cookieless visitor session id. Random, per-browser, holds no
 *  personal data; used to stitch funnel events and abandoned-flow recovery. */
const KEY = "spp.sid";

export function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "nostorage";
  }
}

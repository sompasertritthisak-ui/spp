/**
 * Open-redirect guard for `?next=`. Only same-origin, root-relative paths are
 * honoured; anything else (absolute URLs, protocol-relative `//host`, the
 * backslash variants browsers normalise to `//`, control characters) falls
 * back to the default destination.
 */
const PROBE = "https://spp.invalid";

export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if ([...raw].some((ch) => ch.charCodeAt(0) < 32)) return null;
  try {
    const u = new URL(raw, PROBE);
    if (u.origin !== PROBE) return null;
    // never bounce back into the auth pages themselves
    if (/^\/(login|register)\/?$/.test(u.pathname)) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export const homeFor = (isStaff: boolean) => (isStaff ? "/admin/dashboard/" : "/account/");

/** Details the sign-up form collects that Auth cannot store. Applied to the
 *  customer's own rows on their first portal visit. Never holds a password. */
const PENDING_KEY = "spp.signup.pending";
export type PendingSignup = { email: string; company: string; marketing: boolean };

export function stashPendingSignup(p: PendingSignup) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* storage unavailable: nothing to carry over */ }
}
export function readPendingSignup(): PendingSignup | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PendingSignup>;
    return typeof v.email === "string" ? { email: v.email, company: typeof v.company === "string" ? v.company.slice(0, 160) : "", marketing: v.marketing === true } : null;
  } catch {
    return null;
  }
}
export function clearPendingSignup() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* nothing to clear */ }
}

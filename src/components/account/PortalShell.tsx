"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { clearPendingSignup, readPendingSignup } from "@/components/auth/safe-next";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { useAuth, type Profile } from "@/lib/backend/auth";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { portalNav } from "./portal-nav";

export type PortalContact = { email: string; phone: string; whatsapp: string };
type PortalCtx = { uid: string; profile: Profile; contact: PortalContact; unread: number; reloadUnread: () => void };
const Ctx = createContext<PortalCtx | null>(null);
export const usePortal = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortal outside <PortalShell>");
  return v;
};

function Notice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="shell flex min-h-[60dvh] flex-col items-start justify-center gap-5 py-16">
      <span aria-hidden className="reg h-6 w-6 text-yellow" />
      <h1 className="t-title max-w-2xl text-fog-50">{title}</h1>
      <p className="max-w-xl text-fog-400">{body}</p>
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

export function PortalShell({ contact, portalEnabled, children }: { contact: PortalContact; portalEnabled: boolean; children: ReactNode }) {
  const { ready, configured, user, isGuest, profile, isStaff, refreshProfile } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const signedIn = Boolean(user && !isGuest);
  const uid = signedIn ? user!.id : null;

  useEffect(() => {
    if (!ready || !configured || signedIn) return;
    const search = typeof window === "undefined" ? "" : window.location.search;
    router.replace(`/login/?next=${encodeURIComponent(`${path}${search}`)}`);
  }, [ready, configured, signedIn, path, router]);

  // The flag baked in at build time is the default; the live table wins so SPP can switch the portal without a deploy.
  const flag = useQuery<{ enabled: boolean } | null>(() => requireBackend().from("feature_flags").select("enabled").eq("key", "CUSTOMER_PORTAL").maybeSingle(), [], { enabled: configured });
  const enabled = flag.data ? flag.data.enabled : portalEnabled;

  const unreadQ = useQuery<{ id: string }[]>(() => requireBackend().from("notifications").select("id").eq("user_id", uid!).is("read_at", null).limit(100), [uid, path], { enabled: Boolean(uid) });
  const unread = unreadQ.data?.length ?? 0;

  // Company + marketing consent captured at sign-up are applied once, to the customer's own rows.
  const applied = useRef(false);
  useEffect(() => {
    if (!uid || !profile || applied.current) return;
    applied.current = true;
    const pending = readPendingSignup();
    if (!pending) return;
    if (profile.email && pending.email !== profile.email.toLowerCase()) return; // someone else's sign-up on a shared device
    const b = requireBackend();
    void (async () => {
      if (pending.marketing) await b.from("profiles").update({ marketing_consent: true }).eq("id", uid);
      if (pending.company) {
        const { data } = await b.from("brand_profiles").select("id").eq("owner_id", uid).maybeSingle();
        if (!data) await b.from("brand_profiles").insert({ owner_id: uid, brand_name: pending.company });
      }
      clearPendingSignup();
      void refreshProfile();
    })().catch(() => {});
  }, [uid, profile, refreshProfile]);

  const value = useMemo<PortalCtx | null>(() => (uid && profile ? { uid, profile, contact, unread, reloadUnread: unreadQ.reload } : null), [uid, profile, contact, unread, unreadQ.reload]);
  const active = (href: string) => (href === "/account/" ? path === "/account/" || path === "/account" : path.startsWith(href));

  if (!configured)
    return (
      <Notice title="Accounts are not switched on yet." body="My SPP — saved designs, quotes, orders and reorders — opens once SPP connects its customer system. You can still start a project today and we will reply personally.">
        <Button href="/request-quote/" arrow>Request a quote</Button>
        <Button href="/contact/" variant="outline">Contact SPP</Button>
      </Notice>
    );
  if (!ready || !value) return <div className="flex min-h-[70dvh] items-center justify-center" aria-busy="true" aria-label="Loading My SPP"><Logo animate className="h-8" /></div>;
  if (!enabled && !isStaff)
    return (
      <Notice title="My SPP is paused for the moment." body="SPP has temporarily switched the customer portal off. Your designs, quotes and orders are safe and will be here when it returns. For anything urgent, contact the team directly.">
        <Button href="/contact/" arrow>Contact SPP</Button>
        <Button href="/" variant="outline">Back to the site</Button>
      </Notice>
    );

  return (
    <Ctx.Provider value={value}>
      <div className="shell grid gap-x-12 pb-20 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:pb-28">
        <aside className="lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:self-start">
          <p className="t-label flex items-center gap-3 py-5 text-fog-500"><span aria-hidden className="reg text-yellow" />My SPP</p>
          <nav aria-label="My SPP" className="thin-scroll -mx-[var(--gutter)] mb-8 overflow-x-auto border-y border-ink-700 px-[var(--gutter)] lg:mx-0 lg:overflow-visible lg:border-y-0 lg:border-t lg:px-0">
            <ul className="flex gap-1 lg:flex-col lg:gap-0">
              {portalNav.map((l) => (
                <li key={l.href} className="flex-none">
                  <Link href={l.href} aria-current={active(l.href) ? "page" : undefined} className={clsx("t-label flex min-h-12 items-center gap-2 whitespace-nowrap border-b-2 px-3 transition-colors lg:border-b lg:border-l-2 lg:border-b-ink-700 lg:px-4", active(l.href) ? "border-yellow text-fog-50 lg:border-l-yellow" : "border-transparent text-fog-400 hover:text-fog-50 lg:border-l-transparent")}>
                    {l.label}
                    {l.href === "/account/notifications/" && unread > 0 && <span className="t-data bg-yellow px-1.5 text-[0.625rem] leading-4 text-ink-950"><span className="sr-only">unread: </span>{unread > 99 ? "99+" : unread}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {isStaff && (
            <Link href="/admin/dashboard/" className="t-label mb-8 flex min-h-11 items-center justify-between gap-3 border border-ink-600 px-4 text-fog-300 transition-colors hover:border-yellow hover:text-yellow">
              Command Center<span aria-hidden>→</span>
            </Link>
          )}
        </aside>
        <div className="min-w-0 lg:pt-5">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

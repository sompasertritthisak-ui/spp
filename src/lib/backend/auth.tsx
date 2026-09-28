"use client";
import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { backend, BackendError, toBackendError } from "./client";

/** `staff` = a role created by the super admin; what it may do comes from `access`, never from this value. */
export type Role = "super_admin" | "admin" | "sales" | "designer" | "production" | "marketing" | "staff" | "customer";
export type Profile = { id: string; email: string; full_name: string; phone: string; role: Role; company_id: string | null };
export type CapLevel = "view" | "edit";
/** What the signed-in person may do — the answer of the SQL function my_access(). */
export type Access = { role: { key: string; name: string; rank: number; colour: string | null } | null; caps: Record<string, CapLevel>; superAdmin: boolean };

type AuthState = {
  ready: boolean;
  configured: boolean;
  user: User | null;
  /** true for visitors holding an anonymous Studio session (not a real account) */
  isGuest: boolean;
  profile: Profile | null;
  isStaff: boolean;
  /** Role, rank and capabilities as the database sees them. Empty for customers and guests. */
  access: Access;
  /** May SEE the domain (view or edit) — mirrors SQL can(). */
  can: (domain: string) => boolean;
  /** May CHANGE the domain (edit) — mirrors SQL can_write(). */
  canWrite: (domain: string) => boolean;
  /** Holds edit on at least one domain: may post notes, messages and files — mirrors SQL staff_can_write(). */
  canWriteAny: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (p: { email: string; password: string; fullName: string; phone?: string }) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  /** Guarantees a session so a visitor can save designs and upload artwork
   *  before creating an account. Guest work carries over on sign-up. */
  ensureSession: () => Promise<User>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside <AuthProvider>");
  return v;
};

/* Capabilities ONLY decide what to render. Every real permission is enforced
   again by Postgres: RLS, the write guards and the RPCs (see supabase/migrations). */
const NO_ACCESS: Access = { role: null, caps: {}, superAdmin: false };
export const GRANTABLE_DOMAINS = ["content", "catalogue", "pricing", "sales", "designs", "production", "billboards", "campaigns", "analytics", "finance", "settings", "team"] as const;
export type Domain = (typeof GRANTABLE_DOMAINS)[number];

/** The permissions the six original roles were seeded with. Used only while the
 *  database cannot answer my_access() (migration 0024 not applied yet, or the
 *  request failed) so the Command Center still opens; the database decides. */
const SEEDED: Record<string, { name: string; rank: number; domains: readonly string[] }> = {
  super_admin: { name: "Super admin", rank: 100, domains: [...GRANTABLE_DOMAINS, "security"] },
  admin: { name: "Admin", rank: 90, domains: GRANTABLE_DOMAINS },
  marketing: { name: "Content manager", rank: 60, domains: ["content", "catalogue", "billboards", "campaigns", "analytics"] },
  sales: { name: "Sales", rank: 60, domains: ["catalogue", "sales", "designs", "billboards", "analytics", "finance"] },
  designer: { name: "Designer", rank: 50, domains: ["designs", "production"] },
  production: { name: "Production", rank: 50, domains: ["production"] },
};
export const seededAccess = (role: Role): Access => {
  const s = SEEDED[role];
  return s ? { role: { key: role, name: s.name, rank: s.rank, colour: null }, caps: Object.fromEntries(s.domains.map((d) => [d, "edit" as const])), superAdmin: role === "super_admin" } : NO_ACCESS;
};
const parseAccess = (v: unknown): Access | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as { role?: unknown; caps?: unknown; superAdmin?: unknown };
  const r = o.role as { key?: unknown; name?: unknown; rank?: unknown; colour?: unknown } | null | undefined;
  const caps: Record<string, CapLevel> = {};
  if (o.caps && typeof o.caps === "object") for (const [k, l] of Object.entries(o.caps as Record<string, unknown>)) if (l === "view" || l === "edit") caps[k] = l;
  return {
    role: r && typeof r.key === "string" && typeof r.name === "string" ? { key: r.key, name: r.name, rank: typeof r.rank === "number" ? r.rank : 0, colour: typeof r.colour === "string" ? r.colour : null } : null,
    caps,
    superAdmin: o.superAdmin === true,
  };
};
const level = (a: Access, domain: string): CapLevel | null => (a.superAdmin ? "edit" : domain === "security" ? null : a.caps[domain] ?? null);

// canDo() is called from render with the profile out of useAuth(), so it always
// runs after the provider has stored the access that belongs to that profile.
let current: Access = NO_ACCESS;
/** Compatibility wrapper for `canDo(profile?.role, domain)`: true when the signed-in
 *  person may SEE the domain. New code uses `can` / `canWrite` from useAuth(). */
export const canDo = (role: Role | undefined, domain: string) => !!role && role !== "customer" && level(current, domain) !== null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const b = backend();
  const [ready, setReady] = useState(!b);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [access, setAccess] = useState<Access>(NO_ACCESS);

  // Profile and access are stored together, so no screen renders a staff
  // profile against the capabilities of whoever was signed in before.
  const loadProfile = useCallback(async (u: User | null) => {
    const store = (p: Profile | null, a: Access) => { current = a; setAccess(a); setProfile(p); };
    if (!b || !u) return store(null, NO_ACCESS);
    const { data } = await b.from("profiles").select("id,email,full_name,phone,role,company_id").eq("id", u.id).maybeSingle();
    const p = (data as Profile | null) ?? null;
    if (!p || p.role === "customer") return store(p, NO_ACCESS);
    const r = await b.rpc("my_access");
    store(p, (r.error ? null : parseAccess(r.data)) ?? seededAccess(p.role));
  }, [b]);

  useEffect(() => {
    if (!b) return;
    let alive = true;
    b.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      await loadProfile(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = b.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      // defer: supabase-js forbids awaiting its own client inside this callback
      setTimeout(() => void loadProfile(session?.user ?? null), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [b, loadProfile]);

  const value = useMemo<AuthState>(() => {
    const need = () => { if (!b) throw new BackendError("Accounts are not switched on yet.", "not_configured"); return b; };
    return {
      ready, configured: Boolean(b), user, profile,
      isGuest: Boolean(user?.is_anonymous),
      isStaff: Boolean(profile && profile.role !== "customer"),
      access,
      can: (domain) => level(access, domain) !== null,
      canWrite: (domain) => level(access, domain) === "edit",
      canWriteAny: access.superAdmin || Object.values(access.caps).includes("edit"),
      signIn: async (email, password) => {
        const { error } = await need().auth.signInWithPassword({ email, password });
        if (error) throw new BackendError(/invalid/i.test(error.message) ? "That email and password do not match." : /confirm/i.test(error.message) ? "Please confirm your email address first — check your inbox." : toBackendError(error).message, "invalid");
      },
      signUp: async ({ email, password, fullName, phone }) => {
        const c = need();
        const meta = { full_name: fullName, phone: phone ?? "" };
        // A guest who has been designing keeps their work: upgrade the same user id.
        if (user?.is_anonymous) {
          const exists = (m: string) => /registered|exists|already/i.test(m);
          // Supabase only lets a guest set a password once the email is verified. Try the one-step
          // upgrade; if it is refused, link the email alone and let the confirmation link land on the
          // set-password screen. Either way the user id — and every saved design — is kept.
          const one = await c.auth.updateUser({ email, password, data: meta }, { emailRedirectTo: `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/account/` });
          if (!one.error) return { needsConfirmation: true };
          if (exists(one.error.message)) throw new BackendError("An account with that email already exists. Try signing in.", "invalid");
          const two = await c.auth.updateUser({ email, data: meta }, { emailRedirectTo: `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/login/?reset=1` });
          if (two.error) throw new BackendError(exists(two.error.message) ? "An account with that email already exists. Try signing in." : toBackendError(two.error).message, "invalid");
          return { needsConfirmation: true };
        }
        const { data, error } = await c.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/account/` } });
        if (error) throw new BackendError(/registered|exists/i.test(error.message) ? "An account with that email already exists. Try signing in." : /password/i.test(error.message) ? error.message : toBackendError(error).message, "invalid");
        return { needsConfirmation: !data.session };
      },
      signOut: async () => { await need().auth.signOut(); current = NO_ACCESS; setAccess(NO_ACCESS); setProfile(null); },
      sendReset: async (email) => {
        const { error } = await need().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/login/?reset=1` });
        if (error) throw toBackendError(error);
      },
      ensureSession: async () => {
        const c = need();
        const { data } = await c.auth.getSession();
        if (data.session?.user) return data.session.user;
        const { data: anon, error } = await c.auth.signInAnonymously();
        if (error || !anon.user) throw new BackendError("We could not start a guest session. Please sign in to save your work.", "forbidden");
        return anon.user;
      },
      refreshProfile: () => loadProfile(user),
    };
  }, [b, ready, user, profile, access, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

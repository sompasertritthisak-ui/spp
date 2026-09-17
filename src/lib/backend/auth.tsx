"use client";
import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { backend, BackendError, toBackendError } from "./client";

export type Role = "super_admin" | "admin" | "sales" | "designer" | "production" | "marketing" | "customer";
export type Profile = { id: string; email: string; full_name: string; phone: string; role: Role; company_id: string | null };

type AuthState = {
  ready: boolean;
  configured: boolean;
  user: User | null;
  /** true for visitors holding an anonymous Studio session (not a real account) */
  isGuest: boolean;
  profile: Profile | null;
  isStaff: boolean;
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

/** UI-level capability map. This ONLY decides what to render. Every real
 *  permission is enforced again by Postgres RLS (see supabase/migrations). */
const CAPS: Record<string, Role[]> = {
  content: ["admin", "marketing"], catalogue: ["admin", "marketing", "sales"], pricing: ["admin"], sales: ["admin", "sales"],
  designs: ["admin", "sales", "designer"], production: ["admin", "production", "designer"], billboards: ["admin", "sales", "marketing"],
  campaigns: ["admin", "marketing"], analytics: ["admin", "marketing", "sales"], settings: ["admin"], security: [],
};
export const canDo = (role: Role | undefined, domain: keyof typeof CAPS | string) => role === "super_admin" || (!!role && (CAPS[domain] ?? []).includes(role));

export function AuthProvider({ children }: { children: ReactNode }) {
  const b = backend();
  const [ready, setReady] = useState(!b);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!b || !u) return setProfile(null);
    const { data } = await b.from("profiles").select("id,email,full_name,phone,role,company_id").eq("id", u.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
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
      signIn: async (email, password) => {
        const { error } = await need().auth.signInWithPassword({ email, password });
        if (error) throw new BackendError(/invalid/i.test(error.message) ? "That email and password do not match." : /confirm/i.test(error.message) ? "Please confirm your email address first — check your inbox." : toBackendError(error).message, "invalid");
      },
      signUp: async ({ email, password, fullName, phone }) => {
        const c = need();
        const meta = { full_name: fullName, phone: phone ?? "" };
        // A guest who has been designing keeps their work: upgrade the same user id.
        if (user?.is_anonymous) {
          const { error } = await c.auth.updateUser({ email, password, data: meta });
          if (error) throw new BackendError(/registered|exists/i.test(error.message) ? "An account with that email already exists. Try signing in." : toBackendError(error).message, "invalid");
          return { needsConfirmation: true };
        }
        const { data, error } = await c.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/account/` } });
        if (error) throw new BackendError(/registered|exists/i.test(error.message) ? "An account with that email already exists. Try signing in." : /password/i.test(error.message) ? error.message : toBackendError(error).message, "invalid");
        return { needsConfirmation: !data.session };
      },
      signOut: async () => { await need().auth.signOut(); setProfile(null); },
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
  }, [b, ready, user, profile, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

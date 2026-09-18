"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackendError, toBackendError } from "./client";

type State<T> = { data: T | null; loading: boolean; error: string | null };

/**
 * Minimal async-data hook for the portal and Command Center.
 *   const leads = useQuery(() => db().from("leads").select("*").order("created_at", { ascending: false }), []);
 * Accepts anything returning { data, error } (a Supabase query) or a plain promise.
 */
export function useQuery<T>(run: () => PromiseLike<{ data: T | null; error: unknown } | T>, deps: unknown[], opts: { enabled?: boolean } = {}) {
  const [state, setState] = useState<State<T>>({ data: null, loading: opts.enabled !== false, error: null });
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; });
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await runRef.current();
      if (id !== seq.current) return;
      if (r && typeof r === "object" && "error" in r && "data" in r) {
        const q = r as { data: T | null; error: { message?: string; code?: string } | null };
        if (q.error) throw toBackendError(q.error);
        setState({ data: q.data, loading: false, error: null });
      } else setState({ data: r as T, loading: false, error: null });
    } catch (e) {
      if (id !== seq.current) return;
      setState({ data: null, loading: false, error: e instanceof BackendError ? e.message : "Something went wrong behind the scenes." });
    }
  }, []);

  useEffect(() => {
    if (opts.enabled === false) return;
    // deferred a tick: keeps state updates out of the effect body and collapses StrictMode's double run
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, opts.enabled, ...deps]);

  return { ...state, reload };
}

/** Wraps a mutation with pending/error state. Resolves to the result, or null when it failed. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => PromiseLike<{ data?: R | null; error: unknown } | R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (...args: A): Promise<R | null | true> => {
    setPending(true);
    setError(null);
    try {
      const r = await fn(...args);
      if (r && typeof r === "object" && "error" in r) {
        const q = r as { data?: R | null; error: { message?: string; code?: string } | null };
        if (q.error) throw toBackendError(q.error);
        return q.data ?? true;
      }
      return r as R;
    } catch (e) {
      setError(e instanceof BackendError ? e.message : "Something went wrong behind the scenes.");
      return null;
    } finally {
      setPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { run, pending, error, clearError: () => setError(null) };
}

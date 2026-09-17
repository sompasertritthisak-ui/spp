"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Query-string selection (`?id=<uuid>` / `?new=1`), the static-export friendly
 * way to address a record. Other params (e.g. `tab`) are preserved. Callers
 * must sit inside <Suspense> because this reads useSearchParams().
 */
export function useSelection(idKey = "id", newKey = "new") {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const id = params.get(idKey);
  const isNew = params.get(newKey) === "1";

  const go = useCallback((mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [params, path, router]);

  return useMemo(() => ({
    id, isNew,
    open: (v: string) => go((p) => { p.delete(newKey); p.set(idKey, v); }),
    openNew: () => go((p) => { p.delete(idKey); p.set(newKey, "1"); }),
    close: () => go((p) => { p.delete(idKey); p.delete(newKey); }),
  }), [id, isNew, go, idKey, newKey]);
}

/** A single string param (tabs, filters) kept in the URL so views are linkable. */
export function useParam<T extends string>(key: string, fallback: T, clearOnChange: string[] = []): [T, (v: T) => void] {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const value = (params.get(key) as T | null) ?? fallback;
  const set = useCallback((v: T) => {
    const next = new URLSearchParams(params.toString());
    if (v === fallback) next.delete(key); else next.set(key, v);
    clearOnChange.forEach((k) => next.delete(k));
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, path, router, key, fallback]);
  return [value, set];
}

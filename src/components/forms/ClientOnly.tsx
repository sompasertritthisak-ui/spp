"use client";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/** True once React has hydrated. Lets forms read storage and the clock in
 *  their initial state without a server/client mismatch. */
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return useHydrated() ? <>{children}</> : <>{fallback}</>;
}

export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading form" className="flex flex-col gap-6">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-14 w-full" />)}
    </div>
  );
}

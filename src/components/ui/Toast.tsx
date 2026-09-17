"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; tone: "ok" | "danger" | "neutral" };
const Ctx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "neutral") => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-md items-center gap-3 border border-ink-600 bg-ink-850 px-4 py-3 text-sm text-fog-50 shadow-2xl shadow-black/60 [animation:register_.3s_var(--ease-press)]">
            <span aria-hidden className={`h-2 w-2 flex-none ${t.tone === "ok" ? "bg-ok" : t.tone === "danger" ? "bg-danger" : "bg-yellow"}`} />
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

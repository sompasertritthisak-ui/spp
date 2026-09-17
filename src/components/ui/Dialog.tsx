"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Accessible modal on the native <dialog>: focus trap, Esc and backdrop close come from the platform. */
export function Dialog({ open, onClose, title, children, wide = false, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="dlg-title"
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-4xl" : "max-w-xl"} max-h-[calc(100dvh-2rem)] border border-ink-600 bg-ink-900 p-0 text-fog-100 shadow-2xl shadow-black/70 backdrop:bg-black/70 backdrop:backdrop-blur-sm open:[animation:register_.25s_var(--ease-press)]`}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-ink-700 px-6 py-4">
          <h2 id="dlg-title" className="t-heading text-fog-50">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center text-fog-400 hover:text-fog-50">
            <svg aria-hidden viewBox="0 0 14 14" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l12 12M13 1L1 13" /></svg>
          </button>
        </header>
        <div className="thin-scroll overflow-y-auto px-6 py-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-ink-700 px-6 py-4">{footer}</footer>}
      </div>
    </dialog>
  );
}

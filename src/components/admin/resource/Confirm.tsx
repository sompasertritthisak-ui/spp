"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/** <Dialog> that keeps its Escape key from also closing a Drawer it sits inside. */
export function Modal(props: React.ComponentProps<typeof Dialog>) {
  return <div onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}><Dialog {...props} /></div>;
}

type Ask = { title: string; body: ReactNode; confirmLabel?: string; danger?: boolean };

/**
 * Promise-based confirmation:
 *   const [confirm, confirmUi] = useConfirm();
 *   if (await confirm({ title: "Delete FAQ?", body: "…", danger: true })) …
 * Render `confirmUi` once in the component.
 */
export function useConfirm(): [(a: Ask) => Promise<boolean>, ReactNode] {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback((a: Ask) => new Promise<boolean>((resolve) => { resolver.current = resolve; setAsk(a); }), []);
  const settle = (v: boolean) => { resolver.current?.(v); resolver.current = null; setAsk(null); };
  const ui = (
    <Modal open={ask !== null} onClose={() => settle(false)} title={ask?.title ?? "Confirm"} footer={<><Button variant="ghost" onClick={() => settle(false)}>Cancel</Button><Button variant={ask?.danger ? "danger" : "primary"} onClick={() => settle(true)}>{ask?.confirmLabel ?? "Confirm"}</Button></>}>
      <div className="text-sm leading-relaxed text-fog-300">{ask?.body}</div>
    </Modal>
  );
  return [confirm, ui];
}

export const DISCARD = { title: "Discard unsaved changes?", body: "You have edits that are not saved yet. Closing now will lose them.", confirmLabel: "Discard changes", danger: true } as const;

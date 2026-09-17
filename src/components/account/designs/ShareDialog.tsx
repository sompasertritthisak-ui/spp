"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { BackendError } from "@/lib/backend/client";
import { env } from "@/lib/env";
import { setSharing } from "./actions";
import type { DesignLite } from "./shared";

export function ShareDialog({ design, onClose, onChanged }: { design: DesignLite | null; onClose: () => void; onChanged: (id: string, token: string | null) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const token = design?.share_token ?? null;
  const link = token && typeof window !== "undefined" ? `${window.location.origin}${env.basePath}/design/?share=${token}` : "";

  const toggle = async (shared: boolean) => {
    if (!design) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(design.id, await setSharing(design.id, shared));
      toast(shared ? "Private link created." : "Sharing switched off. The old link no longer works.", "ok");
    } catch (e) {
      setError(e instanceof BackendError ? e.message : "We could not change sharing. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied.", "ok");
    } catch {
      field.current?.select(); // clipboard blocked: leave the link selected for a manual copy
      toast("Press Ctrl/Cmd + C to copy the selected link.");
    }
  };

  return (
    <Dialog open={Boolean(design)} onClose={onClose} title="Share design" footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-5">
        <p className="text-fog-300"><span className="text-fog-50">{design?.name}</span> <span className="t-data text-fog-500">{design?.ref}</span></p>
        <FormError message={error} />
        {token ? (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="share-link" className="t-label text-fog-400">Private link</label>
              <div className="flex gap-2">
                <input id="share-link" ref={field} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="t-data min-h-12 w-full min-w-0 border border-ink-600 bg-ink-950 px-3 text-sm text-fog-50 focus:border-yellow focus:outline-none" />
                <Button onClick={() => void copy()} className="min-h-12 flex-none">Copy</Button>
              </div>
            </div>
            <p className="border border-warn/40 bg-warn/10 p-4 text-sm text-fog-100">Anyone with this link can <strong>view</strong> the design — no sign-in needed. They cannot edit it, see your files, or see anything else in your account.</p>
            <div><Button variant="danger" loading={busy} onClick={() => void toggle(false)}>Stop sharing</Button></div>
          </>
        ) : (
          <>
            <p className="text-fog-400">Create a private link to show this design to a colleague or client for sign-off. Anyone with the link can view the design; nobody can edit it. You can switch the link off at any time.</p>
            <div><Button loading={busy} onClick={() => void toggle(true)}>Create private link</Button></div>
          </>
        )}
      </div>
    </Dialog>
  );
}

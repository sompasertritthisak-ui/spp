"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { BackendError } from "@/lib/backend/client";
import { env } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { setSharing } from "./actions";
import type { DesignLite } from "./shared";

export function ShareDialog({ design, onClose, onChanged }: { design: DesignLite | null; onClose: () => void; onChanged: (id: string, token: string | null) => void }) {
  const toast = useToast();
  const t = useT();
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
      toast(shared ? t("share.created") : t("share.off"), "ok");
    } catch (e) {
      setError(e instanceof BackendError ? e.message : t("share.fail"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast(t("share.copied"), "ok");
    } catch {
      field.current?.select(); // clipboard blocked: leave the link selected for a manual copy
      toast(t("share.copyManual"));
    }
  };

  return (
    <Dialog open={Boolean(design)} onClose={onClose} title={t("share.title")} footer={<Button variant="ghost" onClick={onClose}>{t("common.done")}</Button>}>
      <div className="flex flex-col gap-5">
        <p className="text-fog-300"><span className="text-fog-50">{design?.name}</span> <span className="t-data text-fog-500">{design?.ref}</span></p>
        <FormError message={error} />
        {token ? (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="share-link" className="t-label text-fog-400">{t("share.link")}</label>
              <div className="flex gap-2">
                <input id="share-link" ref={field} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="t-data min-h-12 w-full min-w-0 border border-ink-600 bg-ink-950 px-3 text-sm text-fog-50 focus:border-yellow focus:outline-none" />
                <Button onClick={() => void copy()} className="min-h-12 flex-none">{t("common.copy")}</Button>
              </div>
            </div>
            <p className="border border-warn/40 bg-warn/10 p-4 text-sm text-fog-100">{t("share.anyone")} <strong>{t("share.view")}</strong> {t("share.anyoneEnd")}</p>
            <div><Button variant="danger" loading={busy} onClick={() => void toggle(false)}>{t("share.stop")}</Button></div>
          </>
        ) : (
          <>
            <p className="text-fog-400">{t("share.createBody")}</p>
            <div><Button loading={busy} onClick={() => void toggle(true)}>{t("share.create")}</Button></div>
          </>
        )}
      </div>
    </Dialog>
  );
}

"use client";
import Link from "next/link";
import { Copy, Link2, PenLine, Phone, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/admin/ui";
import { WhatsAppLink } from "@/components/forms/WhatsAppLink";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Plate";
import type { PreflightVerdict } from "@/lib/backend/db-types";
import { formatPhone, relativeTime, titleCase } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Key } from "@/lib/i18n/core";
import type { ImageLayer } from "@/lib/studio/schema";
import { whatsappHref } from "@/lib/whatsapp";
import { lockedBySpp } from "./actions";
import { DesignPreview, type DesignLite } from "./shared";

export type Verdict = { verdict: PreflightVerdict; reviewed: boolean };
const VERDICT: Record<PreflightVerdict, { tone: "ok" | "warn" | "danger"; label: Key }> = {
  ready: { tone: "ok", label: "des.vReady" },
  attention: { tone: "warn", label: "des.vAttention" },
  blocked: { tone: "danger", label: "des.vBlocked" },
};

function Act({ onClick, icon, children, disabled, title, danger }: { onClick: () => void; icon: ReactNode; children: ReactNode; disabled?: boolean; title?: string; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`t-label flex min-h-11 items-center justify-center gap-2 text-[0.6875rem] text-fog-300 transition-colors hover:bg-ink-850 disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "hover:text-danger" : "hover:text-yellow"}`}>
      {icon}{children}
    </button>
  );
}

export function DesignCard({ design: d, verdict, imageUrl, busy, contact, onRename, onDuplicate, onShare, onDelete }: {
  design: DesignLite; verdict?: Verdict; imageUrl: (l: ImageLayer) => string | undefined; busy: boolean; contact: { whatsapp: string; phone: string };
  onRename: () => void; onDuplicate: () => void; onShare: () => void; onDelete: () => void;
}) {
  const t = useT();
  const locked = lockedBySpp(d.status);
  // A question, not a quote request — so the message is written here and carries the design reference.
  const askHref = whatsappHref(contact.whatsapp, { kind: "custom", text: t("des.askMessage", { ref: d.ref, product: titleCase(d.product_slug) }) });
  const phone = contact.phone.trim();
  const v = verdict ? VERDICT[verdict.verdict] : null;
  const icon = "h-3.5 w-3.5";
  return (
    <li className={`flex flex-col border border-ink-700 transition-[opacity,border-color] hover:border-gold/50 ${busy ? "pointer-events-none opacity-50" : ""}`} aria-busy={busy}>
      <Link href={`/design/?id=${d.id}`} aria-label={t("des.open", { name: d.name })} className="group block bg-ink-850 p-4">
        <DesignPreview design={d} imageUrl={imageUrl} className="mx-auto h-auto w-full max-w-[16rem] transition-transform duration-300 ease-[var(--ease-press)] group-hover:scale-[1.02]" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 border-t border-ink-700 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg text-fog-50" title={d.name}>{d.name}</h2>
            <p className="t-data truncate text-xs text-fog-500"><span className="text-gold">{d.ref}</span> · v{d.version}</p>
          </div>
          <StatusPill status={d.status} />
        </div>
        <p className="text-sm text-fog-400">{titleCase(d.product_slug)} · {t("des.updated")} {relativeTime(d.updated_at)}</p>
        <div className="flex flex-wrap gap-2">
          {v && <Badge tone={v.tone}>{verdict?.reviewed ? t("des.sppReview") : t("des.preflight")}: {t(v.label)}</Badge>}
          {d.share_token && <Badge tone="info">{t("des.sharingOn")}</Badge>}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <Button href={`/design/?id=${d.id}`} size="sm" className="w-full">{t("des.openStudio")}</Button>
          <Button href={`/request-quote/?product=${encodeURIComponent(d.product_slug)}&design=${encodeURIComponent(d.ref)}`} size="sm" variant="outline" className="w-full">{t("common.requestQuote")}</Button>
        </div>
        {/* Unsure about fabric, colour or print? Straight to a person at SPP, with the design reference already written. */}
        {(askHref || phone) && (
          <div data-ask-spp className="flex flex-col gap-2 border-t border-gold/25 pt-3">
            <p className="text-sm text-fog-400">{t("des.askHint")}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {askHref && <WhatsAppLink href={askHref} label={t("des.ask")} source="design_card_ask" size="sm" variant="outline" />}
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} aria-label={`${t("des.call")} ${formatPhone(phone)}`} className="t-label inline-flex min-h-11 items-center gap-2 text-fog-300 transition-colors hover:text-gold">
                  <Phone aria-hidden className="h-3.5 w-3.5 flex-none" strokeWidth={1.5} />{t("des.call")}<span className="t-data normal-case tracking-normal text-fog-400">{formatPhone(phone)}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 divide-x divide-ink-700 border-t border-ink-700">
        <Act onClick={onRename} icon={<PenLine aria-hidden className={icon} strokeWidth={1.5} />}><span className="sr-only sm:not-sr-only">{t("des.renameBtn")}</span></Act>
        <Act onClick={onDuplicate} icon={<Copy aria-hidden className={icon} strokeWidth={1.5} />}><span className="sr-only sm:not-sr-only">{t("des.copyBtn")}</span><span className="sr-only">{t("des.copySr")}</span></Act>
        <Act onClick={onShare} icon={<Link2 aria-hidden className={icon} strokeWidth={1.5} />}><span className="sr-only sm:not-sr-only">{t("des.shareBtn")}</span></Act>
        <Act onClick={onDelete} danger disabled={locked} title={locked ? t("des.lockedTip") : undefined} icon={<Trash2 aria-hidden className={icon} strokeWidth={1.5} />}><span className="sr-only sm:not-sr-only">{t("des.deleteBtn")}</span></Act>
      </div>
      {locked && <p className="border-t border-ink-700 px-4 py-2 text-xs text-fog-500">{t("des.lockedNote", { stage: d.status === "approved" ? t("des.production") : t("des.quoting") })}</p>}
    </li>
  );
}

"use client";
import Link from "next/link";
import { Copy, Link2, PenLine, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Plate";
import type { PreflightVerdict } from "@/lib/backend/db-types";
import { relativeTime, titleCase } from "@/lib/format";
import type { ImageLayer } from "@/lib/studio/schema";
import { lockedBySpp } from "./actions";
import { DesignPreview, type DesignLite } from "./shared";

export type Verdict = { verdict: PreflightVerdict; reviewed: boolean };
const VERDICT: Record<PreflightVerdict, { tone: "ok" | "warn" | "danger"; label: string }> = {
  ready: { tone: "ok", label: "ready" },
  attention: { tone: "warn", label: "check warnings" },
  blocked: { tone: "danger", label: "needs fixing" },
};

function Act({ onClick, icon, children, disabled, title, danger }: { onClick: () => void; icon: ReactNode; children: ReactNode; disabled?: boolean; title?: string; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`t-label flex min-h-11 items-center justify-center gap-2 text-[0.6875rem] text-fog-300 transition-colors hover:bg-ink-850 disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "hover:text-danger" : "hover:text-yellow"}`}>
      {icon}{children}
    </button>
  );
}

export function DesignCard({ design: d, verdict, imageUrl, busy, onRename, onDuplicate, onShare, onDelete }: {
  design: DesignLite; verdict?: Verdict; imageUrl: (l: ImageLayer) => string | undefined; busy: boolean;
  onRename: () => void; onDuplicate: () => void; onShare: () => void; onDelete: () => void;
}) {
  const locked = lockedBySpp(d.status);
  const v = verdict ? VERDICT[verdict.verdict] : null;
  const icon = "h-3.5 w-3.5";
  return (
    <li className={`flex flex-col border border-ink-700 transition-opacity ${busy ? "pointer-events-none opacity-50" : ""}`} aria-busy={busy}>
      <Link href={`/design/?id=${d.id}`} aria-label={`Open ${d.name} in SPP Studio`} className="group block bg-ink-850 p-4">
        <DesignPreview design={d} imageUrl={imageUrl} className="mx-auto h-auto w-full max-w-[16rem] transition-transform duration-300 ease-[var(--ease-press)] group-hover:scale-[1.02]" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 border-t border-ink-700 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg text-fog-50" title={d.name}>{d.name}</h2>
            <p className="t-data truncate text-xs text-fog-500">{d.ref} · v{d.version}</p>
          </div>
          <StatusPill status={d.status} />
        </div>
        <p className="text-sm text-fog-400">{titleCase(d.product_slug)} · updated {relativeTime(d.updated_at)}</p>
        <div className="flex flex-wrap gap-2">
          {v && <Badge tone={v.tone}>{verdict?.reviewed ? "SPP review" : "Preflight"}: {v.label}</Badge>}
          {d.share_token && <Badge tone="info">Link sharing on</Badge>}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <Button href={`/design/?id=${d.id}`} size="sm" className="w-full">Open in Studio</Button>
          <Button href={`/request-quote/?product=${encodeURIComponent(d.product_slug)}&design=${encodeURIComponent(d.ref)}`} size="sm" variant="outline" className="w-full">Request a quote</Button>
        </div>
      </div>
      <div className="grid grid-cols-4 divide-x divide-ink-700 border-t border-ink-700">
        <Act onClick={onRename} icon={<PenLine aria-hidden className={icon} strokeWidth={1.5} />}><span className="sr-only sm:not-sr-only">Rename</span></Act>
        <Act onClick={onDuplicate} icon={<Copy aria-hidden className={icon} strokeWidth={1.5} />}><span className="sr-only sm:not-sr-only">Copy</span><span className="sr-only"> — duplicate this design</span></Act>
        <Act onClick={onShare} icon={<Link2 aria-hidden className={icon} strokeWidth={1.5} />}><span className="sr-only sm:not-sr-only">Share</span></Act>
        <Act onClick={onDelete} danger disabled={locked} title={locked ? "SPP is quoting or producing this design, so it cannot be deleted. Message SPP to withdraw it." : undefined} icon={<Trash2 aria-hidden className={icon} strokeWidth={1.5} />}><span className="sr-only sm:not-sr-only">Delete</span></Act>
      </div>
      {locked && <p className="border-t border-ink-700 px-4 py-2 text-xs text-fog-500">With SPP for {d.status === "approved" ? "production" : "quoting"} — it cannot be deleted. Duplicate it to make changes freely.</p>}
    </li>
  );
}

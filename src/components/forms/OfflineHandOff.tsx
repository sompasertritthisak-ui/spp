"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { whatsappHref } from "@/lib/whatsapp";
import { WhatsAppLink } from "./WhatsAppLink";

/**
 * Shown INSTEAD of a success screen when the back-end is not configured.
 * Nothing was sent, and we say so; the composed request travels with the
 * customer into their own email or WhatsApp.
 */
export function OfflineHandOff({ email, whatsapp, subject, summary, source }: { email: string; whatsapp: string; subject: string; summary: string; source: string }) {
  const [copied, setCopied] = useState(false);
  // wa.me carries any text; whatsappHref() stays the single judge of "is a number configured".
  const base = whatsappHref(whatsapp, { kind: "general" });
  const wa = base ? `${base.split("?")[0]}?text=${encodeURIComponent(summary.slice(0, 1800))}` : null;
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary.slice(0, 1800))}`;
  return (
    <div role="status" className="crop border border-yellow/50 bg-ink-900 p-6 sm:p-8">
      <p className="t-label text-yellow">Not sent yet</p>
      <h2 className="t-title mt-3 text-fog-50">Online requests are not switched on yet.</h2>
      <p className="mt-4 max-w-xl text-fog-300">
        Nothing has been submitted. Your request is written out below — send it to SPP by email{wa ? " or WhatsApp" : ""} and the team will reply with a written quotation.
      </p>
      <pre className="thin-scroll mt-6 max-h-64 overflow-auto whitespace-pre-wrap border border-ink-700 bg-ink-950 p-4 font-mono text-sm leading-relaxed text-fog-300">{summary}</pre>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button href={mailto} external arrow>Email this to SPP</Button>
        {wa && <WhatsAppLink href={wa} label="Send on WhatsApp" source={source} />}
        <Button variant="ghost" onClick={() => { void navigator.clipboard?.writeText(summary).then(() => setCopied(true), () => {}); }}>{copied ? "Copied" : "Copy text"}</Button>
      </div>
      <p className="mt-4 text-sm text-fog-500">{email}</p>
    </div>
  );
}

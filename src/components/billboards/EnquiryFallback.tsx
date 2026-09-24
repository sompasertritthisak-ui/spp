"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { formatDate } from "@/lib/format";
import { whatsappHref, whatsappMessage } from "@/lib/whatsapp";
import { PeriodFields } from "./PeriodFields";
import { checkPeriod, isoLocal } from "./period";
import type { BookingSite, Channels } from "./BookingFlow";

/**
 * When online requests are switched off (or there is no back-end), say so and
 * hand the visitor a fully-written enquiry for WhatsApp or email. No form is
 * "submitted" here, so nothing can pretend to have succeeded.
 */
export function EnquiryFallback({ site, channels, hasArtwork }: { site: BookingSite; channels: Channels; hasArtwork: boolean }) {
  const today = useMemo(() => isoLocal(new Date()), []);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [design, setDesign] = useState(false);
  const [install, setInstall] = useState(true);
  const check = checkPeriod(start, end, today, site.minMonths, site, []);
  const valid = Boolean(start && end && !check.errors.start && !check.errors.end);

  const ctx = { kind: "billboard" as const, code: site.code, name: site.name, ...(valid ? { from: start, to: end } : {}) };
  const extras = [
    valid ? `Dates: ${formatDate(start)} to ${formatDate(end)} (${check.days} days).` : "",
    design ? "I need help designing the artwork." : hasArtwork ? "I have artwork ready to send." : "",
    install ? "Please include printing and installation." : "Rental only — I will arrange printing and installation.",
  ].filter(Boolean).join("\n");
  const wa = whatsappHref(channels.whatsapp, ctx);
  const body = `${whatsappMessage(ctx)}\n${extras}`;
  const mail = channels.email ? `mailto:${channels.email}?subject=${encodeURIComponent(`Billboard enquiry ${site.code} — ${site.name}`)}&body=${encodeURIComponent(body)}` : null;

  return (
    <div className="flex flex-col gap-8">
      <p className="border-l-2 border-gold pl-4 text-fog-300">Online requests are not switched on yet. Choose your dates and we will write the enquiry for you — send it to SPP by {wa ? "WhatsApp or " : ""}email and the team will reply with availability and a quotation.</p>
      <PeriodFields start={start} end={end} today={today} minMonths={site.minMonths} check={check} showErrors={Boolean(start || end)} blocks={[]} onChange={(p) => { if (p.start !== undefined) setStart(p.start); if (p.end !== undefined) setEnd(p.end); }} />
      <div className="flex flex-col gap-4">
        <Checkbox checked={install} onChange={(e) => setInstall(e.target.checked)} label="Include printing and installation in the quotation" />
        <Checkbox checked={design} onChange={(e) => setDesign(e.target.checked)} label="I need design help with the artwork" />
      </div>
      <div>
        <p className="t-label mb-2 text-fog-400">Your enquiry</p>
        <pre className="whitespace-pre-wrap border border-gold/30 bg-ink-950 p-4 font-sans text-sm leading-relaxed text-fog-100">{body}</pre>
      </div>
      <div className="flex flex-wrap gap-3">
        {wa && <Button href={wa} arrow>Send on WhatsApp</Button>}
        {mail && <Button href={mail} variant={wa ? "outline" : "primary"} arrow={!wa}>Send by email</Button>}
        {!wa && !mail && <Button href="/contact/" arrow>Contact SPP</Button>}
      </div>
    </div>
  );
}

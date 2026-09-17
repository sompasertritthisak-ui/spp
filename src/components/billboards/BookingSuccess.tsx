"use client";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";
import type { BookingSite, Channels } from "./BookingFlow";

/** A reference number, the server's own words, and an unmissable "this is a request". */
export function BookingSuccess({ site, result, start, end, channels, artworkSent }: { site: BookingSite; result: { ref: string; message: string; possibleClash: boolean }; start: string; end: string; channels: Channels; artworkSent: boolean }) {
  const wa = whatsappHref(channels.whatsapp, { kind: "billboard", code: site.code, name: site.name, from: start, to: end, bookingRef: result.ref });
  const next = [
    "SPP checks the site calendar for your dates" + (result.possibleClash ? " — they overlap something already pencilled in, so we may suggest the nearest free period." : "."),
    "You receive a written quotation: site rental" + (artworkSent ? ", plus print and installation if you asked for them." : ", plus design, print and installation where requested."),
    "Nothing is reserved, and nothing is owed, until you accept that quotation and SPP confirms the booking.",
  ];
  return (
    <div role="status" className="border border-ink-600 bg-ink-900 p-6 sm:p-10">
      <p className="t-label flex items-center gap-3 text-gold"><span aria-hidden className="reg" />Request received — not yet a booking</p>
      <p className="t-label mt-8 text-fog-500">Your reference</p>
      <p className="t-data mt-2 text-4xl text-fog-50 sm:text-5xl">{result.ref}</p>
      <p className="mt-6 max-w-2xl text-lg text-fog-100">{result.message}</p>
      <p className="mt-2 text-fog-400">{site.code} · {site.name} · {formatDate(start)} – {formatDate(end)}{artworkSent ? " · artwork received privately" : ""}</p>

      <h4 className="t-label mt-10 text-fog-400">What happens next</h4>
      <ol className="mt-3 border-t border-ink-700">
        {next.map((n, i) => <li key={n} className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-ink-700 py-4 text-fog-300"><span className="t-data text-fog-500">{String(i + 1).padStart(2, "0")}</span>{n}</li>)}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        {wa && <Button href={wa} arrow>Follow up on WhatsApp</Button>}
        <Button href="/billboards/" variant="outline">Explore more billboards</Button>
      </div>
      {channels.email && <p className="mt-6 text-sm text-fog-500">Quote {result.ref} in any message to <a className="text-sky underline underline-offset-4" href={`mailto:${channels.email}?subject=${encodeURIComponent(`Billboard request ${result.ref}`)}`}>{channels.email}</a>.</p>}
    </div>
  );
}

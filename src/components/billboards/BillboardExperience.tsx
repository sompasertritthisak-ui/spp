"use client";
import { useEffect, useState } from "react";
import { StatusTag } from "@/components/map/StatusGlyph";
import { useLiveAvailability } from "@/components/map/useLiveAvailability";
import { Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import type { Billboard } from "@/content/types";
import { track } from "@/lib/backend/analytics";
import { backend } from "@/lib/backend/client";
import { formatDate } from "@/lib/format";
import type { Artwork } from "./artwork";
import { BookingFlow, type Channels } from "./BookingFlow";
import { EnquiryFallback } from "./EnquiryFallback";
import { Visualiser } from "./Visualiser";

/**
 * The interactive half of a location page. The visualiser and the request flow
 * share one piece of state — the customer's artwork — so a file chosen while
 * previewing is the file that travels with the request.
 */
export function BillboardExperience({ billboard, bookingOn, channels }: { billboard: Billboard; bookingOn: boolean; channels: Channels }) {
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const live = useLiveAvailability(billboard.code);
  const fresh = live.byCode[billboard.code];
  const status = fresh?.status ?? billboard.status;
  const availableFrom = fresh ? fresh.availableFrom : billboard.availableFrom;
  const site = { code: billboard.code, name: billboard.name, status, availableFrom, minMonths: billboard.minMonths };
  const online = bookingOn && Boolean(backend());

  useEffect(() => { track("billboard_viewed", { ref: billboard.code, source: "location-page" }); }, [billboard.code]);

  return (
    <>
      <section id="visualise" aria-labelledby="visualise-h" className="scroll-mt-[var(--nav-h)] border-y border-gold/30 bg-ink-900 py-16 lg:py-24">
        <div className="shell">
          <Plate n="02" className="mb-6">Visualise it</Plate>
          <h2 id="visualise-h" className="t-title max-w-3xl text-fog-50">See your artwork on a {billboard.widthM} × {billboard.heightM} m face — before anything is printed.</h2>
          <p className="mb-10 mt-5 max-w-2xl text-lg text-fog-300">Upload a design and it is mapped onto the structure in true perspective. Switch to night, then walk back to a driver&rsquo;s distance: if the message still reads, it works.</p>
          <Visualiser site={billboard} artwork={artwork} onArtwork={setArtwork} />
        </div>
      </section>

      <section id="request" aria-labelledby="request-h" className="scroll-mt-[var(--nav-h)] bg-ink-950 py-16 lg:py-24">
        <div className="shell grid gap-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <div>
            <Plate n="03" className="mb-6">Request this location</Plate>
            <h2 id="request-h" className="t-title text-fog-50">Ask for your dates.</h2>
            <p className="mt-5 text-fog-300">A request is not a booking. SPP checks the calendar, then replies with availability and a written quotation.</p>
            <dl className="mt-8 border-t border-gold/40 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-gold/20 py-3"><dt className="t-label text-[0.625rem] text-fog-500">Status {live.state === "live" ? "· live" : ""}</dt><dd><StatusTag status={status} /></dd></div>
              {availableFrom && status !== "available" && status !== "unavailable" && <div className="flex items-center justify-between gap-4 border-b border-gold/20 py-3"><dt className="t-label text-[0.625rem] text-fog-500">Expected free from</dt><dd className="t-data text-gold">{formatDate(availableFrom)}</dd></div>}
              <div className="flex items-center justify-between gap-4 border-b border-gold/20 py-3"><dt className="t-label text-[0.625rem] text-fog-500">Minimum term</dt><dd className="t-data text-gold">{billboard.minMonths} {billboard.minMonths === 1 ? "month" : "months"}</dd></div>
            </dl>
          </div>
          <div>
            {status === "unavailable" ? (
              <div className="border border-gold/40 p-6 sm:p-8">
                <p className="t-heading text-fog-50">This location is not currently offered.</p>
                <p className="mt-3 max-w-xl text-fog-300">It is listed so the network map stays complete. Tell us the area you need and we will suggest the closest alternatives.</p>
                <div className="mt-6 flex flex-wrap gap-3"><Button href="/billboards/?status=available" arrow>Explore billboards</Button><Button href="/consultation/" variant="outline">Let&rsquo;s talk</Button></div>
              </div>
            ) : online ? (
              <BookingFlow site={site} channels={channels} artwork={artwork} blocks={fresh?.blocks ?? []} />
            ) : (
              <EnquiryFallback site={site} channels={channels} hasArtwork={Boolean(artwork)} />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

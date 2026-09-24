"use client";
import Link from "next/link";
import { ErrorNote, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/backend/analytics";
import type { BillboardBookingsRow, BookingStatus } from "@/lib/backend/db-types";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";
import { usePortal } from "./PortalShell";
import { Block, PortalEmpty, PortalHeader, RowsSkeleton } from "./ui";

type Booking = Pick<BillboardBookingsRow, "id" | "ref" | "starts_on" | "ends_on" | "status" | "needs_design" | "needs_print_install" | "notes" | "campaign_id" | "created_at"> & {
  billboards: { code: string; name: string } | null;
  campaigns: { slug: string; name: string } | null;
};

/* A request is only ever called confirmed once SPP staff have confirmed it. */
const NOTE: Record<BookingStatus, string> = {
  requested: "Request received. This is not a confirmed booking — SPP will check availability for these dates and reply.",
  in_review: "SPP is checking availability and pricing for these dates. Not confirmed yet.",
  confirmed: "Confirmed by SPP for the dates shown.",
  declined: "SPP could not offer this location for these dates. Message us for alternatives nearby.",
  cancelled: "This request was cancelled.",
  completed: "This campaign period has finished.",
};

export function BillboardsPage() {
  const { uid, contact } = usePortal();
  // to-one embeds: the untyped client infers arrays, PostgREST returns objects
  const q = useQuery<Booking[]>(async () => {
    const r = await requireBackend().from("billboard_bookings").select("id,ref,starts_on,ends_on,status,needs_design,needs_print_install,notes,campaign_id,created_at,billboards(code,name),campaigns(slug,name)").eq("customer_id", uid).order("created_at", { ascending: false }).limit(100);
    return { data: r.data as unknown as Booking[] | null, error: r.error };
  }, [uid]);
  const campaigns = [...new Map((q.data ?? []).flatMap((b) => (b.campaign_id && b.campaigns ? [[b.campaigns.slug, b.campaigns] as const] : []))).values()];

  return (
    <>
      <PortalHeader title="My Billboards" sub="Your billboard location requests and their status. A location is yours only when SPP marks the request confirmed." actions={<Button href="/billboards/" arrow>Explore billboards</Button>} />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <RowsSkeleton rows={3} tall /> : q.data?.length === 0 ? (
        <PortalEmpty title="No billboard requests yet." body="Browse SPP's locations on the map, pick your dates and request the site. Requests you send while signed in are tracked here." action={<Button href="/billboards/" arrow>Explore billboards</Button>} />
      ) : (
        <ul className="flex flex-col gap-4">
          {q.data?.map((b) => {
            const wa = b.billboards ? whatsappHref(contact.whatsapp, { kind: "billboard", code: b.billboards.code, name: b.billboards.name, from: b.starts_on, to: b.ends_on, bookingRef: b.ref }) : null;
            return (
              <li key={b.id} className="border border-ink-700 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg text-fog-50">
                      {b.billboards ? <Link href={`/billboards/${b.billboards.code}/`} className="underline-offset-4 hover:text-yellow hover:underline"><span className="t-data mr-2 text-gold">{b.billboards.code}</span>{b.billboards.name}</Link> : "Location no longer listed"}
                    </h2>
                    <p className="t-data mt-1 text-sm text-fog-400"><span className="text-gold">{b.ref}</span> · requested {formatDate(b.created_at)}</p>
                  </div>
                  <StatusPill status={b.status} />
                </div>
                <p className="t-data mt-4 text-fog-100">{formatDate(b.starts_on)} → {formatDate(b.ends_on)}</p>
                <p className="mt-1 text-sm text-fog-400">{[b.needs_design ? "Design by SPP requested" : "Artwork supplied by you", b.needs_print_install ? "print & installation requested" : "no print & installation"].join(" · ")}</p>
                <p className={`mt-4 border-l-2 pl-4 text-sm ${b.status === "confirmed" ? "border-ok text-fog-100" : b.status === "requested" || b.status === "in_review" ? "border-gold/60 text-fog-300" : "border-ink-500 text-fog-300"}`}>{NOTE[b.status]}</p>
                {wa && b.status !== "cancelled" && b.status !== "completed" && (
                  <p className="mt-4"><a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { ref: b.ref, step: "booking_followup" })} className="t-label inline-flex min-h-11 items-center text-fog-300 underline-offset-4 hover:text-yellow hover:underline">Follow up on WhatsApp</a></p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {campaigns.length > 0 && (
        <Block title="My Campaigns" className="mt-12">
          <ul className="border-t border-gold/25">
            {campaigns.map((c) => (
              <li key={c.slug} className="flex items-center justify-between gap-4 border-b border-ink-700 py-3">
                <span className="text-fog-50">{c.name}</span>
                <Link href={`/campaigns/?c=${encodeURIComponent(c.slug)}`} className="t-label flex min-h-11 items-center text-fog-300 hover:text-yellow">View campaign</Link>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </>
  );
}

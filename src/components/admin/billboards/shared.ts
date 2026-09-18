import { z } from "zod";
import type { BillboardAvailabilityRow, BillboardBookingsRow, BillboardsRow, BillboardStatus, PricingMode, PublishStatus } from "@/lib/backend/db-types";

export const SITE_STATUSES: BillboardStatus[] = ["available", "reserved", "unavailable", "maintenance"];
export const OPEN_BOOKING = ["requested", "in_review"];

export type SiteForm = {
  code: string; name: string; province: string; district: string; address: string; lat: number | null; lng: number | null;
  width_m: number | null; height_m: number | null; orientation: "landscape" | "portrait"; faces: 1 | 2; facing: string; lit: boolean; visibility: string; traffic: string;
  status: BillboardStatus; available_from: string | null; pricing_mode: PricingMode; price_from_usd_month: number | null; min_months: number | null;
  installation: string; description: string; verified: boolean; publish: PublishStatus; images: string[];
};

export const toSiteForm = (b: BillboardsRow | null, images: string[]): SiteForm => ({
  code: b?.code ?? "", name: b?.name ?? "", province: b?.province ?? "", district: b?.district ?? "", address: b?.address ?? "", lat: b?.lat ?? null, lng: b?.lng ?? null,
  width_m: b ? Number(b.width_m) : null, height_m: b ? Number(b.height_m) : null, orientation: (b?.orientation as SiteForm["orientation"]) ?? "landscape", faces: (b?.faces as 1 | 2) ?? 1, facing: b?.facing ?? "", lit: b?.lit ?? false,
  visibility: b?.visibility ?? "", traffic: b?.traffic ?? "", status: b?.status ?? "available", available_from: b?.available_from ?? null, pricing_mode: b?.pricing_mode ?? "estimated",
  price_from_usd_month: b?.price_from_usd_month == null ? null : Number(b.price_from_usd_month), min_months: b?.min_months ?? 1, installation: b?.installation ?? "", description: b?.description ?? "", verified: b?.verified ?? false, publish: b?.publish ?? "draft", images,
});

/** Ranges mirror the CHECK constraints on `billboards` (0002_content.sql). */
export const siteSchema = z.object({
  code: z.string().trim().min(3, "Give the site a code, e.g. SPP-BB-014.").max(24).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only."),
  name: z.string().trim().min(2, "Give the site a name.").max(160),
  province: z.string().trim().min(2, "Enter the province.").max(80),
  lat: z.number({ error: "Enter the latitude." }).min(13, "Latitude must be between 13 and 23 (Laos).").max(23, "Latitude must be between 13 and 23 (Laos)."),
  lng: z.number({ error: "Enter the longitude." }).min(99, "Longitude must be between 99 and 108.5 (Laos).").max(108.5, "Longitude must be between 99 and 108.5 (Laos)."),
  width_m: z.number({ error: "Enter the width in metres." }).positive("Width must be more than zero.").max(200),
  height_m: z.number({ error: "Enter the height in metres." }).positive("Height must be more than zero.").max(200),
  min_months: z.number({ error: "Enter the minimum booking." }).int("Use whole months.").min(1, "At least 1 month.").max(60),
  price_from_usd_month: z.number().min(0, "A price cannot be negative.").max(1e7).nullable(),
});

export function siteRow(f: SiteForm) {
  return {
    code: f.code.trim().toUpperCase(), name: f.name.trim(), province: f.province.trim(), district: f.district.trim(), address: f.address.trim(), lat: f.lat, lng: f.lng, width_m: f.width_m, height_m: f.height_m,
    orientation: f.orientation, faces: f.faces, facing: f.facing.trim(), lit: f.lit, visibility: f.visibility.trim(), traffic: f.traffic.trim() || null, status: f.status, available_from: f.available_from,
    pricing_mode: f.pricing_mode, price_from_usd_month: f.price_from_usd_month, min_months: f.min_months ?? 1, installation: f.installation.trim(), description: f.description.trim(), verified: f.verified, publish: f.publish,
  };
}

export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && aEnd >= bStart;

export type Clash = { blocks: BillboardAvailabilityRow[]; competing: BillboardBookingsRow[] };
/** A hard clash = a committed availability block. "Competing" = another still-open enquiry for the same dates. */
export function clashesFor(k: BillboardBookingsRow, blocks: BillboardAvailabilityRow[], bookings: BillboardBookingsRow[]): Clash {
  return {
    blocks: blocks.filter((a) => a.billboard_id === k.billboard_id && a.booking_id !== k.id && overlaps(a.starts_on, a.ends_on, k.starts_on, k.ends_on)),
    competing: bookings.filter((o) => o.id !== k.id && o.billboard_id === k.billboard_id && OPEN_BOOKING.includes(o.status) && overlaps(o.starts_on, o.ends_on, k.starts_on, k.ends_on)),
  };
}

export type Contact = { name?: string; company?: string; email?: string; phone?: string };
export const contactOf = (k: BillboardBookingsRow): Contact => (k.contact && typeof k.contact === "object" && !Array.isArray(k.contact) ? (k.contact as Contact) : {});
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000) + 1;
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

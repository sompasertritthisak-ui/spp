import type { ConsultationsRow } from "@/lib/backend/db-types";

export type Consultation = ConsultationsRow;
/** The time that currently matters: confirmed, else the suggested alternative, else what the customer asked for. */
export const effectiveAt = (c: Consultation) => c.confirmed_at ?? (c.status === "alternative_suggested" && c.alternative_at ? c.alternative_at : c.preferred_at);
export const isOpen = (c: Consultation) => c.status === "requested" || c.status === "approved" || c.status === "alternative_suggested";
export const CHANNELS: Record<string, string> = { in_person: "In person", phone: "Phone", whatsapp: "WhatsApp", video: "Video call" };

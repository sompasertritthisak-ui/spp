import type { LeadSource, LeadStatus, LeadsRow, PriorityLevel } from "@/lib/backend/db-types";

export const LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "qualified", "quote", "negotiation", "won", "lost"];
export const LEAD_SOURCES: readonly LeadSource[] = ["quote", "consultation", "mockup", "billboard", "project_builder", "contact", "preorder", "campaign", "whatsapp", "social", "qr", "manual"];
export const PRIORITIES: readonly PriorityLevel[] = ["low", "normal", "high", "urgent"];
export const PRIORITY_RANK: Record<PriorityLevel, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
export const ACTIVITY_KINDS = ["note", "call", "email", "whatsapp", "meeting"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type Lead = LeadsRow;
export type MoveLead = (lead: Lead, to: LeadStatus) => void;

const digits = (s: string) => s.replace(/[^\d]/g, "");
/** Click-to-WhatsApp straight to the lead's own number (staff → customer). Null when the number is unusable. */
export const leadWhatsApp = (l: Pick<Lead, "phone" | "name" | "ref">) => {
  const d = digits(l.phone);
  return d.length >= 8 ? `https://wa.me/${d}?text=${encodeURIComponent(`Hello ${l.name}, this is SPP following up on your enquiry ${l.ref}.`)}` : null;
};

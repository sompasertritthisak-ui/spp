import { backend } from "@/lib/backend/client";
import type { SiteSettings } from "@/content/types";

/** The letterhead facts every exported document carries. Read from settings key 'site' (staff-readable under RLS). */
export type Company = { name: string; legalName: string; legalNameLo: string; addressLine: string; phone: string; landline: string; email: string };

const fallback: Company = { name: "SPP", legalName: "SPP Sole Co., Ltd", legalNameLo: "", addressLine: "Vientiane, Lao PDR", phone: "", landline: "", email: "" };

export function companyFrom(value: unknown): Company {
  const s = (value && typeof value === "object" ? value : {}) as Partial<SiteSettings>;
  const addr = s.address ? [s.address.line1, s.address.city, s.address.country].filter((x) => x && x.trim()).join(", ") : "";
  return {
    name: s.companyName?.trim() || fallback.name,
    legalName: s.legalName?.trim() || fallback.legalName,
    legalNameLo: s.legalNameLo?.trim() ?? "",
    addressLine: addr || fallback.addressLine,
    phone: s.phone ?? "", landline: s.landline ?? "", email: s.email ?? "",
  };
}

let cached: { at: number; p: Promise<Company> } | null = null;
/** Cached for the session; settings rarely change and every export needs them. */
export function loadCompany(): Promise<Company> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.p;
  const b = backend();
  const p: Promise<Company> = b ? Promise.resolve(b.from("settings").select("value").eq("key", "site").maybeSingle()).then((r) => companyFrom(r.data?.value)) : Promise.resolve(fallback);
  cached = { at: Date.now(), p };
  p.catch(() => { cached = null; });
  return p;
}

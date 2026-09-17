"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/backend/auth";
import type { Errors } from "./validation";

export type ContactValue = { name: string; company: string; email: string; phone: string };
const EMPTY: ContactValue = { name: "", company: "", email: "", phone: "" };
const KEY = "spp.contact";

function stored(): ContactValue {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<ContactValue>;
    return { name: String(v.name ?? ""), company: String(v.company ?? ""), email: String(v.email ?? ""), phone: String(v.phone ?? "") };
  } catch {
    return EMPTY;
  }
}

/** Remember the contact block for this browser session so a visitor who has
 *  filled one SPP form never retypes it on the next. Session-only by design. */
export function rememberContact(c: ContactValue) {
  try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch {}
}

/** Contact state, seeded from this session's last form and then from the signed-in profile (blanks only). */
export function useContactState() {
  const { profile } = useAuth();
  const [contact, setContact] = useState<ContactValue>(stored);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (profile && seededFor !== profile.id) {
    setSeededFor(profile.id);
    setContact((c) => ({ name: c.name || profile.full_name || "", company: c.company, email: c.email || profile.email || "", phone: c.phone || profile.phone || "" }));
  }
  return [contact, setContact, Boolean(profile)] as const;
}

export function ContactFields({ value, onChange, errors, emailRequired = false, onEmailBlur }: {
  value: ContactValue; onChange: (v: ContactValue) => void; errors: Errors; emailRequired?: boolean; onEmailBlur?: () => void;
}) {
  const set = (k: keyof ContactValue) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Input label="Your name" name="name" autoComplete="name" required maxLength={120} value={value.name} onChange={set("name")} error={errors["contact.name"]} />
      <Input label="Company or organisation" name="company" autoComplete="organization" maxLength={160} value={value.company} onChange={set("company")} error={errors["contact.company"]} />
      <Input label="Email" name="email" type="email" inputMode="email" autoComplete="email" required={emailRequired} maxLength={254} value={value.email} onChange={set("email")} onBlur={onEmailBlur} error={errors["contact.email"]} hint={emailRequired ? "We confirm by email." : "An email or a phone number — whichever you prefer."} />
      <Input label="Phone or WhatsApp" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={value.phone} onChange={set("phone")} error={errors["contact.phone"]} hint="Include the country code if outside Laos." />
    </div>
  );
}

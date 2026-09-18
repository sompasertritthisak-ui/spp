import Link from "next/link";
import type { SiteSettings } from "@/content/types";
import { whatsappHref } from "@/lib/whatsapp";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { PLATFORM_LABEL, SocialIcon } from "./SocialIcons";

/**
 * GET IN TOUCH — every channel SPP has configured, as one decisive band.
 * Reads Settings → Company & contact, so channels appear the moment SPP fills
 * them in and are hidden (never faked) while empty.
 */
export function ConnectBand({ settings }: { settings: SiteSettings }) {
  const wa = whatsappHref(settings.whatsapp, { kind: "general" });
  const channels: { key: string; label: string; value: string; href: string; icon: React.ReactNode; external?: boolean }[] = [];
  if (wa) channels.push({ key: "whatsapp", label: "WhatsApp", value: settings.whatsapp, href: wa, icon: <SocialIcon platform="whatsapp" />, external: true });
  if (settings.phone) channels.push({ key: "phone", label: "Call", value: settings.phone, href: `tel:${settings.phone.replace(/\s/g, "")}`, icon: <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg> });
  if (settings.email) channels.push({ key: "email", label: "Email", value: settings.email, href: `mailto:${settings.email}`, icon: <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18v12H3zM3 7l9 6 9-6" /></svg> });
  for (const s of settings.social) channels.push({ key: s.platform, label: PLATFORM_LABEL[s.platform], value: s.handle ? `@${s.handle.replace(/^@/, "")}` : s.url.replace(/^https?:\/\/(www\.)?/, ""), href: s.url, icon: <SocialIcon platform={s.platform} />, external: true });

  return (
    <section aria-labelledby="connect-title" className="relative isolate overflow-hidden border-t border-ink-700 bg-ink-900">
      <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 left-0 w-1/2 text-fog-50/[0.05] [mask-image:linear-gradient(90deg,black,transparent)]" />
      <div className="shell grid gap-12 py-20 lg:grid-cols-[1fr_1.2fr] lg:gap-20 lg:py-28">
        <div>
          <Plate n="09" className="mb-6">Get in touch</Plate>
          <h2 id="connect-title" className="t-display text-fog-50">Talk to a person at <span className="t-feel text-gold">SPP.</span></h2>
          <p className="mt-6 max-w-md text-lg text-fog-300">Message us on the channel you already use. We reply during business hours, in Lao or English.</p>
          <dl className="mt-8 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="t-label text-fog-500">Studio</dt><dd className="mt-1 text-fog-100">{settings.address.line1}, {settings.address.country}</dd></div>
            <div><dt className="t-label text-fog-500">Hours</dt><dd className="mt-1 text-fog-100">{settings.hours.map((h) => <span key={h.days} className="block">{h.days} · {h.time}</span>)}</dd></div>
          </dl>
          <Link href="/consultation/" className="t-label mt-8 inline-flex min-h-11 items-center gap-3 text-gold hover:text-fog-50">Book a consultation<Arrow /></Link>
        </div>
        <ul className="grid gap-px bg-ink-700 sm:grid-cols-2">
          {channels.map((c) => (
            <li key={c.key} className="bg-ink-900">
              <a href={c.href} target={c.external ? "_blank" : undefined} rel={c.external ? "noopener noreferrer" : undefined} className="group flex min-h-24 items-center gap-4 p-5 transition-colors hover:bg-ink-850">
                <span className="flex h-12 w-12 flex-none items-center justify-center border border-ink-600 text-gold transition-colors group-hover:border-gold group-hover:bg-gold group-hover:text-ink-950">{c.icon}</span>
                <span className="min-w-0"><span className="t-label block text-fog-500">{c.label}</span><span className="mt-1 block truncate text-fog-50">{c.value}</span></span>
                <Arrow className="ml-auto text-fog-500 group-hover:text-gold" />
              </a>
            </li>
          ))}
          {channels.length === 0 && <li className="bg-ink-900 p-6 text-fog-400">Contact details are being added — book a consultation meanwhile.</li>}
        </ul>
      </div>
    </section>
  );
}

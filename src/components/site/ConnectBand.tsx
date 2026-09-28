import Link from "next/link";
import type { SiteSettings } from "@/content/types";
import { formatPhone } from "@/lib/format";
import { T } from "@/lib/i18n";
import type { Key } from "@/lib/i18n/core";
import { whatsappHref } from "@/lib/whatsapp";
import { Copy, type SectionCopy } from "@/components/home/Copy";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { PLATFORM_LABEL, SocialIcon } from "./SocialIcons";

/**
 * GET IN TOUCH — every channel SPP has configured, as one decisive band.
 * Reads Settings → Company & contact, so channels appear the moment SPP fills
 * them in and are hidden (never faked) while empty. On the landing page the
 * heading can be reworded from CMS → Home page (`copy`); the channels cannot.
 */
export function ConnectBand({ settings, copy, plate = "09" }: { settings: SiteSettings; copy?: SectionCopy; plate?: string }) {
  const wa = whatsappHref(settings.whatsapp, { kind: "general" });
  const channels: { key: string; label: string; labelKey?: Key; value: string; href: string; icon: React.ReactNode; external?: boolean }[] = [];
  const phoneIcon = <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
  if (wa) channels.push({ key: "whatsapp", label: "WhatsApp", labelKey: "common.whatsapp", value: formatPhone(settings.whatsapp), href: wa, icon: <SocialIcon platform="whatsapp" />, external: true });
  if (settings.phone) channels.push({ key: "phone", label: "Mobile", labelKey: "common.mobile", value: formatPhone(settings.phone), href: `tel:${settings.phone.replace(/\s/g, "")}`, icon: phoneIcon });
  if (settings.landline) channels.push({ key: "landline", label: "Office", labelKey: "common.office", value: formatPhone(settings.landline), href: `tel:${settings.landline.replace(/\s/g, "")}`, icon: phoneIcon });
  if (settings.email) channels.push({ key: "email", label: "Email", labelKey: "common.email", value: settings.email, href: `mailto:${settings.email}`, icon: <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18v12H3zM3 7l9 6 9-6" /></svg> });
  for (const s of settings.social) channels.push({ key: s.platform, label: PLATFORM_LABEL[s.platform], value: s.handle ? (/^[\w.]+$/.test(s.handle.replace(/^@/, "")) ? `@${s.handle.replace(/^@/, "")}` : s.handle) : s.url.replace(/^https?:\/\/(www\.)?/, ""), href: s.url, icon: <SocialIcon platform={s.platform} />, external: true });

  return (
    <section aria-labelledby="connect-title" className="relative isolate overflow-hidden border-t border-gold/25 bg-ink-900">
      <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 left-0 w-1/2 text-gold/[0.10] [mask-image:linear-gradient(90deg,black,transparent)]" />
      <div className="shell grid gap-12 py-20 lg:grid-cols-[1fr_1.2fr] lg:gap-20 lg:py-28">
        <div>
          <Plate n={plate} className="mb-6"><Copy value={copy?.eyebrow}><T k="connect.plate" /></Copy></Plate>
          <h2 id="connect-title" className="t-display text-fog-50"><Copy value={copy?.title} accent="gold"><T k="connect.title" /> <span className="t-feel text-gold"><T k="connect.titleFeel" /></span></Copy></h2>
          <p className="mt-6 max-w-md text-lg text-fog-300"><Copy value={copy?.lede}><T k="connect.body" /></Copy></p>
          <dl className="mt-8 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="t-label text-fog-500"><T k="connect.studio" /></dt><dd className="mt-1 text-fog-100">{settings.address.line1}, {settings.address.city}, {settings.address.country}</dd></div>
            <div><dt className="t-label text-fog-500"><T k="connect.hours" /></dt><dd className="mt-1 text-fog-100">{settings.hours.map((h) => <span key={h.days} className="block">{h.days} · {h.time}</span>)}</dd></div>
          </dl>
          <Link href="/consultation/" className="t-label mt-8 inline-flex min-h-11 items-center gap-3 text-gold hover:text-fog-50"><T k="common.bookConsultation" /><Arrow /></Link>
        </div>
        <ul className="grid gap-px border border-gold/30 bg-gold/30 sm:grid-cols-2">
          {channels.map((c) => (
            <li key={c.key} className="bg-ink-900">
              <a href={c.href} target={c.external ? "_blank" : undefined} rel={c.external ? "noopener noreferrer" : undefined} className="group flex min-h-24 items-center gap-4 p-5 transition-colors duration-200 ease-[var(--ease-press)] hover:bg-gold hover:text-ink-950">
                <span className="flex h-12 w-12 flex-none items-center justify-center bg-gold text-ink-950 transition-colors group-hover:bg-ink-950 group-hover:text-gold">{c.icon}</span>
                <span className="min-w-0"><span className="t-label block text-fog-500 transition-colors group-hover:text-ink-950/70">{c.labelKey ? <T k={c.labelKey} /> : c.label}</span><span className="mt-1 block truncate text-fog-50 transition-colors group-hover:text-ink-950">{c.value}</span></span>
                <Arrow className="ml-auto text-gold group-hover:text-ink-950" />
              </a>
            </li>
          ))}
          {channels.length === 0 && <li className="bg-ink-900 p-6 text-fog-400"><T k="connect.empty" /></li>}
        </ul>
      </div>
    </section>
  );
}

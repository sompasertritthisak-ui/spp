import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import type { SiteSettings } from "@/content/types";
import { formatPhone } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";
import { primaryNav, secondaryNav } from "./nav-links";
import { PLATFORM_LABEL, SocialIcon } from "./SocialIcons";

export function Footer({ settings }: { settings: SiteSettings }) {
  const wa = whatsappHref(settings.whatsapp, { kind: "general" });
  return (
    <footer className="relative mt-auto border-t border-ink-700 bg-ink-950">
      <div aria-hidden className="colorbar" />
      <div className="shell grid gap-14 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:py-24">
        <div className="flex flex-col gap-6">
          <BrandMark logo={settings.logo} className="h-12 self-start" />
          <p className="max-w-sm text-fog-400">{settings.description}</p>
          <p className="t-label text-fog-500">{settings.legalName} · Est. {settings.foundedYear}</p>
          {settings.legalNameLo && <p lang="lo" className="-mt-4 text-sm text-fog-500">{settings.legalNameLo}</p>}
        </div>

        <nav aria-label="Explore">
          <p className="t-label mb-4 text-fog-500">Explore</p>
          <ul className="flex flex-col">
            {primaryNav.map((l) => (
              <li key={l.href}><Link href={l.href} className="flex min-h-10 items-center text-fog-300 transition-colors hover:text-yellow">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company">
          <p className="t-label mb-4 text-fog-500">Company</p>
          <ul className="flex flex-col">
            {secondaryNav.map((l) => (
              <li key={l.href}><Link href={l.href} className="flex min-h-10 items-center text-fog-300 transition-colors hover:text-yellow">{l.label}</Link></li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="t-label mb-4 text-fog-500">Talk to us</p>
          <address className="flex flex-col gap-1 not-italic text-fog-300">
            <span>{settings.address.line1}, {settings.address.city}, {settings.address.country}</span>
            {settings.phone && <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="min-h-10 content-center hover:text-yellow">{formatPhone(settings.phone)}<span className="t-label ml-2 text-fog-500">mobile</span></a>}
            {settings.landline && <a href={`tel:${settings.landline.replace(/\s/g, "")}`} className="min-h-10 content-center hover:text-yellow">{formatPhone(settings.landline)}<span className="t-label ml-2 text-fog-500">office</span></a>}
            <a href={`mailto:${settings.email}`} className="min-h-10 content-center hover:text-yellow">{settings.email}</a>
          </address>
          <ul className="mt-2 flex flex-wrap gap-x-5">
            {settings.social.map((s) => (
              <li key={s.platform}><a href={s.url} target="_blank" rel="noopener noreferrer" className="t-label flex min-h-10 items-center gap-2 text-fog-400 hover:text-yellow"><SocialIcon platform={s.platform} className="h-4 w-4" />{PLATFORM_LABEL[s.platform]}</a></li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            {wa && <Button href={wa} variant="outline" size="sm">WhatsApp</Button>}
            <Button href="/consultation/" variant="outline" size="sm" arrow>Let&rsquo;s talk</Button>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-700">
        <div className="shell flex flex-col gap-3 py-6 text-fog-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="t-label">© {new Date().getFullYear()} {settings.legalName}</p>
          <p className="t-label flex items-center gap-3"><span aria-hidden className="reg text-fog-500" />Design · Visualise · Print · Promote</p>
          <ul className="flex gap-5">
            <li><Link href="/privacy/" className="t-label hover:text-fog-50">Privacy</Link></li>
            <li><Link href="/terms/" className="t-label hover:text-fog-50">Terms</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

import type { Metadata } from "next";
import { ClientOnly, FormSkeleton } from "@/components/forms/ClientOnly";
import { ContactForm } from "@/components/forms/ContactForm";
import { Locator } from "@/components/forms/Locator";
import { WhatsAppLink } from "@/components/forms/WhatsAppLink";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";
import { titleCase } from "@/lib/format";
import { formatPhone } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";

const description = "Contact SPP in Vientiane, Laos — custom apparel, printing, signage and billboard advertising. Send a message, find our hours and location, or book a consultation.";

export const metadata: Metadata = {
  title: "Contact SPP in Vientiane",
  description,
  alternates: { canonical: absoluteUrl("/contact/") },
  openGraph: { title: "Contact SPP", description, url: absoluteUrl("/contact/") },
};

export default async function ContactPage() {
  const { settings } = await getContent();
  const { address } = settings;
  const wa = whatsappHref(settings.whatsapp, { kind: "general" });
  const maps = `https://www.google.com/maps/search/?api=1&query=${address.lat}%2C${address.lng}`;
  const row = "grid gap-2 border-b border-gold/25 py-5 sm:grid-cols-[9rem_1fr]";
  const link = "inline-flex min-h-11 items-center text-fog-50 underline decoration-gold/40 underline-offset-4 transition-colors hover:text-gold hover:decoration-gold";
  return (
    <>
      <PageHero plate="C" eyebrow="Contact" title={<>Talk to the people who <span className="t-feel text-yellow">make</span> it.</>} lede="A question, a rough idea or a full brief — every message is read by a person at SPP." />
      <section className="bg-ink-950 py-16 lg:py-28">
        <div className="shell grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
          <div>
            <Plate n="01">Find us</Plate>
            <div className="mt-8"><Locator lat={address.lat} lng={address.lng} label={`${settings.companyName} · ${address.city}`} /></div>
            <dl className="mt-8 border-t border-gold/40">
              <div className={row}>
                <dt className="t-label pt-1 text-fog-400">Address</dt>
                <dd className="text-fog-100">
                  <address className="not-italic">{settings.legalName}{settings.legalNameLo && <><br /><span lang="lo">{settings.legalNameLo}</span></>}<br />{address.line1}{address.city && address.city !== address.line1 && !address.line1.includes(address.city) ? `, ${address.city}` : ""}<br />{address.country}</address>
                  <a href={maps} target="_blank" rel="noopener noreferrer" className={`${link} t-label mt-1`}>Open in Google Maps<span className="sr-only"> (opens in a new tab)</span></a>
                </dd>
              </div>
              <div className={row}>
                <dt className="t-label pt-1 text-fog-400">Hours</dt>
                <dd><ul className="flex flex-col gap-1 text-fog-100">{settings.hours.map((h) => <li key={h.days} className="flex flex-wrap justify-between gap-x-6"><span>{h.days}</span><span className="t-data text-fog-300">{h.time}</span></li>)}</ul></dd>
              </div>
              <div className={row}><dt className="t-label pt-1 text-fog-400 sm:pt-3.5">Email</dt><dd><a href={`mailto:${settings.email}`} className={link}>{settings.email}</a></dd></div>
              {settings.phone && <div className={row}><dt className="t-label pt-1 text-fog-400 sm:pt-3.5">Mobile</dt><dd><a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className={`${link} t-data`}>{formatPhone(settings.phone)}</a></dd></div>}
              {settings.landline && <div className={row}><dt className="t-label pt-1 text-fog-400 sm:pt-3.5">Office</dt><dd><a href={`tel:${settings.landline.replace(/[^\d+]/g, "")}`} className={`${link} t-data`}>{formatPhone(settings.landline)}</a></dd></div>}
              {settings.social.length > 0 && (
                <div className={row}>
                  <dt className="t-label pt-1 text-fog-400 sm:pt-3.5">Social</dt>
                  <dd><ul className="flex flex-wrap gap-x-6">{settings.social.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className={link}>{titleCase(s.platform)} · {s.handle}</a></li>)}</ul></dd>
                </div>
              )}
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              {wa && <WhatsAppLink href={wa} source="contact" />}
              <Button href="/consultation/" variant="outline" arrow>Book a consultation</Button>
            </div>
          </div>

          <div>
            <Plate n="02">Send a message</Plate>
            <div className="mt-8">
              <ClientOnly fallback={<FormSkeleton rows={5} />}>
                <ContactForm email={settings.email} whatsapp={settings.whatsapp} />
              </ClientOnly>
              <noscript><p className="text-fog-300">The form needs JavaScript — or simply email {settings.email}.</p></noscript>
            </div>
          </div>
        </div>
      </section>
      <CtaBand title="Already know what you need?" body="Skip the conversation and build the request — we reply with a written quotation." primary={{ href: "/request-quote/", label: "Request a quote" }} secondary={{ href: "/consultation/", label: "Let's talk" }} />
    </>
  );
}

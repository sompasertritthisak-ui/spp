import type { Metadata } from "next";
import { ClientOnly, FormSkeleton } from "@/components/forms/ClientOnly";
import { ConsultationForm } from "@/components/forms/ConsultationForm";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { Plate } from "@/components/ui/Plate";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

const description = "Book a free 15 to 60 minute consultation with SPP in Vientiane — in person, by phone, WhatsApp or video — about uniforms, printing, signage or a billboard campaign.";

export const metadata: Metadata = {
  title: "Book a Consultation",
  description,
  alternates: { canonical: absoluteUrl("/consultation/") },
  openGraph: { title: "Let's build something — book a consultation with SPP", description, url: absoluteUrl("/consultation/") },
};

const EXPECT = [
  { t: "You ask for a time", b: "Pick a length, a preferred slot and an alternative." },
  { t: "We confirm", b: "A person checks the diary and confirms — or suggests another time." },
  { t: "We talk", b: "Bring a logo, a sketch or nothing at all. You leave with a clear next step." },
];

export default async function ConsultationPage() {
  const { settings } = await getContent();
  return (
    <>
      <PageHero plate="T" eyebrow="Consultation" title={<>Let&apos;s build <span className="t-feel text-yellow">something</span>.</>} lede="A short conversation with someone who makes these things every day. Free, and useful even if you are months from ordering." />
      <section className="bg-ink-950 py-16 lg:py-28">
        <div className="shell grid gap-16 lg:grid-cols-[1fr_20rem] lg:gap-20 xl:grid-cols-[1fr_24rem]">
          <div className="min-w-0">
            <ClientOnly fallback={<FormSkeleton rows={6} />}>
              <ConsultationForm email={settings.email} whatsapp={settings.whatsapp} hours={settings.hours} />
            </ClientOnly>
            <noscript><p className="text-fog-300">The booking form needs JavaScript — or email {settings.email} with a time that suits you.</p></noscript>
          </div>
          <aside className="lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:self-start">
            <Plate>What to expect</Plate>
            <ol className="mt-6 rule-t">
              {EXPECT.map((s, i) => (
                <li key={s.t} className="rule-b grid grid-cols-[2.5rem_1fr] gap-3 py-5">
                  <span className="t-data text-fog-500">{String(i + 1).padStart(2, "0")}</span>
                  <span><span className="t-heading block text-fog-50">{s.t}</span><span className="mt-1 block text-fog-400">{s.b}</span></span>
                </li>
              ))}
            </ol>
            <h2 className="t-label mt-10 text-fog-400">Business hours</h2>
            <ul className="mt-3 flex flex-col gap-1 text-fog-100">{settings.hours.map((h) => <li key={h.days} className="flex justify-between gap-4"><span>{h.days}</span><span className="t-data text-fog-300">{h.time}</span></li>)}</ul>
          </aside>
        </div>
      </section>
      <CtaBand title="Ready to skip straight to numbers?" primary={{ href: "/request-quote/", label: "Request a quote" }} secondary={{ href: "/solutions/", label: "Start from a goal" }} />
    </>
  );
}

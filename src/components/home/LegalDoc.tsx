import type { ReactNode } from "react";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Shared frame for the privacy notice and terms: indexed contents, long-form measure, and the template notice up front. */
export function LegalDoc({ eyebrow, title, lede, updated, sections, email }: { eyebrow: string; title: ReactNode; lede: string; updated: string; sections: LegalSection[]; email: string }) {
  return (
    <>
      <PageHero plate="00" eyebrow={eyebrow} title={title} lede={lede} aside={<p className="t-label leading-relaxed text-fog-400">Last updated<br /><span className="text-fog-50">{updated}</span></p>} />
      <div className="border-b border-ink-700 bg-ink-900">
        <div className="shell py-6">
          <p className="max-w-[80ch] border-l-2 border-yellow pl-5 text-base leading-relaxed text-fog-300">
            <strong className="font-semibold text-fog-50">Template notice.</strong> This page is a plain-language template written to describe accurately how this website works. It has not yet been reviewed by legal counsel. SPP should have it reviewed and adapted to Lao law before relying on it.
          </p>
        </div>
      </div>
      <div className="shell grid gap-x-16 gap-y-12 py-16 lg:grid-cols-12 lg:py-24">
        <aside className="lg:col-span-4">
          <nav aria-label="On this page" className="lg:sticky lg:top-[calc(var(--nav-h)+2rem)]">
            <p className="t-label mb-3 text-fog-500">On this page</p>
            <ol className="border-b border-ink-700">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex min-h-11 items-baseline gap-3 border-t border-ink-700 py-2.5 text-base text-fog-300 transition-colors hover:text-yellow">
                    <span className="t-data text-xs text-fog-500">{String(i + 1).padStart(2, "0")}</span>{s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
        <div className="max-w-[68ch] lg:col-span-8">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-[calc(var(--nav-h)+2rem)] border-t border-ink-700 py-10 first:border-t-0 first:pt-0">
              <h2 id={`${s.id}-h`} className="t-title flex items-baseline gap-4 text-fog-50"><span className="t-data text-xs text-yellow">{String(i + 1).padStart(2, "0")}</span>{s.title}</h2>
              <div className="mt-6 space-y-5 text-[1.0625rem] leading-[1.75] text-fog-300 [&_a]:text-fog-50 [&_a]:underline [&_a]:decoration-ink-500 [&_a]:underline-offset-4 [&_a]:hover:text-yellow [&_li]:border-t [&_li]:border-ink-700 [&_li]:py-3 [&_strong]:font-semibold [&_strong]:text-fog-50 [&_ul]:border-b [&_ul]:border-ink-700">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
      <CtaBand title="A question about any of this?" body={`Write to ${email} and a person at SPP will answer.`} primary={{ href: "/contact/", label: "Let's talk" }} secondary={{ href: "/", label: "Back to home" }} />
    </>
  );
}

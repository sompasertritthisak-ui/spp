import Link from "next/link";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import type { Faq } from "@/content/types";
import { JsonLd } from "./JsonLd";

/** One question per topic first, so the five shown cover ordering, artwork, Studio, billboards and delivery. */
export function pickFaqs(faqs: Faq[], max = 5): Faq[] {
  const firstOfTopic = faqs.filter((f, i) => faqs.findIndex((g) => g.topic === f.topic) === i);
  return [...firstOfTopic, ...faqs.filter((f) => !firstOfTopic.includes(f))].slice(0, max);
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="border-b border-paper-ink">
      {faqs.map((f, i) => (
        <details key={f.q} className="group border-t border-paper-line first:border-t-[3px] first:border-t-gold" open={i === 0}>
          <summary className="flex min-h-11 list-none items-baseline gap-4 py-6 [&::-webkit-details-marker]:hidden">
            <span className="t-data w-8 flex-none text-xs text-paper-mute">{String(i + 1).padStart(2, "0")}</span>
            <span className="t-heading flex-1 text-paper-ink">{f.q}</span>
            <span aria-hidden className="relative flex h-7 w-7 flex-none items-center justify-center self-center border border-paper-line transition-colors duration-300 group-open:border-gold group-open:bg-gold">
              <span className="absolute inset-x-1.5 top-1/2 h-px bg-paper-ink" />
              <span className="absolute inset-y-1.5 left-1/2 w-px bg-paper-ink transition-transform duration-300 ease-[var(--ease-press)] group-open:scale-y-0" />
            </span>
          </summary>
          <p className="max-w-[68ch] pb-8 pl-12 text-lg leading-relaxed text-paper-mute">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function HomeFaq({ faqs }: { faqs: Faq[] }) {
  const list = pickFaqs(faqs);
  if (!list.length) return null;
  return (
    <section aria-labelledby="faq-title" className="on-paper">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: list.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <div className="shell grid gap-x-16 gap-y-12 py-20 lg:grid-cols-12 lg:py-32">
        <div className="lg:col-span-4">
          <Plate n="09" tone="paper" className="mb-6">Before you ask</Plate>
          <h2 id="faq-title" className="t-display text-paper-ink">Straight answers.</h2>
          <span aria-hidden className="gold-bar mt-7" />
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-paper-mute">The questions we hear most, answered the way we would answer them at the counter.</p>
          <Link href="/contact/" className="group/btn t-label mt-8 inline-flex min-h-11 items-center gap-3 text-paper-ink transition-colors hover:text-ultra">
            Ask something else <Arrow />
          </Link>
        </div>
        <div className="lg:col-span-8">
          <FaqList faqs={list} />
        </div>
      </div>
    </section>
  );
}

import { Plate } from "@/components/ui/Plate";
import type { Testimonial } from "@/content/types";

/** CONVENTIONS §4: with no published testimonials this section does not exist — no placeholders, no invented quotes. */
export function Testimonials({ items }: { items: Testimonial[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="voices-title" className="border-t border-gold/25 bg-ink-900">
      <div className="shell py-20 lg:py-32">
        <Plate n="08" className="mb-6">In their words</Plate>
        <h2 id="voices-title" className="sr-only">What clients say</h2>
        <ul className="border-b border-gold/30">
          {items.slice(0, 3).map((t) => (
            <li key={`${t.name}-${t.company}`} className="grid gap-x-16 gap-y-5 border-t border-gold/25 py-10 lg:grid-cols-12 lg:py-14">
              <blockquote className="t-title text-fog-50 lg:col-span-8"><span aria-hidden className="text-gold">“</span>{t.quote}<span aria-hidden className="text-gold">”</span></blockquote>
              <p className="t-label self-end leading-relaxed text-fog-400 lg:col-span-4">
                <span className="block text-fog-50">{t.name}</span>
                {[t.role, t.company].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

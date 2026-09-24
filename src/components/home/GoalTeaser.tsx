import Link from "next/link";
import { Arrow, Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { Reveal } from "@/components/ui/Reveal";
import type { Solution } from "@/content/types";

/** Goal-first entry: visitors rarely know the product they need, but they always know what they are trying to do. */
export function GoalTeaser({ solutions }: { solutions: Solution[] }) {
  const list = [...solutions].sort((a, b) => a.order - b.order);
  return (
    <section aria-labelledby="goals-title" className="glow-brand relative isolate overflow-hidden border-y border-gold/25 bg-ink-900">
      <div className="shell grid gap-x-16 gap-y-12 py-20 lg:grid-cols-12 lg:py-32">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-[calc(var(--nav-h)+3rem)]">
            <Plate n="03" className="mb-6">Start from the goal</Plate>
            <h2 id="goals-title" className="t-display text-fog-50">
              What are you trying to <span className="t-feel text-yellow">achieve?</span>
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-fog-300">
              You do not need to know the difference between DTF and sublimation. Tell us the outcome and we will put together the apparel, print, display and outdoor pieces that get you there.
            </p>
            <span aria-hidden className="gold-bar mt-7" />
            <div className="mt-9">
              <Button href="/solutions/" size="lg" arrow>Build my project</Button>
            </div>
          </div>
        </div>

        <ol className="border-b border-gold/30 lg:col-span-7">
          {list.map((s, i) => (
            <Reveal as="li" key={s.slug} i={Math.min(i, 5)}>
              <Link href={`/solutions/?goal=${s.slug}`} className="group/btn grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 border-t border-gold/25 py-6 transition-colors duration-200 hover:bg-gold/5 sm:grid-cols-[3.5rem_1fr_auto] lg:py-7">
                <span className="t-data text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="t-heading block text-fog-50 transition-transform duration-300 ease-[var(--ease-press)] group-hover/btn:translate-x-1.5 sm:text-[clamp(1.375rem,2.2vw,2rem)]">{s.goal}</span>
                  <span className="mt-1.5 block text-base text-fog-400">“{s.prompt}”</span>
                </span>
                <Arrow className="self-center text-fog-500 group-hover/btn:text-yellow" />
              </Link>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { Reveal } from "@/components/ui/Reveal";
import { Copy, type SectionCopy } from "./Copy";
import { HOME_DEFAULTS } from "./defaults";

const D = HOME_DEFAULTS.manifesto;

const VERBS = [
  { n: "01", verb: "Ideate", note: "What are you trying to achieve?" },
  { n: "02", verb: "Design", note: "Artwork built for how it is made." },
  { n: "03", verb: "Visualise", note: "See it before a metre is printed." },
  { n: "04", verb: "Produce", note: "One team, one job number, one QC." },
  { n: "05", verb: "Promote", note: "On the street, and measured." },
] as const;

/**
 * The position statement, straight after the hero: printing is one step of five.
 * This is the page's gold band — the brand's signature surface, ink text only.
 */
export function Manifesto({ copy, plate = "01" }: { copy?: SectionCopy; plate?: string }) {
  return (
    <section aria-labelledby="manifesto-title" className="on-gold relative isolate overflow-hidden">
      <div aria-hidden className="colorbar" />
      <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 right-0 -z-10 w-1/2 text-ink-950/10 [mask-image:linear-gradient(90deg,transparent,black)]" />
      <div className="shell py-20 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <p className="t-label flex items-start gap-3 text-ink-950 lg:col-span-3 lg:pt-4">
            <span aria-hidden className="reg text-ink-950" />
            <span>Plate {plate}<span aria-hidden className="mx-2 opacity-40">—</span><Copy value={copy?.eyebrow} fallback={D.eyebrow} /></span>
          </p>
          <div className="lg:col-span-9">
            <Reveal as="h2" className="t-display text-ink-950">
              <span id="manifesto-title">
                <Copy value={copy?.title} fallback={D.title} accent="box" />
              </span>
            </Reveal>
            <Reveal as="p" i={2} className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-950/70 lg:text-xl">
              <Copy value={copy?.lede} fallback={D.lede} />
            </Reveal>
          </div>
        </div>

        <ol className="mt-16 grid border-t-2 border-ink-950 lg:mt-24 lg:grid-cols-5">
          {VERBS.map((v, i) => (
            <Reveal as="li" key={v.verb} i={i} className="group relative flex items-baseline gap-5 border-b border-ink-950/20 py-5 lg:block lg:border-b-0 lg:border-l lg:py-0 lg:pl-5 lg:pr-3 lg:pt-5 lg:first:border-l-0 lg:first:pl-0">
              <span className="t-data w-8 flex-none text-xs text-ink-950 lg:block lg:w-auto">{v.n}</span>
              <span className="min-w-0 flex-1 lg:mt-10 lg:block">
                <span className="block font-display text-[clamp(2rem,9vw,3rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.04em] text-ink-950 [font-stretch:80%] lg:text-[clamp(1.5rem,2.7vw,3.25rem)]">
                  {v.verb}
                </span>
                <span className="mt-2 block text-base text-ink-950/70 lg:mt-4 lg:max-w-[16ch]">{v.note}</span>
              </span>
              {i < VERBS.length - 1 && (
                <svg aria-hidden viewBox="0 0 20 10" className="hidden h-2.5 w-5 text-ink-950 lg:absolute lg:-right-2.5 lg:top-[1.35rem] lg:block lg:bg-gold" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M0 5h18M14 1l4 4-4 4" />
                </svg>
              )}
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

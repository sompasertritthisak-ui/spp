import { Reveal } from "@/components/ui/Reveal";

const VERBS = [
  { n: "01", verb: "Ideate", note: "What are you trying to achieve?" },
  { n: "02", verb: "Design", note: "Artwork built for how it is made." },
  { n: "03", verb: "Visualise", note: "See it before a metre is printed." },
  { n: "04", verb: "Produce", note: "One team, one job number, one QC." },
  { n: "05", verb: "Promote", note: "On the street, and measured." },
] as const;

/** The position statement, straight after the hero: printing is one step of five. */
export function Manifesto() {
  return (
    <section aria-labelledby="manifesto-title" className="on-paper relative overflow-hidden">
      <div aria-hidden className="colorbar" />
      <div className="shell py-20 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <p className="t-label flex items-start gap-3 text-paper-mute lg:col-span-3 lg:pt-4">
            <span aria-hidden className="reg text-paper-ink" />
            <span>Plate 01<span aria-hidden className="mx-2 opacity-40">—</span>Position</span>
          </p>
          <div className="lg:col-span-9">
            <Reveal as="h2" className="t-display text-paper-ink">
              <span id="manifesto-title">
                SPP does not <span className="relative isolate whitespace-nowrap"><span aria-hidden className="absolute -inset-x-[0.06em] bottom-[0.04em] top-[0.2em] -z-10 bg-yellow" />simply print</span> products.
              </span>
            </Reveal>
            <Reveal as="p" i={2} className="mt-8 max-w-2xl text-lg leading-relaxed text-paper-mute lg:text-xl">
              A printed shirt is an output. The job is everything around it — the idea worth printing, artwork that survives the press, proof you can see before you pay, and a place in the street where it gets noticed.
            </Reveal>
          </div>
        </div>

        <ol className="mt-16 grid border-t border-paper-ink lg:mt-24 lg:grid-cols-5">
          {VERBS.map((v, i) => (
            <Reveal as="li" key={v.verb} i={i} className="group relative flex items-baseline gap-5 border-b border-paper-line py-5 lg:block lg:border-b-0 lg:border-l lg:py-0 lg:pl-5 lg:pr-3 lg:pt-5 lg:first:border-l-0 lg:first:pl-0">
              <span className="t-data w-8 flex-none text-xs text-paper-mute lg:block lg:w-auto">{v.n}</span>
              <span className="min-w-0 flex-1 lg:mt-10 lg:block">
                <span className="block font-display text-[clamp(2rem,9vw,3rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.04em] text-paper-ink [font-stretch:80%] lg:text-[clamp(1.5rem,2.7vw,3.25rem)]">
                  {v.verb}
                </span>
                <span className="mt-2 block text-base text-paper-mute lg:mt-4 lg:max-w-[16ch]">{v.note}</span>
              </span>
              {i < VERBS.length - 1 && (
                <svg aria-hidden viewBox="0 0 20 10" className="hidden h-2.5 w-5 text-paper-ink lg:absolute lg:-right-2.5 lg:top-[1.35rem] lg:block lg:bg-paper" fill="none" stroke="currentColor" strokeWidth="1.5">
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

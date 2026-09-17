import Link from "next/link";
import { DesignThumb } from "@/components/studio/DesignThumb";
import { Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { Reveal } from "@/components/ui/Reveal";
import type { DesignTemplate } from "@/content/types";
import { normaliseLayers } from "@/lib/studio/schema";

const FEATURES = [
  { k: "A", title: "Front and back, side by side", body: "Build both sides of the garment in your browser — text, shapes, your own artwork — and flip between them as you go." },
  { k: "B", title: "A download with your Design ID", body: "Mockups download at preview resolution, watermarked with a Design ID. Quote it to us and we open your exact design — nobody retypes anything." },
  { k: "C", title: "Templates to start from", body: "Corporate, restaurant, sports, school, event and more. Pick one, change the words and colours, make it yours." },
] as const;

/** Picks the side that actually carries artwork for the garment being shown. */
const firstSide = (t: DesignTemplate) => (t.garments[0] === "cap" ? "panel" : "front");

export function StudioTeaser({ templates }: { templates: DesignTemplate[] }) {
  const featured = templates.filter((t) => t.featured && t.garments[0]);
  const picks = (featured.length >= 3 ? featured : templates.filter((t) => t.garments[0])).slice(0, 4);
  const [lead, ...rest] = picks;
  return (
    <section aria-labelledby="studio-title" className="on-paper relative overflow-hidden">
      <div className="shell grid gap-x-16 gap-y-14 py-20 lg:grid-cols-12 lg:py-32">
        <div className="lg:col-span-5">
          <Plate n="04" tone="paper" className="mb-6">SPP Studio</Plate>
          <h2 id="studio-title" className="t-display text-paper-ink">
            See it <span className="t-feel">before</span> it exists.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-paper-mute">
            A mockup designer that runs in your browser — nothing to install. What you approve on screen becomes the reference for everything we produce.
          </p>
          <ol className="mt-10 border-b border-paper-line">
            {FEATURES.map((f) => (
              <li key={f.k} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-t border-paper-line py-5">
                <span className="t-data pt-1 text-xs text-paper-mute">{f.k}</span>
                <span>
                  <span className="t-heading block text-paper-ink">{f.title}</span>
                  <span className="mt-1.5 block text-base leading-relaxed text-paper-mute">{f.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button href="/spp-studio/" variant="paper" size="lg" arrow>Open SPP Studio</Button>
            <p className="t-label max-w-[22rem] leading-relaxed text-paper-mute">Mockups are a close visual guide. Final colours are confirmed on a production proof.</p>
          </div>
        </div>

        {lead && (
          <div className="lg:col-span-7">
            <Reveal className="crop relative border border-paper-line bg-paper-dim [--crop-color:var(--color-paper-mute)]">
              <Link href="/spp-studio/" className="group block" aria-label={`Open SPP Studio — ${lead.name} template, front and back`}>
                <div className="relative grid grid-cols-2 overflow-hidden px-2 pb-4 pt-10 sm:px-8">
                  {(["front", "back"] as const).map((side) => (
                    <DesignThumb key={side} garment={lead.garments[0]!} side={side} colour={lead.suggestedColour} layers={normaliseLayers(lead.sides[side])} title={`${lead.name} template — ${side}`} className="h-auto w-full transition-transform duration-500 ease-[var(--ease-press)] group-hover:-translate-y-1" />
                  ))}
                  {/* the watermark a real download carries — shown without a number, because this is not a saved design */}
                  <span aria-hidden className="t-label pointer-events-none absolute inset-x-0 top-1/2 -rotate-12 text-center text-[0.625rem] text-paper-ink/35 sm:text-xs">
                    SPP Studio · Preview · Design ID ········
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-paper-line px-4 py-3">
                  <span className="t-label text-paper-ink">{lead.name} <span className="text-paper-mute">/ {lead.category}</span></span>
                  <span className="t-label text-paper-mute">Front · Back</span>
                </div>
              </Link>
            </Reveal>

            <ul className="mt-px grid grid-cols-3 gap-px border border-t-0 border-paper-line bg-paper-line">
              {rest.map((t, i) => (
                <Reveal as="li" key={t.slug} i={i + 1} className="bg-paper">
                  <Link href="/spp-studio/" className="group block" aria-label={`Open SPP Studio — ${t.name} template`}>
                    <DesignThumb garment={t.garments[0]!} side={firstSide(t)} colour={t.suggestedColour} layers={normaliseLayers(t.sides[firstSide(t)])} title={`${t.name} template`} className="h-auto w-full p-2 transition-transform duration-500 ease-[var(--ease-press)] group-hover:-translate-y-1 sm:p-4" />
                    <span className="t-label block border-t border-paper-line px-3 py-3 text-[0.625rem] text-paper-ink sm:text-[0.6875rem]">{t.name}</span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

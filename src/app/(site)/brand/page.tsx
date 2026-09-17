import type { ReactNode } from "react";
import { pageMeta } from "@/components/home/seo";
import { LogoPlate } from "@/components/brand/Logo";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero, Section, SectionHead } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { getContent } from "@/lib/content";
import { Palette } from "./_parts/colour";
import { ClearSpace, Construction, LogoVersions, MinimumSize, Misuse } from "./_parts/marks";
import { Mockups } from "./_parts/mockups";
import { Ornaments, Voice } from "./_parts/system";
import { Hierarchy, TypeSpecimens } from "./_parts/type";

export const metadata = pageMeta({
  title: "SPP Brand Guidelines — Logo, Colour, Type & Mockups",
  description: "The SPP identity system: how the wordmark is constructed, logo downloads, clear space, colour values, typography, print ornaments, tone of voice and application mockups.",
  path: "/brand/",
});

const CONTENTS = [
  ["idea", "The idea"], ["logo", "Logo versions"], ["space", "Clear space & size"], ["misuse", "Incorrect use"], ["colour", "Colour"],
  ["type", "Typography"], ["ornament", "Print ornaments"], ["voice", "Tone of voice"], ["applications", "Applications"],
] as const;

function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-[58ch] text-lg leading-relaxed text-fog-300">{children}</p>;
}

export default async function BrandPage() {
  const { settings } = await getContent();
  return (
    <>
      <PageHero
        plate="00"
        eyebrow="SPP brand guidelines"
        title={<>One circle, one dot, one <span className="t-feel text-yellow">yellow.</span></>}
        lede="Everything needed to use the SPP identity correctly — on a screen, a shirt, a van or a billboard. Partners and press are welcome to download the marks below."
        actions={<><Button href="#logo" size="lg" arrow>Download logos</Button><Button href="#applications" size="lg" variant="outline">See it applied</Button></>}
        aside={
          <nav aria-label="Guideline sections" className="hidden lg:block">
            <ol className="min-w-[15rem] columns-1 border-b border-ink-700">
              {CONTENTS.map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="t-label flex min-h-9 items-center gap-4 border-t border-ink-700 text-fog-300 transition-colors hover:text-yellow">
                    <span className="text-fog-500">{String(i + 1).padStart(2, "0")}</span>{label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        }
      />

      <Section id="idea" className="scroll-mt-[var(--nav-h)]">
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <SectionHead plate="01" eyebrow="The idea behind the mark" title="Constructed, not typeset." />
            <div className="space-y-6">
              <Note>The wordmark is drawn, not set in a font. Every curve in S-P-P comes from a single circle of radius 20, on a 100-unit cap height with a constant 20-unit stroke. One module, repeated — the way a press repeats one impression.</Note>
              <Note>Inside the last counter sits the <strong className="font-semibold text-yellow">registration dot</strong>. On press, registration marks tell the operator that every plate is aligned. In the mark it says the same about us: the idea, the design and the finished object line up.</Note>
              <Note>Because it is pure geometry it stays sharp at any size, cuts cleanly in vinyl, stitches cleanly in thread — and can be “printed” onto the screen stroke by stroke.</Note>
            </div>
          </div>
          <div className="crop border border-ink-700 bg-ink-900 p-4 sm:p-8 lg:col-span-7">
            <Construction />
          </div>
        </div>
      </Section>

      <Section id="logo" tone="raised" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="02" eyebrow="Logo versions" title="Four files. That is the whole kit." lede="Vector SVG — scale them to any size. Use the wordmark wherever it fits; the icon is for small squares only." />
        <LogoVersions />
      </Section>

      <Section id="space" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="03" eyebrow="Clear space & minimum size" title="Give it room." />
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="border border-ink-700 bg-ink-900 p-4 sm:p-8 lg:col-span-7">
            <ClearSpace />
          </div>
          <div className="space-y-8 lg:col-span-5">
            <Note>Keep a margin of <strong className="font-semibold text-fog-50">2x</strong> on every side, where x is the stroke width — one fifth of the wordmark’s height. Nothing enters that space: no text, no edge, no other logo.</Note>
            <div>
              <h3 className="t-label mb-4 text-fog-400">Minimum size</h3>
              <MinimumSize />
              <p className="mt-4 text-base text-fog-400">Below these sizes the counters fill in. For embroidery, keep the wordmark at least 25 mm wide so the dot can be stitched.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="misuse" tone="raised" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="04" eyebrow="Incorrect use" title="Eight ways to break it." lede="The mark is simple, so small changes show. If a situation is not covered here, ask us — we would rather redraw an application than see the mark bent to fit one." />
        <Misuse />
      </Section>

      <Section id="colour" tone="paper" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="05" tone="paper" eyebrow="Colour" title="The press room at midnight." lede="A near-black ground, a warm paper inverse and one hot accent. Cyan and magenta exist only as printer’s details." />
        <Palette />
      </Section>

      <Section id="type" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="06" eyebrow="Typography" title="Four faces, four jobs." lede="All four are open-licence typefaces, self-hosted with the site. Each has one role and keeps to it." />
        <TypeSpecimens />
        <div className="mt-16 grid gap-x-16 gap-y-8 lg:grid-cols-12">
          <h3 className="t-title text-fog-50 lg:col-span-4">Together</h3>
          <div className="lg:col-span-8"><Hierarchy /></div>
        </div>
      </Section>

      <Section id="ornament" tone="raised" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="07" eyebrow="The print-ornament system" title="Borrowed from the press sheet." lede="The marks a printer leaves in the margin are our decoration. Use one or two per view — they are seasoning, not the meal. Corners are always square." />
        <Ornaments />
      </Section>

      <Section id="voice" tone="paper" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="08" tone="paper" eyebrow="Tone of voice" title="Plain, specific, honest." lede="We write the way a good production manager talks: short sentences, real numbers, no superlatives. British spelling — colour, visualise, customise." />
        <Voice />
      </Section>

      <Section id="applications" className="scroll-mt-[var(--nav-h)]">
        <SectionHead
          plate="09"
          eyebrow="Applications"
          title="On everything we make."
          lede="Drawn mockups showing placement, scale and colour on the products SPP produces. The garments use the same geometry as SPP Studio."
          action={<LogoPlate className="hidden h-20 w-20 lg:block" />}
        />
        <Mockups email={settings.email} city={`${settings.address.city}, ${settings.address.country}`} />
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button href="#logo" variant="outline" size="lg">Download logos</Button>
          <p className="max-w-xl text-base text-fog-400">
            Need a format that is not here — EPS, PDF, embroidery file? Write to <a className="text-fog-50 underline decoration-ink-500 underline-offset-4 hover:text-yellow" href={`mailto:${settings.email}`}>{settings.email}</a>.
          </p>
        </div>
      </Section>

      <CtaBand
        title="Now put your own mark on something."
        body="The same care goes into your brand. Try it on a shirt in SPP Studio, or ask our designers to build your identity."
        primary={{ href: "/spp-studio/", label: "Open SPP Studio" }}
        secondary={{ href: "/request-quote/?service=graphic-design", label: "Request this service" }}
      />
    </>
  );
}

import type { ReactNode } from "react";
import { pageMeta } from "@/components/home/seo";
import { Roundel } from "@/components/brand/Logo";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero, Section, SectionHead } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { getContent } from "@/lib/content";
import { Palette } from "./_parts/colour";
import { Anatomy, ClearSpace, LogoVersions, MinimumSize, Misuse } from "./_parts/marks";
import { Mockups } from "./_parts/mockups";
import { Ornaments, Voice } from "./_parts/system";
import { Hierarchy, TypeSpecimens } from "./_parts/type";

export const metadata = pageMeta({
  title: "SPP Brand Guidelines — Logo, Colour, Type & Mockups",
  description: "The SPP identity system: the parts of the SPP roundel, logo downloads, clear space and minimum size, colour values, typography, print ornaments, tone of voice and application mockups.",
  path: "/brand/",
});

const CONTENTS = [
  ["idea", "The mark"], ["logo", "Logo versions"], ["space", "Clear space & size"], ["misuse", "Incorrect use"], ["colour", "Colour"],
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
        title={<>The SPP <span className="t-feel text-yellow">roundel.</span></>}
        lede="Indigo, sky and gold in one circle. Everything needed to use the SPP identity correctly — on a screen, a shirt, a van or a billboard. Partners and press are welcome to download the marks below."
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
            <SectionHead plate="01" eyebrow="The parts of the mark" title="One circle, two blues, three letters." />
            <div className="space-y-6">
              <Note>The SPP mark is a circle divided by a wave. To the left of the seam sits deep indigo — on this site, the colour of the press room; to the right, sky blue — the open air our billboards stand in. A thin white seam separates the two.</Note>
              <Note>Down that seam run the letters <strong className="font-semibold text-yellow">S, P, P</strong> in gold italic serif, stacked one above the other, and along the base, in small white capitals, the company name: <span className="t-label text-fog-50">SOLE CO., LTD</span>.</Note>
              <Note>The mark on this site was redrawn as vector from SPP’s printed collateral, so it stays sharp at any size — on screen, in vinyl, in thread — and every file below shares one set of curves.</Note>
            </div>
          </div>
          <div className="crop border border-ink-700 bg-ink-900 p-4 sm:p-8 lg:col-span-7">
            <Anatomy />
          </div>
        </div>
      </Section>

      <Section id="logo" tone="raised" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="02" eyebrow="Logo versions" title="Three files. That is the whole kit." lede="Vector SVG — scale them to any size. Full colour wherever the process allows; the one-colour versions are for single-thread, single-screen and engraved work." />
        <LogoVersions />
      </Section>

      <Section id="space" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="03" eyebrow="Clear space & minimum size" title="Give it room." />
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="border border-ink-700 bg-ink-900 p-4 sm:p-8 lg:col-span-7">
            <ClearSpace />
          </div>
          <div className="space-y-8 lg:col-span-5">
            <Note>Keep a margin of <strong className="font-semibold text-fog-50">x</strong> on every side, where x is the height of the “S” — about a quarter of the roundel’s diameter. Nothing enters that space: no text, no edge, no other logo.</Note>
            <div>
              <h3 className="t-label mb-4 text-fog-400">Minimum size</h3>
              <MinimumSize />
              <p className="mt-4 text-base text-fog-400">Below these sizes the base text “SOLE CO., LTD” is dropped and the roundel carries the letters alone. For embroidery, keep the roundel at least 30 mm across so the base text stitches — or drop it.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="misuse" tone="raised" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="04" eyebrow="Incorrect use" title="Eight ways to break it." lede="The roundel is one piece: circle, seam, letters, base text. Change any part and it stops being ours. If a situation is not covered here, ask us — we would rather redraw an application than see the mark bent to fit one." />
        <Misuse />
      </Section>

      <Section id="colour" tone="paper" className="scroll-mt-[var(--nav-h)]">
        <SectionHead plate="05" tone="paper" eyebrow="Colour" title="Gold, sky and the deep blue of midnight." lede="SPP’s colours are gold, light blue, a deep blue that leans to purple, and a little white. Indigo carries the page, gold makes the point, sky informs. Process cyan and magenta survive only as printer’s details." />
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
          action={<Roundel className="hidden h-20 w-20 lg:block" />}
        />
        <Mockups email={settings.email} city={`${settings.address.city}, ${settings.address.country}`} />
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button href="#logo" variant="outline" size="lg">Download logos</Button>
          <p className="max-w-xl text-base text-fog-400">
            Need a format that is not here — EPS, PDF, embroidery file? Write to <a className="text-sky underline decoration-sky/40 underline-offset-4 hover:text-yellow" href={`mailto:${settings.email}`}>{settings.email}</a>.
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

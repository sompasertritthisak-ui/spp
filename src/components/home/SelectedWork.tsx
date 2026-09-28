import Link from "next/link";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { Reveal } from "@/components/ui/Reveal";
import type { PortfolioProject } from "@/content/types";
import { Copy, type SectionCopy } from "./Copy";
import { CoverArt, SampleBadge } from "./CoverArt";
import { HOME_DEFAULTS } from "./defaults";

const D = HOME_DEFAULTS.work;

/** The projects the landing page shows: the ones chosen in the Home page editor, else the featured ones. */
export function pickProjects(projects: PortfolioProject[], only: string[] = []): PortfolioProject[] {
  const chosen = only.map((slug) => projects.find((p) => p.slug === slug)).filter((p): p is PortfolioProject => p !== undefined);
  if (chosen.length) return chosen;
  const featured = projects.filter((p) => p.featured);
  return (featured.length ? featured : projects).slice(0, 3);
}

export function SelectedWork({ projects, only, copy, plate = "07" }: { projects: PortfolioProject[]; only?: string[]; copy?: SectionCopy; plate?: string }) {
  const list = pickProjects(projects, only);
  if (!list.length) return null;
  const anySample = list.some((p) => p.isSample);
  return (
    <section aria-labelledby="work-title" className="relative isolate overflow-hidden bg-ink-950">
      <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 right-0 -z-10 w-1/2 text-gold/[0.10] [mask-image:radial-gradient(ellipse_at_85%_15%,black,transparent_70%)]" />
      <div className="shell py-20 lg:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6 lg:mb-16">
          <div className="max-w-3xl">
            <Plate n={plate} className="mb-6"><Copy value={copy?.eyebrow} fallback={D.eyebrow} /></Plate>
            <h2 id="work-title" className="t-display text-fog-50"><Copy value={copy?.title} fallback={D.title} accent="feel" /></h2>
            <span aria-hidden className="gold-bar mt-7" />
            {anySample && (
              <p className="mt-6 max-w-xl text-base text-fog-400">
                Entries marked “Sample project” are illustrative: they show how SPP structures a job, with fictional clients, until real case studies are published here.
              </p>
            )}
          </div>
          <Link href="/portfolio/" className="group/btn t-label inline-flex min-h-11 items-center gap-3 text-fog-50 transition-colors hover:text-yellow">
            All work <Arrow />
          </Link>
        </div>

        <ul className="grid gap-x-10 gap-y-16 lg:grid-cols-12">
          {list.map((p, i) => (
            <Reveal as="li" key={p.slug} i={i} className={i % 2 === 0 ? "lg:col-span-7" : "lg:col-span-5 lg:mt-40"}>
              <WorkCard project={p} index={i} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function WorkCard({ project: p, index, headingLevel = "h3" }: { project: PortfolioProject; index: number; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <Link href={`/portfolio/${p.slug}/`} className="group/btn block">
      <div className="relative aspect-[4/3] overflow-hidden border border-gold/30 border-t-[3px] border-t-gold transition-colors duration-300 group-hover/btn:border-gold">
        <CoverArt project={p} className="transition-transform duration-700 ease-[var(--ease-press)] group-hover/btn:scale-[1.03]" />
        {p.isSample && <SampleBadge className="absolute left-3 top-3" />}
      </div>
      <div className="mt-5 grid grid-cols-[2.5rem_1fr] gap-x-3">
        <span className="t-data pt-1.5 text-xs text-gold">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <p className="t-label text-fog-400">{p.client} · {p.sector} · {p.year}</p>
          <H className="t-title mt-3 text-fog-50 transition-colors group-hover/btn:text-yellow">{p.title}</H>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-fog-300">{p.summary}</p>
          <span className="t-label mt-5 inline-flex min-h-11 items-center gap-3 text-fog-50 transition-colors group-hover/btn:text-gold">View case study <Arrow /></span>
        </div>
      </div>
    </Link>
  );
}

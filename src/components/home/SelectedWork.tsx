import Link from "next/link";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { Reveal } from "@/components/ui/Reveal";
import type { PortfolioProject } from "@/content/types";
import { CoverArt, SampleBadge } from "./CoverArt";

export function SelectedWork({ projects }: { projects: PortfolioProject[] }) {
  const featured = projects.filter((p) => p.featured);
  const list = (featured.length ? featured : projects).slice(0, 3);
  if (!list.length) return null;
  const anySample = list.some((p) => p.isSample);
  return (
    <section aria-labelledby="work-title" className="bg-ink-950">
      <div className="shell py-20 lg:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6 lg:mb-16">
          <div className="max-w-3xl">
            <Plate n="07" className="mb-6">Selected work</Plate>
            <h2 id="work-title" className="t-display text-fog-50">Projects, not purchases.</h2>
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
      <div className="relative aspect-[4/3] overflow-hidden border border-ink-700">
        <CoverArt project={p} className="transition-transform duration-700 ease-[var(--ease-press)] group-hover/btn:scale-[1.03]" />
        {p.isSample && <SampleBadge className="absolute left-3 top-3" />}
      </div>
      <div className="mt-5 grid grid-cols-[2.5rem_1fr] gap-x-3">
        <span className="t-data pt-1.5 text-xs text-fog-500">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <p className="t-label text-fog-400">{p.client} · {p.sector} · {p.year}</p>
          <H className="t-title mt-3 text-fog-50 transition-colors group-hover/btn:text-yellow">{p.title}</H>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-fog-300">{p.summary}</p>
          <span className="t-label mt-5 inline-flex min-h-11 items-center gap-3 text-fog-50">View case study <Arrow /></span>
        </div>
      </div>
    </Link>
  );
}

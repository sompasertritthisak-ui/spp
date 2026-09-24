"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Arrow } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { PlateVisual, type PlateKey } from "./PlateVisuals";

type Step = { key: PlateKey; n: string; name: string; title: ReactNode; body: string; points: string[]; href: string; cta: string };

const STEPS: Step[] = [
  {
    key: "idea", n: "01", name: "Idea",
    title: <>It starts as a <span className="t-feel text-yellow">hunch.</span></>,
    body: "Bring a name, a sketch on a napkin, a reference photo — or nothing but a date. We begin with what you are trying to achieve, then work out what needs to exist to get you there.",
    points: ["Goal-first project planning", "Consultation in person or online", "A recommended mix, not a price list"],
    href: "/solutions/", cta: "Build my project",
  },
  {
    key: "design", n: "02", name: "Design",
    title: <>Then it gets a <span className="t-feel text-yellow">shape.</span></>,
    body: "Our designers start from the garment, the substrate and the viewing distance. Artwork that ignores production gets rebuilt at the press — ours is drawn to be made.",
    points: ["Logos and identity refinement", "Apparel, print and signage artwork", "Print-ready files, checked by people"],
    href: "/services/", cta: "Explore our services",
  },
  {
    key: "visualise", n: "03", name: "Visualise",
    title: <>You see it before it is <span className="t-feel text-yellow">real.</span></>,
    body: "SPP Studio puts your design on the shirt — front, back and sleeve — in your browser. Approvals get faster because nobody has to imagine anything.",
    points: ["Front and back mockups", "Download stamped with your Design ID", "Billboard artwork previewed in place"],
    href: "/spp-studio/", cta: "Open SPP Studio",
  },
  {
    key: "produce", n: "04", name: "Produce",
    title: <>Every plate lands in <span className="t-feel text-yellow">register.</span></>,
    body: "Screen, DTF, sublimation, embroidery, offset and large-format under one roof. One team owns the job from artwork check to quality control, through the same tracked stages every time.",
    points: ["A production proof before anything is printed", "One job number across every product", "Quality control before it leaves"],
    href: "/products/", cta: "See what we make",
  },
  {
    key: "promote", n: "05", name: "Promote",
    title: <>And then it is <span className="t-feel text-yellow">seen.</span></>,
    body: "A shirt, a banner and a billboard are stronger together. We plan the physical campaign as one system — and attach QR tracking, so you can see what the street sent you.",
    points: ["Billboard sites across Laos", "Vehicle branding and event display", "QR tracking per location"],
    href: "/billboards/", cta: "Explore billboards",
  },
];

/**
 * Scroll storytelling without a scroll library: the stage is `position: sticky`,
 * one IntersectionObserver watches a thin band at mid-viewport, and CSS
 * transitions register each drawing. Below `lg` the stage is dropped and each
 * plate carries its own drawing, so nothing depends on sticky behaviour on phones.
 */
export function FivePlates() {
  const steps = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  // Until JS arms the sequence, every drawing renders finished (no-JS and first paint).
  const [seen, setSeen] = useState<boolean[] | null>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const raf = requestAnimationFrame(() => setSeen((s) => s ?? STEPS.map(() => false)));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = steps.current.indexOf(e.target as HTMLElement);
          if (i < 0) continue;
          setActive(i);
          setSeen((s) => { const next = s ? [...s] : STEPS.map(() => false); next[i] = true; return next; });
        }
      },
      { rootMargin: "-42% 0px -42% 0px", threshold: 0 },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  const isOn = (i: number) => seen === null || Boolean(seen[i]);

  return (
    <section aria-labelledby="plates-title" className="relative bg-ink-950">
      <div className="shell pt-20 lg:pt-32">
        <Plate n="02" className="mb-6">How an idea becomes an object</Plate>
        <h2 id="plates-title" className="t-display max-w-5xl text-fog-50">Five plates. One impression.</h2>
        <p className="t-lede mt-6 max-w-2xl">
          A full-colour print is several plates laid down in perfect register. A project is the same: five separate crafts that only work when they line up.
        </p>
        <span aria-hidden className="gold-bar mt-7" />
      </div>

      <div className="shell mt-10 grid gap-x-16 lg:mt-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* sticky stage — desktop only */}
        <div className="hidden lg:block">
          <div className="sticky top-[var(--nav-h)] flex h-[calc(100dvh-var(--nav-h))] items-center">
            <div className="w-full max-w-[36rem]">
              <div className="crop relative aspect-square border border-gold/30 bg-ink-900 [--crop-color:var(--color-gold)]">
                {STEPS.map((s, i) => (
                  <div key={s.key} aria-hidden={i !== active} className="absolute inset-0 transition-opacity duration-500 ease-[var(--ease-press)]" style={{ opacity: i === active ? 1 : 0 }}>
                    <PlateVisual plate={s.key} on={isOn(i) && i === active} />
                  </div>
                ))}
                <p className="t-label absolute left-4 top-4 text-fog-400">Plate <span className="text-gold">{STEPS[active]?.n}</span> / 05</p>
                <p className="t-label absolute right-4 top-4 text-yellow">{STEPS[active]?.name}</p>
              </div>
              <nav aria-label="Plates" className="mt-8 flex gap-1.5">
                {STEPS.map((s, i) => (
                  <a key={s.key} href={`#plate-${s.key}`} aria-current={i === active ? "step" : undefined} className="group flex min-h-11 flex-1 flex-col justify-end gap-2">
                    <span className={`t-label transition-colors ${i === active ? "text-gold" : "text-fog-500 group-hover:text-gold"}`}>{s.n}<span className="sr-only"> {s.name}</span></span>
                    <span className={`h-0.5 origin-left transition-[transform,background-color] duration-500 ease-[var(--ease-press)] ${i === active ? "bg-gold" : i < active ? "bg-sky" : "bg-gold/25"}`} />
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <ol className="lg:py-[12vh]">
          {STEPS.map((s, i) => (
            <li key={s.key} id={`plate-${s.key}`} ref={(el) => { steps.current[i] = el; }} className="flex scroll-mt-[var(--nav-h)] flex-col justify-center border-t border-gold/25 py-14 first:border-t-0 lg:min-h-[78vh] lg:border-t-0 lg:py-16">
              <div className="crop mx-auto mb-12 aspect-square w-[calc(100%-2.5rem)] max-w-sm border border-gold/30 bg-ink-900 [--crop-color:var(--color-gold)] lg:hidden">
                <PlateVisual plate={s.key} on={isOn(i)} />
              </div>
              <p className="flex items-baseline gap-4">
                <span className={`t-data text-5xl font-medium leading-none transition-colors duration-500 lg:text-7xl ${i === active ? "text-gold" : "text-gold/35"}`}>{s.n}</span>
                <span className="t-label text-fog-400">{s.name}</span>
              </p>
              <h3 className="t-title mt-6 max-w-[18ch] text-fog-50">{s.title}</h3>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-fog-300">{s.body}</p>
              <ul className="mt-8 max-w-xl">
                {s.points.map((p) => (
                  <li key={p} className="flex items-baseline gap-4 border-t border-gold/20 py-3 text-fog-100">
                    <span aria-hidden className="h-1.5 w-1.5 flex-none -translate-y-0.5 bg-yellow" />
                    {p}
                  </li>
                ))}
              </ul>
              <Link href={s.href} className="group/btn t-label mt-8 inline-flex min-h-11 items-center gap-3 self-start text-fog-50 transition-colors hover:text-yellow">
                {s.cta}
                <Arrow />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { Reveal } from "@/components/ui/Reveal";
import type { Billboard } from "@/content/types";

/**
 * The network as typography. Every figure is derived from the published
 * billboard list at build time — nothing here is a marketing number.
 * Provinces run north → south by latitude, one mark per site, so the list
 * reads as a rough map without drawing one.
 */
export function OutdoorTeaser({ billboards }: { billboards: Billboard[] }) {
  if (!billboards.length) return null;
  const byProvince = new Map<string, Billboard[]>();
  for (const b of billboards) byProvince.set(b.province, [...(byProvince.get(b.province) ?? []), b]);
  const provinces = [...byProvince.entries()]
    .map(([name, sites]) => ({ name, sites, lat: sites.reduce((s, b) => s + b.lat, 0) / sites.length }))
    .sort((a, b) => b.lat - a.lat);
  const available = billboards.filter((b) => b.status === "available").length;
  const lit = billboards.filter((b) => b.lit).length;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section aria-labelledby="outdoor-title" className="grain glow-brand relative isolate overflow-hidden bg-ink-950">
      <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/2 text-gold/[0.12] [mask-image:radial-gradient(ellipse_at_20%_60%,black,transparent_70%)]" />
      <div className="shell py-20 lg:py-32">
        <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Plate n="05" className="mb-6">SPP Outdoor Network</Plate>
            <h2 id="outdoor-title" className="t-display text-fog-50">
              The biggest print we make is <span className="t-feel text-yellow">the street.</span>
            </h2>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-fog-300 lg:col-span-5">
            Billboard sites across Laos, browsable by province, size and availability. Preview your artwork on the structure, then request the location and dates you want.
          </p>
        </div>

        <div className="mt-16 grid gap-x-16 gap-y-14 lg:mt-24 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal className="flex items-end gap-5 border-t-2 border-gold pt-5 sm:gap-8">
              <p className="t-data order-1 text-[clamp(7rem,26vw,20rem)] font-medium leading-[0.78] tracking-[-0.06em] text-yellow">{pad(billboards.length)}</p>
              <p className="t-label order-2 max-w-[10rem] pb-2 leading-relaxed text-fog-300 sm:pb-5">billboard sites in the network</p>
            </Reveal>
            <div className="mt-10 grid grid-cols-2 gap-x-6 sm:mt-14 sm:gap-x-10">
              {[
                { v: pad(provinces.length), l: "provinces covered" },
                { v: pad(available), l: "sites available now" },
              ].map((s, i) => (
                <Reveal key={s.l} i={i + 1} className="border-t border-gold/40 pt-4">
                  <p className="t-data text-[clamp(3.5rem,9vw,7.5rem)] font-medium leading-[0.85] tracking-[-0.05em] text-gold">{s.v}</p>
                  <p className="t-label mt-4 text-fog-400">{s.l}</p>
                </Reveal>
              ))}
            </div>
            <p className="t-label mt-10 leading-relaxed text-fog-500">
              <span className="text-sky">{pad(lit)} illuminated</span> · figures counted from the live site list
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="flex items-center justify-between border-b border-gold/40 pb-3">
              <p className="t-label text-fog-400">N ↓ S · one mark per site</p>
              <p className="t-label flex items-center gap-4 text-fog-400">
                <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-yellow" />Available</span>
                <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full border border-fog-500" />Not now</span>
              </p>
            </div>
            <ul>
              {provinces.map((p) => {
                const open = p.sites.filter((b) => b.status === "available").length;
                return (
                  <li key={p.name} className="flex items-center justify-between gap-4 border-b border-gold/20 py-2.5">
                    <span className="text-base text-fog-100">{p.name}</span>
                    <span className="flex items-center gap-1.5" role="img" aria-label={`${p.sites.length} ${p.sites.length === 1 ? "site" : "sites"}, ${open} available now`}>
                      {p.sites.map((b) => (
                        <span key={b.code} aria-hidden className={`h-2 w-2 rounded-full ${b.status === "available" ? "bg-yellow" : "border border-fog-500"}`} />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4 lg:mt-20">
          <Button href="/billboards/" size="lg" arrow>Explore billboards</Button>
          <p className="max-w-md text-base text-fog-400">A request is not a booking. SPP checks availability for your dates and replies with a confirmation.</p>
        </div>
      </div>
    </section>
  );
}

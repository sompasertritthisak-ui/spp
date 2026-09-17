import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BillboardExperience } from "@/components/billboards/BillboardExperience";
import { LocatorMap } from "@/components/map/LocatorMap";
import { StatusTag } from "@/components/map/StatusGlyph";
import { CtaBand } from "@/components/site/CtaBand";
import { Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { SIZE_CLASSES, STATUS, dms, guidePrice, nearestSites, toSite } from "@/lib/geo/sites";

export const dynamicParams = false;

export async function generateStaticParams() {
  const { billboards } = await getContent();
  return billboards.map((b) => ({ id: b.code }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const b = (await getContent()).billboards.find((x) => x.code === id);
  if (!b) return {};
  const title = `${b.name} Billboard, ${b.province} — ${b.widthM} × ${b.heightM} m (${b.code})`;
  const description = `${b.description} ${b.widthM} × ${b.heightM} m ${b.lit ? "illuminated" : "unlit"} billboard in ${b.district}, ${b.province}. Check availability, preview your artwork on the structure and request your dates with SPP.`;
  const url = absoluteUrl(`/billboards/${b.code}/`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

const PRICING_MODEL = { fixed: "Fixed monthly rental", estimated: "Guide price — confirmed by quotation", quote: "Quoted on request" } as const;

export default async function BillboardPage({ params }: Props) {
  const { id } = await params;
  const { billboards, flags, settings } = await getContent();
  const b = billboards.find((x) => x.code === id);
  if (!b) notFound();

  const site = toSite(b);
  const all = billboards.map(toSite);
  const nearby = nearestSites(site, all, 3);
  const price = guidePrice(b, flags.ONLINE_PRICING);
  const url = absoluteUrl(`/billboards/${b.code}/`);
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
  const sizeClass = SIZE_CLASSES.find((c) => c.key === site.sizeClass);

  const specs: [string, React.ReactNode][] = [
    ["Location ID", <span key="v" className="t-data">{b.code}</span>],
    ["Location", `${b.name}, ${b.district} District, ${b.province}`],
    ["Address", b.address],
    ["GPS", <span key="v" className="t-data">{b.lat.toFixed(4)}, {b.lng.toFixed(4)} <span className="text-fog-500">· {dms(b.lat, b.lng)}</span></span>],
    ["Face dimensions", <span key="v" className="t-data">{b.widthM} × {b.heightM} m · {b.widthM * b.heightM} m²{sizeClass ? ` · ${sizeClass.label}` : ""}</span>],
    ["Orientation", b.orientation === "landscape" ? "Landscape" : "Portrait"],
    ["Faces", b.faces === 2 ? "2 — double-sided" : "1 — single-sided"],
    ["Facing", b.facing],
    ["Visibility", b.visibility],
    ["Traffic", b.traffic ?? <span key="v" className="text-fog-400">Not yet surveyed</span>],
    ["Availability", <span key="v" className="flex flex-wrap items-center gap-x-4 gap-y-1"><StatusTag status={b.status} /><span className="text-fog-400">{b.availableFrom && b.status !== "available" && b.status !== "unavailable" ? `Expected free from ${formatDate(b.availableFrom)}` : STATUS[b.status].blurb}</span></span>],
    ["Pricing model", <span key="v">{PRICING_MODEL[b.pricingMode]}{price && <span className="t-data ml-3 text-gold">{price}</span>}</span>],
    ["Minimum term", `${b.minMonths} ${b.minMonths === 1 ? "month" : "months"}`],
    ["Installation", b.installation],
  ];

  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Billboards", item: absoluteUrl("/billboards/") }, { "@type": "ListItem", position: 3, name: b.name, item: url }] },
    { "@context": "https://schema.org", "@type": "Place", name: `${b.name} billboard (${b.code})`, description: b.description, url, address: { "@type": "PostalAddress", addressLocality: b.district, addressRegion: b.province, addressCountry: "LA" }, geo: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } },
  ];

  return (
    <>
      {ld.map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, "\\u003c") }} />)}

      <section className="grain relative isolate border-b border-ink-700 pt-[calc(var(--nav-h)+3rem)] lg:pt-[calc(var(--nav-h)+5rem)]">
        <div className="shell pb-12 lg:pb-16">
          <nav aria-label="Breadcrumb" className="t-label mb-8 flex flex-wrap items-center gap-2 text-[0.625rem] text-fog-500">
            <Link href="/" className="hover:text-fog-50">Home</Link><span aria-hidden>/</span>
            <Link href="/billboards/" className="hover:text-fog-50">Billboards</Link><span aria-hidden>/</span>
            <span aria-current="page" className="text-fog-300">{b.code}</span>
          </nav>
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <Plate className="mb-6">{b.province} · {b.district}</Plate>
              <h1 className="t-display text-fog-50 [animation:ink-in_.9s_var(--ease-sheet)_both]">{b.name}</h1>
              <p className="t-lede mt-6 max-w-2xl">{b.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {b.status !== "unavailable" && <Button href="#request" arrow>Request this location</Button>}
                <Button href="#visualise" variant="outline">Visualise it</Button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 lg:w-[24rem]">
              <div className="bg-ink-950 p-4"><dt className="t-label text-[0.5625rem] text-fog-500">Face</dt><dd className="t-data mt-1.5 text-xl text-fog-50">{b.widthM} × {b.heightM} m</dd></div>
              <div className="bg-ink-950 p-4"><dt className="t-label text-[0.5625rem] text-fog-500">Status</dt><dd className="mt-2"><StatusTag status={b.status} /></dd></div>
              <div className="bg-ink-950 p-4"><dt className="t-label text-[0.5625rem] text-fog-500">Lighting</dt><dd className="mt-1.5 text-fog-50">{b.lit ? "Illuminated" : "Not illuminated"}</dd></div>
              <div className="bg-ink-950 p-4"><dt className="t-label text-[0.5625rem] text-fog-500">Guide</dt><dd className="t-data mt-1.5 text-fog-50">{price ?? "On request"}</dd></div>
            </dl>
          </div>
          {!b.verified && <p className="mt-10 max-w-3xl border-l border-warn/60 pl-4 text-sm leading-relaxed text-fog-400"><span className="t-label mr-2 text-[0.625rem] text-warn">Unverified</span>Pending SPP site confirmation. Dimensions, facing and lighting come from SPP&rsquo;s existing records and will be re-checked on site before any booking is confirmed.</p>}
        </div>
      </section>

      <section aria-labelledby="spec-h" className="bg-ink-950 py-16 lg:py-24">
        <div className="shell grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-20">
          <div>
            <Plate n="01" className="mb-6">Specification</Plate>
            <h2 id="spec-h" className="t-title mb-8 text-fog-50">The site, on the record.</h2>
            <dl className="border-t border-ink-700">
              {specs.map(([k, v]) => <div key={k} className="grid gap-1 border-b border-ink-700 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6"><dt className="t-label pt-1 text-[0.625rem] text-fog-500">{k}</dt><dd className="text-fog-100">{v}</dd></div>)}
            </dl>
          </div>
          <aside aria-label="Where it is" className="flex flex-col gap-4 lg:pt-[4.5rem]">
            <LocatorMap site={site} others={all.filter((s) => s.code !== site.code)} />
            <div className="flex flex-wrap gap-3">
              <Button href={gmaps} variant="outline" size="sm">Open in Google Maps</Button>
              <Button href={`/billboards/?site=${b.code}`} variant="ghost" size="sm">Show on the network map</Button>
            </div>
            <p className="text-xs leading-relaxed text-fog-500">Opens Google Maps in a new tab at these coordinates. Map outline is indicative, not a legal boundary.</p>
          </aside>
        </div>
      </section>

      <BillboardExperience billboard={b} bookingOn={flags.BILLBOARD_BOOKING} channels={{ whatsapp: settings.whatsapp, email: settings.email }} />

      {nearby.length > 0 && (
        <section aria-labelledby="near-h" className="border-t border-ink-700 bg-ink-900 py-16 lg:py-24">
          <div className="shell">
            <Plate n="04" className="mb-6">Nearby</Plate>
            <h2 id="near-h" className="t-title mb-8 text-fog-50">Closest sites in the network</h2>
            <ul className="border-t border-ink-700">
              {nearby.map(({ site: s, km }) => (
                <li key={s.code} className="border-b border-ink-700">
                  <Link href={`/billboards/${s.code}/`} className="group grid min-h-16 grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 py-4 sm:grid-cols-[7rem_1fr_auto_auto]">
                    <span className="t-data hidden text-sm text-fog-500 sm:block">{s.code}</span>
                    <span><span className="block font-medium text-fog-50 transition-colors duration-150 group-hover:text-gold">{s.name}</span><span className="text-sm text-fog-400">{s.province} · {s.widthM} × {s.heightM} m</span></span>
                    <StatusTag status={s.status} className="hidden text-[0.5625rem] sm:inline-flex" />
                    <span className="t-data text-sm text-fog-300">{km < 10 ? km.toFixed(1) : Math.round(km)} km</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand title="Planning more than one face?" body="Multi-site campaigns are quoted together. Shortlist locations on the map, or talk it through with the team." primary={{ href: "/billboards/", label: "Explore billboards" }} secondary={{ href: "/consultation/", label: "Let's talk" }} />
    </>
  );
}

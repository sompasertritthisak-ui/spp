"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { dms, guidePrice, type Site } from "@/lib/geo/sites";
import { StatusTag } from "./StatusGlyph";

/** The instrument readout for one selected location. */
export function SiteCard({ site, showPrices, onClose }: { site: Site; showPrices: boolean; onClose: () => void }) {
  const price = guidePrice(site, showPrices);
  const rows: [string, string][] = [
    ["Face", `${site.widthM} × ${site.heightM} m · ${site.widthM * site.heightM} m²`],
    ["Faces", site.faces === 2 ? "2 · double-sided" : "1 · single-sided"],
    ["Lighting", site.lit ? "Illuminated" : "Not illuminated"],
    ["Facing", site.facing],
  ];
  return (
    <article aria-labelledby={`card-${site.code}`} className="border border-gold/60 bg-ink-900/95 backdrop-blur-sm [animation:register_.3s_var(--ease-press)_both]">
      <header className="flex items-start justify-between gap-3 border-b border-gold/25 p-5 pb-4">
        <div className="min-w-0">
          <p className="t-label flex flex-wrap items-center gap-x-3 gap-y-1 text-fog-400"><span className="text-yellow">{site.code}</span><span className="t-data normal-case tracking-normal">{dms(site.lat, site.lng)}</span></p>
          <h3 id={`card-${site.code}`} className="t-heading mt-2 text-fog-50">{site.name}</h3>
          <p className="mt-1 text-sm text-fog-400">{site.district} District · {site.province}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close location details" className="-mr-2 -mt-2 flex h-11 w-11 flex-none items-center justify-center text-fog-400 hover:text-fog-50"><X aria-hidden size={18} strokeWidth={1.5} /></button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gold/25 px-5 py-3">
        <StatusTag status={site.status} />
        {site.availableFrom && site.status !== "available" && site.status !== "unavailable" && <p className="t-label text-[0.625rem] text-fog-300">Expected free from <span className="t-data text-fog-50">{formatDate(site.availableFrom)}</span></p>}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 px-5 py-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents"><dt className="t-label pt-0.5 text-[0.625rem] text-fog-500">{k}</dt><dd className="text-fog-100">{v}</dd></div>
        ))}
        <div className="contents"><dt className="t-label pt-0.5 text-[0.625rem] text-fog-500">Guide</dt><dd className="t-data text-gold">{price ?? "Price on request"}</dd></div>
      </dl>

      {!site.verified && <p className="mx-5 mb-4 border-l border-warn/60 pl-3 text-xs leading-relaxed text-fog-400">Unverified — pending SPP site confirmation. Details may change after survey.</p>}

      <footer className="flex flex-wrap gap-2 border-t border-gold/25 p-4">
        <Button href={`/billboards/${site.code}/`} variant="outline" className="flex-1">View location</Button>
        {site.status !== "unavailable" && <Button href={`/billboards/${site.code}/#request`} arrow className="flex-1">Request this location</Button>}
      </footer>
    </article>
  );
}

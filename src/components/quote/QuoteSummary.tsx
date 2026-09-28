"use client";
import type { ProductLite } from "@/components/catalogue/lite";
import { formatDate, formatLak, formatNumber } from "@/lib/format";
import { useT, type TFn } from "@/lib/i18n";
import type { Line } from "./lines";

export type Band = { low: number; high: number; priced: number; complete: boolean };

/** One-line version for the mobile bar. */
export function bandLine(band: Band, count: number, live: boolean, t: TFn) {
  if (count === 0) return t("quote.addToBegin");
  if (!live || band.priced === 0) return t("quote.pricedWritten");
  return `${formatLak(band.low)} – ${formatLak(band.high)}${band.complete ? "" : t("quote.plusQuoted")}`;
}

export function BandFigure({ band, count, live }: { band: Band; count: number; live: boolean }) {
  const t = useT();
  if (count === 0) return <p className="text-fog-400">{t("quote.addToBegin")}.</p>;
  if (!live || band.priced === 0) return <p className="text-fog-300">{t("quote.pricedWritten")}.</p>;
  return (
    <>
      <p className="t-data text-xl text-gold sm:text-2xl">{formatLak(band.low)} – {formatLak(band.high)}</p>
      {!band.complete && <p className="mt-1 text-sm text-fog-400">{t("quote.quotedIndividuallyN", { n: count - band.priced, items: count - band.priced === 1 ? t("common.item") : t("common.items") })}</p>}
    </>
  );
}

export function QuoteSummary({ lines, bySlug, band, live, neededBy }: { lines: Line[]; bySlug: Map<string, ProductLite>; band: Band; live: boolean; neededBy: string }) {
  const t = useT();
  return (
    <div>
      <p className="on-gold t-label flex items-center gap-3 px-7 py-3.5"><span aria-hidden className="reg" />{t("quote.yourRequest")}</p>
      <div className="p-7">
        {lines.length === 0 ? <p className="text-fog-400">{t("quote.nothingAdded")}</p> : (
          <ul className="border-t border-gold/40">
            {lines.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-4 border-b border-gold/20 py-3">
                <span className="min-w-0 text-fog-100">{bySlug.get(l.product)?.name ?? l.product}{l.colour && <span className="text-fog-500"> · {l.colour}</span>}</span>
                <span className="t-data flex-none text-sm text-fog-300">× {formatNumber(l.qty)}</span>
              </li>
            ))}
          </ul>
        )}
        {neededBy && <p className="mt-4 text-sm text-fog-300"><span className="t-label mr-2 text-fog-500">{t("common.neededBy")}</span>{formatDate(neededBy)}</p>}
        <div aria-live="polite" className="mt-6 border-t-2 border-gold pt-5">
          <p className="t-label mb-2 text-fog-500">{t("quote.running")}</p>
          <BandFigure band={band} count={lines.length} live={live} />
          {live && band.priced > 0 && <p className="mt-3 text-sm text-fog-500">{t("quote.estimateOnly")}</p>}
        </div>
      </div>
    </div>
  );
}

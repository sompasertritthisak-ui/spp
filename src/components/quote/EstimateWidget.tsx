"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Plate";
import { Chip, QtyStepper } from "@/components/forms/controls";
import { isIsoDate, todayIso } from "@/components/forms/validation";
import { hasPriceHint, priceLabel, type ProductLite } from "@/components/catalogue/lite";
import { METHODS } from "@/components/catalogue/methods";
import { useProductColour } from "@/components/catalogue/ProductStage";
import { formatLak, formatNumber } from "@/lib/format";
import { backendConfigured } from "@/lib/env";
import { pricingOptions, writeQuoteDraft } from "./draft";
import { defaultLocations, LocationsPicker } from "./LocationsPicker";
import { useEstimates } from "./useEstimates";

/**
 * Instant estimate. Numbers come only from the pricing engine (api.estimate);
 * with no back-end we show the public "from" hint and route to the quote form.
 * Whatever the customer sets here travels to the quote builder.
 */
export function EstimateWidget({ product: p, onlinePricing }: { product: ProductLite; onlinePricing: boolean }) {
  const router = useRouter();
  const colour = useProductColour();
  const [qty, setQty] = useState(Math.max(1, p.moq));
  const [method, setMethod] = useState(p.printMethods[0]);
  const [locations, setLocations] = useState(() => defaultLocations(p.areas));
  const [neededBy, setNeededBy] = useState("");
  const [delivery, setDelivery] = useState(false);

  const date = isIsoDate(neededBy) && neededBy >= todayIso() ? neededBy : undefined;
  const live = backendConfigured && onlinePricing && p.pricingMode !== "quote";
  const request = { product: p.slug, qty, options: pricingOptions({ method, locations, delivery }, date) };
  const { get, retry } = useEstimates([request], live);
  const entry = get(request);
  const est = entry?.status === "ready" ? entry.data : null;
  const quotedIndividually = p.pricingMode === "quote" || !onlinePricing || est?.mode === "quote";
  const sliderMax = Math.max(500, p.moq * 10);
  const belowMoq = est ? est.belowMoq : qty < p.moq;

  const toQuote = () => {
    writeQuoteDraft({ v: 1, kind: "product", source: `product:${p.slug}`, neededBy: date, items: [{ product: p.slug, qty, method, locations, delivery, colour: colour ?? undefined }] });
    router.push(`/request-quote/?product=${encodeURIComponent(p.slug)}&qty=${qty}`);
  };

  return (
    <div className="grid gap-px border border-gold/40 bg-gold/40 lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col gap-7 bg-ink-950 p-6 sm:p-9">
        <div className="flex flex-col gap-4">
          <QtyStepper label={`Quantity (${p.priceUnit.replace(/^per /, "")})`} value={qty} onChange={setQty} />
          <div>
            <label htmlFor="est-qty-range" className="sr-only">Quantity slider</label>
            <input id="est-qty-range" type="range" min={1} max={sliderMax} step={1} value={Math.min(qty, sliderMax)} onChange={(e) => setQty(Number(e.target.value))} className="h-11 w-full cursor-pointer accent-[var(--color-yellow)]" />
            <div className="t-data flex justify-between text-xs text-fog-500"><span>1</span><span>MOQ {formatNumber(p.moq)}</span><span>{formatNumber(sliderMax)}+</span></div>
          </div>
        </div>
        {p.printMethods.length > 1 && (
          <Select label="Print method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} hint={method ? METHODS[method].bestFor : undefined}>
            {p.printMethods.map((m) => <option key={m} value={m}>{METHODS[m].label}</option>)}
          </Select>
        )}
        <LocationsPicker areas={p.areas} value={locations} onChange={setLocations} />
        <Input label="Needed by" type="date" min={todayIso()} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} hint={p.leadTimeDays ? `Standard production is ${p.leadTimeDays[0]}–${p.leadTimeDays[1]} working days. Earlier dates may be treated as rush.` : "Optional."} />
        <Chip checked={delivery} onChange={setDelivery}>Include delivery</Chip>
      </div>

      <div className="flex flex-col justify-between gap-8 bg-ink-900 p-6 sm:p-9">
        <div aria-live="polite" aria-busy={entry?.status === "loading"}>
          <p className="t-label flex items-center gap-3 text-fog-400"><span aria-hidden className="reg text-yellow" />Estimate</p>

          {quotedIndividually && (
            <>
              <p className="t-title mt-5 text-fog-50">This product is quoted individually.</p>
              <p className="mt-4 text-fog-300">Size, material and finish change the price too much for a fair online figure. Send these details and SPP will reply with a written quotation.</p>
            </>
          )}

          {!quotedIndividually && !live && (
            <>
              <p className={`t-title mt-5 ${hasPriceHint(p, onlinePricing) ? "text-gold" : "text-fog-50"}`}>{hasPriceHint(p, onlinePricing) ? priceLabel(p, onlinePricing) : "Quote on request"}</p>
              <p className="mt-4 text-fog-300">Live estimates are not switched on yet. Request a quote with these details and SPP will confirm the price for {formatNumber(qty)} in writing.</p>
            </>
          )}

          {!quotedIndividually && live && entry?.status === "loading" && (
            <div className="mt-5 flex flex-col gap-3"><div className="skeleton h-10 w-4/5" /><div className="skeleton h-5 w-3/5" /><div className="skeleton h-5 w-2/5" /></div>
          )}

          {!quotedIndividually && live && entry?.status === "error" && (
            <>
              <p className="t-heading mt-5 text-fog-50">{entry.code === "rate_limited" ? "That was a lot of estimates." : "We could not calculate that just now."}</p>
              <p className="mt-3 text-fog-300">{entry.message} You can still request a quote — nothing you have set is lost.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={retry}>Try again</Button>
            </>
          )}

          {est && est.mode !== "quote" && (
            <>
              <p className="t-data mt-5 text-[clamp(1.75rem,3.4vw,2.75rem)] font-medium leading-none text-gold">{formatLak(est.totalLow)} <span className="text-fog-500">–</span> {formatLak(est.totalHigh)}</p>
              <p className="t-data mt-3 text-fog-300">{formatLak(est.unitLow)} – {formatLak(est.unitHigh)} <span className="font-sans text-fog-400">{p.priceUnit}</span></p>
              <ul className="mt-6 rule-t">
                {est.lines.map((l, i) => <li key={i} className="rule-b flex items-center gap-3 py-2.5 text-sm text-fog-300"><span aria-hidden className="h-1 w-1 flex-none bg-yellow" />{l.label}</li>)}
              </ul>
              <p className="mt-5 text-sm text-fog-400">{est.disclaimer}</p>
            </>
          )}

          {belowMoq && (
            <p className="mt-5 flex items-start gap-3 border border-warn/40 bg-warn/5 p-3 text-sm text-fog-100">
              <Badge tone="warn">Below minimum</Badge>
              <span>The usual minimum is {formatNumber(p.moq)}. Smaller runs are sometimes possible — ask and we will tell you honestly.</span>
            </p>
          )}
        </div>
        <Button size="lg" arrow onClick={toQuote}>Request a quote for {formatNumber(qty)}</Button>
      </div>
    </div>
  );
}

"use client";
import { Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { WhatsAppLink } from "@/components/forms/WhatsAppLink";
import { useAuth } from "@/lib/backend/auth";
import { formatLak } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { whatsappHref } from "@/lib/whatsapp";

export type QuoteResult = { ref: string; leadRef: string; estimateLow: number | null; estimateHigh: number | null };

// Module-level so the ref callback is stable and focus moves exactly once.
const focusOnMount = (el: HTMLElement | null) => el?.focus();

const NEXT = [
  { t: "quote.n1t", b: "quote.n1b" },
  { t: "quote.n2t", b: "quote.n2b" },
  { t: "quote.n3t", b: "quote.n3b" },
  { t: "quote.n4t", b: "quote.n4b" },
] as const;

export function QuoteSuccess({ result, whatsapp, email, portal }: { result: QuoteResult; whatsapp: string; email: string; portal: boolean }) {
  const { user, isGuest } = useAuth();
  const { lang, t } = useLang();
  const wa = whatsappHref(whatsapp, { kind: "quote", quoteRef: result.ref });
  const signedIn = Boolean(user && !isGuest);
  return (
    <div role="status" tabIndex={-1} className="mx-auto max-w-4xl focus:outline-none" ref={focusOnMount}>
      <Plate>{t("quote.received")}</Plate>
      <h2 lang={lang} className="t-display mt-6 text-fog-50">{t("quote.weHaveIt")} <span className="t-feel text-yellow">{t("quote.thankYou")}</span></h2>
      <dl className="mt-10 grid gap-px border border-gold/40 bg-gold/40 sm:grid-cols-3">
        <div className="bg-ink-900 p-6"><dt className="t-label text-fog-500">{t("quote.ref")}</dt><dd className="t-data mt-2 break-all text-xl text-gold">{result.ref}</dd></div>
        <div className="bg-ink-900 p-6"><dt className="t-label text-fog-500">{t("quote.leadRef")}</dt><dd className="t-data mt-2 break-all text-xl text-fog-50">{result.leadRef}</dd></div>
        <div className="bg-ink-900 p-6">
          <dt className="t-label text-fog-500">{t("quote.estimate")}</dt>
          <dd className="mt-2 text-fog-50">{result.estimateLow != null && result.estimateHigh != null ? <span className="t-data text-xl">{formatLak(result.estimateLow)} – {formatLak(result.estimateHigh)}</span> : t("quote.pricedWritten")}</dd>
        </div>
      </dl>
      {result.estimateLow != null && <p className="mt-3 text-sm text-fog-500">{t("quote.estimateOnly")}</p>}

      <h3 className="t-label mt-14 text-fog-400">{t("quote.whatNext")}</h3>
      <ol className="mt-5 border-t border-gold/40">
        {NEXT.map((s, i) => (
          <li key={s.t} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-gold/20 py-5 sm:grid-cols-[4rem_14rem_1fr]">
            <span className={`t-data text-2xl ${i === 0 ? "text-gold" : "text-gold/60"}`}>{String(i + 1).padStart(2, "0")}</span>
            <span className="t-heading text-fog-50">{t(s.t)}</span>
            <span className="col-start-2 text-fog-300 sm:col-start-3">{t(s.b)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        {wa && <WhatsAppLink href={wa} label={t("quote.followWa")} variant="primary" size="lg" source="quote_success" />}
        {portal && (signedIn
          ? <Button href="/account/" variant="outline" size="lg" arrow>{t("quote.track")}</Button>
          : <Button href="/login/" variant="outline" size="lg" arrow>{t("quote.createTrack")}</Button>)}
        <Button href="/products/" variant="ghost" size="lg">{t("quote.backCatalogue")}</Button>
      </div>
      <p className="mt-6 text-sm text-fog-500">{t("quote.keepRef", { ref: result.ref, email })}</p>
    </div>
  );
}

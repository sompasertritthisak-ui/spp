"use client";
import { Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { WhatsAppLink } from "@/components/forms/WhatsAppLink";
import { useAuth } from "@/lib/backend/auth";
import { formatLak } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";

export type QuoteResult = { ref: string; leadRef: string; estimateLow: number | null; estimateHigh: number | null };

// Module-level so the ref callback is stable and focus moves exactly once.
const focusOnMount = (el: HTMLElement | null) => el?.focus();

const NEXT = [
  { t: "SPP review", b: "A person checks quantities, artwork and dates — usually within one working day." },
  { t: "Written quote", b: "You receive a written quotation. That document is the confirmed price." },
  { t: "You approve", b: "Accept the quote and sign off the artwork proof. Nothing is produced before you approve." },
  { t: "Production", b: "Your order moves through tracked stages to quality control and delivery." },
];

export function QuoteSuccess({ result, whatsapp, email, portal }: { result: QuoteResult; whatsapp: string; email: string; portal: boolean }) {
  const { user, isGuest } = useAuth();
  const wa = whatsappHref(whatsapp, { kind: "quote", quoteRef: result.ref });
  const signedIn = Boolean(user && !isGuest);
  return (
    <div role="status" tabIndex={-1} className="mx-auto max-w-4xl focus:outline-none" ref={focusOnMount}>
      <Plate>Request received</Plate>
      <h2 className="t-display mt-6 text-fog-50">We have it. <span className="t-feel text-yellow">Thank you.</span></h2>
      <dl className="mt-10 grid gap-px border border-gold/40 bg-gold/40 sm:grid-cols-3">
        <div className="bg-ink-900 p-6"><dt className="t-label text-fog-500">Quote reference</dt><dd className="t-data mt-2 break-all text-xl text-gold">{result.ref}</dd></div>
        <div className="bg-ink-900 p-6"><dt className="t-label text-fog-500">Enquiry reference</dt><dd className="t-data mt-2 break-all text-xl text-fog-50">{result.leadRef}</dd></div>
        <div className="bg-ink-900 p-6">
          <dt className="t-label text-fog-500">Estimate</dt>
          <dd className="mt-2 text-fog-50">{result.estimateLow != null && result.estimateHigh != null ? <span className="t-data text-xl">{formatLak(result.estimateLow)} – {formatLak(result.estimateHigh)}</span> : "Priced in your written quotation"}</dd>
        </div>
      </dl>
      {result.estimateLow != null && <p className="mt-3 text-sm text-fog-500">Estimate only. Your written quotation from SPP is the confirmed price.</p>}

      <h3 className="t-label mt-14 text-fog-400">What happens next</h3>
      <ol className="mt-5 border-t border-gold/40">
        {NEXT.map((s, i) => (
          <li key={s.t} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-gold/20 py-5 sm:grid-cols-[4rem_14rem_1fr]">
            <span className={`t-data text-2xl ${i === 0 ? "text-gold" : "text-gold/60"}`}>{String(i + 1).padStart(2, "0")}</span>
            <span className="t-heading text-fog-50">{s.t}</span>
            <span className="col-start-2 text-fog-300 sm:col-start-3">{s.b}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        {wa && <WhatsAppLink href={wa} label="Follow up on WhatsApp" variant="primary" size="lg" source="quote_success" />}
        {portal && (signedIn
          ? <Button href="/account/" variant="outline" size="lg" arrow>Track it in your account</Button>
          : <Button href="/login/" variant="outline" size="lg" arrow>Create an account to track this</Button>)}
        <Button href="/products/" variant="ghost" size="lg">Back to the catalogue</Button>
      </div>
      <p className="mt-6 text-sm text-fog-500">Keep the reference {result.ref}. If you gave an email address, a confirmation will follow there. Questions go to {email}.</p>
    </div>
  );
}

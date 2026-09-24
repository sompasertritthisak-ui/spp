"use client";
import { clsx } from "clsx";
import { useMemo, useRef, useState, type FormEvent } from "react";
import type { AvailabilityBlock } from "@/components/map/useLiveAvailability";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormError, Honeypot, Input, Textarea } from "@/components/ui/Field";
import { track, recordIntent } from "@/lib/backend/analytics";
import { api, contactSchema } from "@/lib/backend/api";
import { useAuth } from "@/lib/backend/auth";
import { BackendError, requireBackend, toBackendError } from "@/lib/backend/client";
import { formatDate } from "@/lib/format";
import type { Artwork } from "./artwork";
import { BookingSuccess } from "./BookingSuccess";
import { PeriodFields } from "./PeriodFields";
import { checkPeriod, isoLocal } from "./period";

export type BookingSite = { code: string; name: string; status: string; availableFrom: string | null; minMonths: number };
export type Channels = { whatsapp: string; email: string };
type ArtChoice = "upload" | "design" | "later";
type Result = { ref: string; message: string; possibleClash: boolean };

const STEPS = ["Period", "Artwork", "Options", "Contact", "Review"] as const;

/** Original file → private bucket → design_assets row. RLS pins both to the caller's own uid. */
async function uploadArtwork(art: Artwork, uid: string): Promise<string> {
  const b = requireBackend();
  const path = `${uid}/${crypto.randomUUID()}.${art.ext}`;
  const up = await b.storage.from("private-artwork").upload(path, art.file, { contentType: art.mime, upsert: false });
  if (up.error) throw new BackendError("We could not upload your artwork. Check your connection and try again.", "network");
  const { data, error } = await b.from("design_assets").insert({ owner_id: uid, path, file_name: art.file.name.slice(0, 200), mime: art.mime, bytes: art.file.size, width: Math.round(art.width), height: Math.round(art.height) }).select("id").single();
  if (error || !data) { void b.storage.from("private-artwork").remove([path]); throw toBackendError(error); }
  return data.id as string;
}

export function BookingFlow({ site, channels, artwork, blocks }: { site: BookingSite; channels: Channels; artwork: Artwork | null; blocks: AvailabilityBlock[] }) {
  const { profile, ensureSession } = useAuth();
  const today = useMemo(() => isoLocal(new Date()), []);
  const top = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [choice, setChoice] = useState<ArtChoice | null>(null);
  const [install, setInstall] = useState(true);
  const [notes, setNotes] = useState("");
  // undefined = untouched, so a profile that loads late can still prefill without an effect
  const [contact, setContact] = useState<{ name?: string; company?: string; email?: string; phone?: string }>({});
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const c = { name: contact.name ?? profile?.full_name ?? "", company: contact.company ?? "", email: contact.email ?? profile?.email ?? "", phone: contact.phone ?? profile?.phone ?? "" };
  const check = checkPeriod(start, end, today, site.minMonths, site, blocks);
  const art: ArtChoice = choice ?? (artwork ? "upload" : "later");
  const parsed = contactSchema.safeParse(c);
  const fieldError = (k: string) => (tried && !parsed.success ? parsed.error.issues.find((i) => i.path[0] === k)?.message : undefined);

  const stepValid = [!check.errors.start && !check.errors.end, art !== "upload" || Boolean(artwork), true, parsed.success && consent, true][step];

  const go = (to: number) => {
    setStep(to); setTried(false); setError(null);
    recordIntent("billboard_booking", STEPS[to]!.toLowerCase(), { ref: site.code });
    requestAnimationFrame(() => top.current?.focus({ preventScroll: false }));
  };
  const next = (e: FormEvent) => {
    e.preventDefault();
    if (!started.current) { started.current = true; track("billboard_booking_started", { ref: site.code }); }
    if (!stepValid) return setTried(true);
    if (step < STEPS.length - 1) return go(step + 1);
    void submit(false);
  };

  async function submit(withoutFile: boolean) {
    if (!parsed.success) return go(3);
    setPending(true); setError(null);
    try {
      let artworkAssetId: string | undefined;
      if (art === "upload" && artwork && !withoutFile) {
        const user = await ensureSession();
        try { artworkAssetId = await uploadArtwork(artwork, user.id); }
        catch (e) { setUploadFailed(true); throw e; }
      }
      const res = await api.submitBooking({
        contact: parsed.data, billboard: site.code, startsOn: start, endsOn: end, artworkAssetId,
        needsDesign: art === "design", needsPrintInstall: install, consent, website,
        notes: [notes.trim(), art === "upload" && !artworkAssetId ? "Artwork to follow separately." : ""].filter(Boolean).join("\n") || undefined,
      });
      track("billboard_booking_requested", { ref: res.ref });
      setResult(res);
      requestAnimationFrame(() => top.current?.focus());
    } catch (e) {
      setError(e instanceof BackendError ? e.message : "Something went wrong sending your request. Please try again.");
    } finally { setPending(false); }
  }

  if (result) return <div ref={top} tabIndex={-1} className="focus:outline-none"><BookingSuccess site={site} result={result} start={start} end={end} channels={channels} artworkSent={art === "upload" && Boolean(artwork) && !uploadFailed} /></div>;

  const review: [string, string][] = [
    ["Location", `${site.code} · ${site.name}`],
    ["Period", `${formatDate(start)} – ${formatDate(end)} · ${check.days} days`],
    ["Artwork", art === "upload" ? artwork?.file.name ?? "—" : art === "design" ? "SPP to help design it" : "To follow later"],
    ["Print & install", install ? "Include in the quotation" : "Rental only"],
    ["Contact", [c.name, c.company, c.email, c.phone].filter(Boolean).join(" · ")],
    ...(notes.trim() ? ([["Notes", notes.trim()]] as [string, string][]) : []),
  ];

  return (
    <form onSubmit={next} noValidate className="relative">
      <Honeypot value={website} onChange={setWebsite} />
      <ol className="grid grid-cols-5 border border-gold/40" aria-label="Request steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={clsx("border-gold/30 [&:not(:first-child)]:border-l", i === step ? "bg-gold/10" : "")}>
            <button type="button" disabled={i >= step} onClick={() => go(i)} className={clsx("flex min-h-14 w-full flex-col items-start justify-center gap-1 px-2.5 py-2 text-left sm:px-4", i < step ? "text-fog-300 hover:text-gold" : i === step ? "text-fog-50" : "text-fog-500")}>
              <span className={clsx("t-data text-xs", i <= step && "text-gold")}>{i < step ? "✓" : String(i + 1).padStart(2, "0")}</span>
              <span className="t-label hidden text-[0.5625rem] sm:block">{s}</span>
              <span className="sr-only sm:hidden">{s}</span>
            </button>
          </li>
        ))}
      </ol>
      {/* progress rule: fills a fifth per step */}
      <div aria-hidden className="mb-8 h-0.5 bg-ink-700"><div className={clsx("h-full bg-gold transition-[width] duration-300 ease-[var(--ease-press)]", ["w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"][step])} /></div>

      <div ref={top} tabIndex={-1} className="focus:outline-none">
        <h3 className="t-heading mb-6 text-fog-50">{["When should it run?", "What goes on the face?", "What should we quote?", "Who should we reply to?", "Check and send"][step]}</h3>

        {step === 0 && <PeriodFields start={start} end={end} today={today} minMonths={site.minMonths} check={check} showErrors={tried} blocks={blocks} onChange={(p) => { if (p.start !== undefined) setStart(p.start); if (p.end !== undefined) setEnd(p.end); }} />}

        {step === 1 && (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Artwork</legend>
            {([
              ["upload", "Use the artwork from the visualiser", artwork ? `${artwork.file.name} — sent privately to SPP with this request.` : "Nothing uploaded yet. Add your file in the visualiser above, then come back."],
              ["design", "I need design help", "SPP's designers will prepare artwork for this face. Quoted with your booking."],
              ["later", "I will send artwork later", "Reserve the conversation now; supply the file once the dates are agreed."],
            ] as [ArtChoice, string, string][]).map(([k, title, body]) => (
              <label key={k} className={clsx("flex min-h-16 cursor-pointer items-start gap-4 border p-4 transition-colors duration-150", art === k ? "border-gold bg-gold/5" : "border-ink-600 hover:border-gold/50")}>
                <input type="radio" name="art" value={k} checked={art === k} onChange={() => setChoice(k)} className="mt-1 h-4 w-4 flex-none accent-gold" />
                <span><span className="block font-medium text-fog-50">{title}</span><span className="mt-1 block text-sm text-fog-400">{body}</span></span>
              </label>
            ))}
            {tried && art === "upload" && !artwork && <FormError message="Upload your artwork in the visualiser first — or choose one of the other options." />}
            {art === "upload" && !artwork && <Button href="#visualise" variant="outline" className="self-start">Upload artwork</Button>}
          </fieldset>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <Checkbox checked={install} onChange={(e) => setInstall(e.target.checked)} label={<><span className="block font-medium text-fog-50">Include printing and installation</span>SPP prints the face and installs it on site. Untick for site rental only.</>} />
            <Textarea label="Anything we should know?" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} hint="Campaign goal, other locations you are considering, flexibility on dates…" />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Your name" required autoComplete="name" value={c.name} onChange={(e) => setContact((v) => ({ ...v, name: e.target.value }))} error={fieldError("name")} />
              <Input label="Company" autoComplete="organization" value={c.company} onChange={(e) => setContact((v) => ({ ...v, company: e.target.value }))} error={fieldError("company")} />
              <Input label="Email" type="email" inputMode="email" autoComplete="email" value={c.email} onChange={(e) => setContact((v) => ({ ...v, email: e.target.value }))} error={fieldError("email")} hint="Email or phone — at least one." />
              <Input label="Phone / WhatsApp" type="tel" inputMode="tel" autoComplete="tel" value={c.phone} onChange={(e) => setContact((v) => ({ ...v, phone: e.target.value }))} error={fieldError("phone")} />
            </div>
            <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label="I agree that SPP may contact me about this request and keep these details to handle it." />
            {tried && !consent && <FormError message="Please tick the box so we are allowed to reply to you." />}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-6">
            <dl className="border-t border-gold/40">
              {review.map(([k, v]) => <div key={k} className="grid gap-1 border-b border-gold/20 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-6"><dt className="t-label pt-0.5 text-[0.625rem] text-fog-500">{k}</dt><dd className="whitespace-pre-line text-fog-100">{v}</dd></div>)}
            </dl>
            {check.clashes.length > 0 && <p className="text-sm text-warn">These dates may clash with the calendar — we will check and suggest alternatives if needed.</p>}
            <p className="border-l-2 border-gold pl-4 text-sm leading-relaxed text-fog-300">This sends a <strong className="text-fog-50">request</strong>, not a booking. Nothing is reserved until SPP confirms availability and you have agreed a quotation.</p>
          </div>
        )}
      </div>

      <div className="mt-6" aria-live="assertive"><FormError message={error} /></div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {step > 0 && <Button variant="ghost" onClick={() => go(step - 1)} disabled={pending}>Back</Button>}
        <Button type="submit" arrow loading={pending}>{step === STEPS.length - 1 ? "Request this location" : "Continue"}</Button>
        {uploadFailed && step === STEPS.length - 1 && !pending && <Button variant="outline" onClick={() => void submit(true)}>Send without the file</Button>}
      </div>
      {uploadFailed && step === STEPS.length - 1 && <p className="mt-3 text-sm text-fog-400">You can send the request now and pass the artwork to SPP afterwards.</p>}
    </form>
  );
}

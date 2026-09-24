"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormError, Honeypot, Input, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Plate";
import type { BundleLite, ProductLite } from "@/components/catalogue/lite";
import { ContactFields, rememberContact, useContactState } from "@/components/forms/ContactFields";
import { Group } from "@/components/forms/controls";
import { OfflineHandOff } from "@/components/forms/OfflineHandOff";
import { focusFirstInvalid, isIsoDate, todayIso, zodErrors, type Errors } from "@/components/forms/validation";
import type { Category } from "@/content/types";
import { recordIntent, track } from "@/lib/backend/analytics";
import { api, contactSchema } from "@/lib/backend/api";
import { backend, BackendError } from "@/lib/backend/client";
import { backendConfigured } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { clearQuoteDraft, pricingOptions, readQuoteDraft, writeQuoteDraft, type ProjectBrief, type QuoteKind } from "./draft";
import { bundleLines, composeSummary, DESIGN_REF, newLine, lineId, type Line } from "./lines";
import { ProductPicker } from "./ProductPicker";
import { QuoteLineCard } from "./QuoteLineCard";
import { QuoteSuccess, type QuoteResult } from "./QuoteSuccess";
import { bandLine, QuoteSummary } from "./QuoteSummary";
import { sumBand, useEstimates } from "./useEstimates";

type Props = {
  products: ProductLite[]; categories: Category[]; bundles: BundleLite[]; services: { slug: string; name: string; products: string[] }[];
  onlinePricing: boolean; portal: boolean; email: string; whatsapp: string;
};

/* Mirrors submit_quote / parse_contact in supabase/migrations/0004_rpc.sql. The database is still the authority. */
const schema = z.object({
  contact: contactSchema,
  items: z.array(z.object({
    qty: z.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(1_000_000, "Quantity must be 1,000,000 or fewer."),
    note: z.string().max(500, "Keep the note under 500 characters."),
    designRef: z.union([z.literal(""), z.string().regex(DESIGN_REF, "That Design ID does not look right.")]),
  })).min(1, "Add at least one product to quote.").max(30, "A single request can hold up to 30 items."),
  neededBy: z.union([z.literal(""), z.string().refine(isIsoDate, "Choose a valid date.").refine((d) => d >= todayIso(), "That date has already passed.")]),
  notes: z.string().max(4000, "Keep the notes under 4,000 characters."),
});

type Init = { lines: Line[]; kind: QuoteKind; source: string; neededBy: string; needsDesignHelp: boolean; notes: string; bundle?: string; project?: ProjectBrief; service?: string; pendingDesign?: string };

/** Everything the customer already told us: the hand-off draft first, then the query string on top. */
function initial(bySlug: Map<string, ProductLite>, bundles: BundleLite[]): Init {
  const draft = readQuoteDraft();
  const sp = new URLSearchParams(window.location.search);
  const s: Init = {
    lines: (draft?.items ?? []).filter((i) => bySlug.has(i.product)).map((i) => ({ ...i, id: lineId(), qty: Math.max(1, Math.round(i.qty)) })),
    kind: draft?.kind ?? "product", source: draft?.source ?? "", neededBy: draft?.neededBy ?? "", needsDesignHelp: draft?.needsDesignHelp ?? false,
    notes: draft?.notes ?? "", bundle: draft?.bundle, project: draft?.project, service: sp.get("service") ?? undefined,
  };
  const bundle = bundles.find((b) => b.slug === sp.get("bundle"));
  if (bundle && s.bundle !== bundle.slug) Object.assign(s, { lines: bundleLines(bundle, bySlug), kind: "bundle", bundle: bundle.slug, source: `bundle:${bundle.slug}`, project: undefined });
  const product = bySlug.get(sp.get("product") ?? "");
  const qty = Math.round(Number(sp.get("qty")));
  if (product) {
    const existing = s.lines.find((l) => l.product === product.slug);
    if (existing) { if (qty >= 1) existing.qty = Math.min(qty, 1_000_000); }
    else s.lines.push(newLine(product, qty >= 1 ? { qty: Math.min(qty, 1_000_000) } : {}));
    s.source ||= `product:${product.slug}`;
  }
  const design = (sp.get("design") ?? "").toUpperCase();
  if (DESIGN_REF.test(design) && !s.lines.some((l) => l.designRef === design)) {
    const target = s.lines.find((l) => l.product === product?.slug && !l.designRef) ?? (product ? undefined : s.lines.find((l) => !l.designRef));
    if (target) target.designRef = design; else s.pendingDesign = design;
  }
  if (s.service) s.source ||= `service:${s.service}`;
  return s;
}

export function QuoteBuilder({ products, categories, bundles, services, onlinePricing, portal, email, whatsapp }: Props) {
  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
  const [init] = useState(() => initial(bySlug, bundles));
  const [lines, setLines] = useState(init.lines);
  const [kind, setKind] = useState(init.kind);
  const [bundleSlug, setBundleSlug] = useState(init.bundle);
  const [pendingDesign, setPendingDesign] = useState(init.pendingDesign);
  const [neededBy, setNeededBy] = useState(init.neededBy);
  const [needsDesignHelp, setNeedsDesignHelp] = useState(init.needsDesignHelp);
  const [notes, setNotes] = useState(init.notes);
  const [contact, setContact, fromProfile] = useContactState();
  const [marketing, setMarketing] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const started = useRef(false);

  const service = services.find((s) => s.slug === init.service);
  const bundle = bundles.find((b) => b.slug === bundleSlug);
  // The bundle saving only stands while every bundle product is still in the request.
  const bundleIntact = Boolean(bundle && bundle.items.every((i) => lines.some((l) => l.product === i.product)));
  const bundleNote = bundle && bundleIntact ? `${bundle.name} — ${bundle.discountPct}% bundle saving, applied in your written quote.` : undefined;

  const date = isIsoDate(neededBy) && neededBy >= todayIso() ? neededBy : undefined;
  const live = backendConfigured && onlinePricing;
  const requests = lines.map((l) => ({ product: l.product, qty: l.qty, options: pricingOptions(l, date) }));
  const { get } = useEstimates(requests.filter((r) => bySlug.get(r.product)?.pricingMode !== "quote"), live);
  const entries = requests.map((r) => (bySlug.get(r.product)?.pricingMode === "quote" ? null : get(r)));
  const band = sumBand(entries);
  const suggested = (service?.products ?? []).map((s) => bySlug.get(s)).filter((p) => p !== undefined).filter((p) => !lines.some((l) => l.product === p.slug)).slice(0, 5);

  // Autosave, so a refresh or a detour to the catalogue loses nothing.
  useEffect(() => {
    if (result) return;
    writeQuoteDraft({ v: 1, kind, source: init.source, items: lines.map(({ id: _id, ...rest }) => rest), neededBy: neededBy || undefined, needsDesignHelp, notes, bundle: bundleSlug, project: init.project });
  }, [lines, kind, neededBy, needsDesignHelp, notes, bundleSlug, result, init]);

  useEffect(() => {
    if (started.current || lines.length === 0) return;
    started.current = true;
    track("quote_started", { product: lines[0]?.product, source: init.source || undefined });
    recordIntent("quote", "items", { product: lines[0]?.product });
  }, [lines, init.source]);

  // ?design= without ?product=: the design row knows which product it was drawn on (RLS: owner only).
  useEffect(() => {
    const b = backend();
    if (!pendingDesign || !b) return;
    let alive = true;
    void b.from("designs").select("ref,product_slug,colour").eq("ref", pendingDesign).maybeSingle().then(({ data }) => {
      const row = data as { product_slug?: string; colour?: string } | null;
      const p = row?.product_slug ? bySlug.get(row.product_slug) : undefined;
      if (!alive || !p) return;
      const colour = p.colours.find((c) => c.hex.toLowerCase() === row?.colour?.toLowerCase())?.name;
      setLines((ls) => (ls.some((l) => l.designRef === pendingDesign) ? ls : [...ls, newLine(p, { designRef: pendingDesign, colour })]));
      setPendingDesign(undefined);
    }, () => {});
    return () => { alive = false; };
  }, [pendingDesign, bySlug]);

  const addProduct = (p: ProductLite) => {
    setLines((ls) => (ls.length >= 30 ? ls : [...ls, newLine(p, pendingDesign && p.garment ? { designRef: pendingDesign } : {})]));
    if (pendingDesign && p.garment) setPendingDesign(undefined);
    setErrors(({ items: _items, ...rest }) => rest);
  };
  const patchLine = (id: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => {
    setLines((ls) => ls.filter((l) => l.id !== id));
    if (kind === "bundle" && lines.length === 1) { setKind("product"); setBundleSlug(undefined); }
  };

  const noteIntent = () => {
    const okEmail = z.email().safeParse(contact.email.trim()).success;
    recordIntent("quote", "contact", recovery && okEmail ? { email: contact.email.trim(), recoveryConsent: true } : {});
  };

  const extraLines = [bundleNote ? `Bundle: ${bundleNote}` : "", service ? `Service of interest: ${service.name}` : "", init.project ? `Project: ${init.project.name} (${init.project.goal})` : ""].filter(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ contact, items: lines.map((l) => ({ qty: l.qty, note: l.note ?? "", designRef: l.designRef ?? "" })), neededBy, notes });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      setFormError("A few details need attention before this can be sent.");
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    rememberContact(contact);
    if (!backendConfigured) {
      // Honest path: nothing can be submitted, so hand the composed request to the customer's own email / WhatsApp.
      setOffline(composeSummary({ lines, bySlug, neededBy, needsDesignHelp, notes, contact, extra: extraLines }));
      return;
    }
    setBusy(true);
    recordIntent("quote", "submit");
    try {
      const staffNotes = [...extraLines, notes.trim()].filter(Boolean).join("\n").slice(0, 4000);
      const res = await api.submitQuote({
        kind, contact: parsed.data.contact, website, consent: marketing, needsDesignHelp, neededBy: neededBy || undefined, notes: staffNotes,
        source: init.source || undefined, project: kind === "project" ? init.project : undefined,
        items: lines.map((l) => ({
          product: l.product, qty: l.qty, designRef: l.designRef || undefined, note: l.note?.trim() || undefined,
          config: { ...pricingOptions(l), ...(l.colour ? { colour: l.colour } : {}), ...(l.sizes && Object.values(l.sizes).some((n) => n > 0) ? { sizes: l.sizes } : {}) },
        })),
      });
      clearQuoteDraft();
      setResult(res);
      const value = res.estimateLow != null && res.estimateHigh != null ? Math.round((res.estimateLow + res.estimateHigh) / 2) : undefined;
      track("quote_requested", { ref: res.ref, value });
    } catch (err) {
      setFormError(err instanceof BackendError ? err.message : "Something went wrong sending your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Group (shared) draws an ink rule and a white plate number; both are recoloured gold from here.
  const groupCls = "!border-t-gold/40 [&>div:first-child>p>span:nth-child(2)]:text-gold";

  if (result) return <QuoteSuccess result={result} whatsapp={whatsapp} email={email} portal={portal} />;
  if (offline) {
    return (
      <div className="mx-auto max-w-3xl">
        <OfflineHandOff email={email} whatsapp={whatsapp} subject="Quote request" summary={offline} source="quote_offline" />
        <Button variant="ghost" className="mt-6" onClick={() => setOffline(null)}>Back to edit the request</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-12 pb-24 lg:grid-cols-[1fr_22rem] lg:gap-16 lg:pb-0 xl:grid-cols-[1fr_24rem]">
      <form ref={formRef} onSubmit={submit} noValidate className="relative flex min-w-0 flex-col gap-14">
        <Honeypot value={website} onChange={setWebsite} />

        <Group n="01" className={groupCls} legend="What do you need?" hint="Add as many products as you like. Set what you know — leave the rest and we will ask.">
          {(init.project || service || bundleNote) && (
            <div className="flex flex-wrap gap-2">
              {init.project && <Badge tone="yellow">Project · {init.project.name}</Badge>}
              {bundleNote && bundle && <Badge tone="yellow">{bundle.name} · {bundle.discountPct}% saving</Badge>}
              {service && <Badge>Service · {service.name}</Badge>}
            </div>
          )}
          {pendingDesign && (
            <p className="border border-gold/40 bg-gold/5 p-4 text-fog-100"><span className="t-label mr-3 text-gold">{pendingDesign}</span>Add the product this design is for and we will attach it automatically.</p>
          )}
          {lines.length > 0 && (
            <ol className="flex flex-col gap-5">
              {lines.map((l, i) => {
                const p = bySlug.get(l.product);
                return p ? <QuoteLineCard key={l.id} n={i + 1} line={l} product={p} estimate={entries[i] ?? null} qtyError={errors[`items.${i}.qty`] ?? errors[`items.${i}.note`] ?? errors[`items.${i}.designRef`]} onChange={(patch) => patchLine(l.id, patch)} onRemove={() => removeLine(l.id)} /> : null;
              })}
            </ol>
          )}
          {lines.length < 30 && <ProductPicker products={products} categories={categories} onPick={addProduct} error={errors.items} suggested={suggested} />}
        </Group>

        <Group n="02" className={groupCls} legend="Timing and artwork">
          <div className="grid gap-6 sm:grid-cols-2">
            <Input label="Needed by" type="date" min={todayIso()} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} error={errors.neededBy} hint="Optional. A tight date may be quoted as rush production." />
          </div>
          <Checkbox checked={needsDesignHelp} onChange={(e) => setNeedsDesignHelp(e.target.checked)} label="I would like SPP to help with the design or artwork." />
          <Textarea label="Anything else we should know?" maxLength={4000} rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} placeholder="Delivery location, brand colours, how it will be used…" />
        </Group>

        <Group n="03" className={groupCls} legend="Where should we send the quote?" hint={fromProfile ? "Filled in from your account — change anything that is different for this request." : undefined}>
          <ContactFields value={contact} onChange={setContact} errors={errors} onEmailBlur={noteIntent} />
        </Group>

        <Group n="04" className={groupCls} legend="Permissions">
          <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label="Send me occasional SPP news and offers. Optional — your quote does not depend on it." />
          <Checkbox checked={recovery} onChange={(e) => { setRecovery(e.target.checked); if (e.target.checked && z.email().safeParse(contact.email.trim()).success) recordIntent("quote", "contact", { email: contact.email.trim(), recoveryConsent: true }); }} label="If I do not finish, email me a link to pick this request up later. Optional." />
          <FormError message={formError} />
          <div className="flex flex-wrap items-center gap-5">
            <Button type="submit" size="lg" arrow loading={busy}>Request a quote</Button>
            <p className="max-w-sm text-sm text-fog-500">No payment, no obligation. {lines.length > 0 && `${formatNumber(lines.length)} ${lines.length === 1 ? "item" : "items"} in this request.`}</p>
          </div>
        </Group>
      </form>

      <aside aria-label="Request summary" className="hidden lg:block">
        <div className="crop sticky top-[calc(var(--nav-h)+2rem)] border border-gold/60 bg-ink-900">
          <QuoteSummary lines={lines} bySlug={bySlug} band={band} live={live} neededBy={date ?? ""} bundleNote={bundleNote} />
        </div>
      </aside>

      {/* Mobile: the summary rides along as a bottom sheet. */}
      <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        {sheet && <button type="button" aria-label="Close summary" onClick={() => setSheet(false)} className="fixed inset-0 -z-10 bg-black/60" />}
        <div className="border-t border-gold/60 bg-ink-850 pb-[env(safe-area-inset-bottom)]">
          {sheet && <div id="quote-sheet" className="thin-scroll max-h-[65dvh] overflow-y-auto [animation:register_.25s_var(--ease-press)]"><QuoteSummary lines={lines} bySlug={bySlug} band={band} live={live} neededBy={date ?? ""} bundleNote={bundleNote} /></div>}
          <button type="button" aria-expanded={sheet} aria-controls="quote-sheet" onClick={() => setSheet((v) => !v)} className="flex min-h-16 w-full items-center justify-between gap-4 px-5 text-left">
            <span className="min-w-0">
              <span className="t-label block text-fog-400">{formatNumber(lines.length)} {lines.length === 1 ? "item" : "items"}</span>
              {!sheet && <span className="t-data block truncate text-sm text-fog-50">{bandLine(band, lines.length, live)}</span>}
            </span>
            <span className="t-label flex-none text-gold">{sheet ? "Close" : "Summary"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

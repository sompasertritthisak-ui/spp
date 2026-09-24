"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Arrow, Button } from "@/components/ui/Button";
import { Badge, Plate } from "@/components/ui/Plate";
import { track } from "@/lib/backend/analytics";
import { backend } from "@/lib/backend/client";
import { formatDate } from "@/lib/format";
import { hasPriceHint, priceLabel, type ProductLite } from "./lite";
import { ProductVisual } from "./ProductVisual";

type Campaign = { slug: string; name: string; summary: string; body: string; offer: string; cta_label: string; cta_href: string; product_slugs: string[]; starts_on: string | null; ends_on: string | null };
type State = { status: "loading" } | { status: "missing" } | { status: "ready"; campaign: Campaign };
type Props = { products: ProductLite[]; onlinePricing: boolean };

export function CampaignLanding(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Landing {...props} />
    </Suspense>
  );
}

const Loading = () => (
  <div aria-busy="true" aria-label="Loading campaign" className="shell flex min-h-[70dvh] flex-col justify-end gap-5 pb-20 pt-[calc(var(--nav-h)+5rem)]">
    <div className="skeleton h-4 w-40" /><div className="skeleton h-20 w-full max-w-3xl" /><div className="skeleton h-6 w-full max-w-xl" />
  </div>
);

const today = () => new Date().toISOString().slice(0, 10);
/** Marketing types the CTA link; only same-site paths and https links are honoured. */
const safeHref = (h: string) => (/^\/(?!\/)/.test(h) || /^https:\/\//.test(h) ? h : "/request-quote/");

function Landing({ products, onlinePricing }: Props) {
  const sp = useSearchParams();
  const slug = (sp.get("c") ?? "").trim().toLowerCase();
  const qr = sp.get("qr") ?? "";
  const valid = /^[a-z0-9][a-z0-9-]{0,80}$/.test(slug);
  const [loaded, setLoaded] = useState<{ slug: string; state: State } | null>(null);
  const b = backend();
  const state: State = !valid || !b ? { status: "missing" } : loaded?.slug === slug ? loaded.state : { status: "loading" };

  useEffect(() => {
    if (qr) track("qr_landing", { source: qr.slice(0, 40), ref: slug || undefined });
  }, [qr, slug]);

  useEffect(() => {
    if (!valid || !b) return;
    let alive = true;
    void b.from("campaigns").select("slug,name,summary,body,offer,cta_label,cta_href,product_slugs,starts_on,ends_on").eq("slug", slug).eq("status", "published").maybeSingle().then(
      ({ data, error }) => { if (alive) setLoaded({ slug, state: data && !error ? { status: "ready", campaign: data as Campaign } : { status: "missing" } }); },
      () => { if (alive) setLoaded({ slug, state: { status: "missing" } }); },
    );
    return () => { alive = false; };
  }, [b, slug, valid]);

  if (state.status === "loading") return <Loading />;
  const c = state.status === "ready" ? state.campaign : null;
  const ended = Boolean(c?.ends_on && c.ends_on < today());
  if (!c || ended) return <Ended name={ended ? c?.name : undefined} />;

  const upcoming = Boolean(c.starts_on && c.starts_on > today());
  const items = c.product_slugs.map((s) => products.find((p) => p.slug === s)).filter((p) => p !== undefined);
  const paragraphs = c.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const href = safeHref(c.cta_href);
  const window_ = c.starts_on && c.ends_on ? `${formatDate(c.starts_on)} – ${formatDate(c.ends_on)}` : c.ends_on ? `Until ${formatDate(c.ends_on)}` : c.starts_on ? `From ${formatDate(c.starts_on)}` : "";

  return (
    <>
      <section className="grain glow-brand relative isolate overflow-hidden border-b border-gold/30 pt-[calc(var(--nav-h)+4rem)] lg:pt-[calc(var(--nav-h)+7rem)]">
        <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 right-0 -z-10 w-2/3 text-gold/[0.16] [mask-image:radial-gradient(ellipse_at_80%_30%,black,transparent_70%)]" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gold" />
        <div className="shell pb-16 lg:pb-24">
          <Plate className="mb-7">Campaign{window_ && ` · ${window_}`}</Plate>
          <h1 className="t-display max-w-5xl text-fog-50 [animation:ink-in_.9s_var(--ease-sheet)_both]">{c.name}</h1>
          {c.summary && <p className="t-lede mt-7 max-w-2xl">{c.summary}</p>}
          {c.offer && (
            <p className="crop mt-10 inline-flex max-w-2xl flex-col gap-2 border border-gold/60 bg-ink-900 p-5 sm:p-6">
              <span className="t-label text-gold">The offer</span>
              <span className="t-heading text-fog-50">{c.offer}</span>
              {upcoming && <span className="text-sm text-fog-400">Starts {formatDate(c.starts_on)}.</span>}
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            <Button href={href} size="lg" arrow>{c.cta_label || "Request a quote"}</Button>
            <Button href="/consultation/" size="lg" variant="outline">Let&apos;s talk</Button>
          </div>
        </div>
      </section>

      {(paragraphs.length > 0 || items.length > 0) && (
        <section className="bg-ink-950 py-20 lg:py-28">
          <div className="shell grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
            {paragraphs.length > 0 && <div className="flex max-w-2xl flex-col gap-5 text-lg leading-relaxed text-fog-100">{paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>}
            {items.length > 0 && (
              <div>
                <Plate>In this campaign</Plate>
                <ul className="mt-6 rule-t">
                  {items.map((p) => (
                    <li key={p.slug} className="rule-b">
                      <Link href={`/products/${p.slug}/`} className="group/row flex items-center gap-5 py-4 transition-colors hover:bg-gold/5">
                        <ProductVisual garment={p.garment} colour={p.colours[2]?.hex ?? p.colours[0]?.hex} category={p.category} name={p.name} className="h-16 w-16 flex-none" glyphClassName="h-full w-full p-1.5 text-fog-400" />
                        <span className="min-w-0 flex-1"><span className="t-heading block text-fog-50 group-hover/row:text-yellow">{p.name}</span><span className="block text-fog-400">{p.summary}</span><span className={`mt-1 block text-sm ${hasPriceHint(p, onlinePricing) ? "t-data text-gold" : "text-fog-500"}`}>{priceLabel(p, onlinePricing)}</span></span>
                        <Arrow className="mr-2 text-fog-500 group-hover/row:translate-x-1 group-hover/row:text-yellow" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function Ended({ name }: { name?: string }) {
  return (
    <section className="grain relative isolate border-b border-gold/30 pt-[calc(var(--nav-h)+4rem)] lg:pt-[calc(var(--nav-h)+7rem)]">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gold" />
      <div className="shell pb-20 lg:pb-28">
        <Plate className="mb-7">Campaign</Plate>
        <h1 className="t-display max-w-4xl text-fog-50">{name ? <>{name} has <span className="t-feel text-yellow">ended</span>.</> : <>This campaign has <span className="t-feel text-yellow">ended</span>.</>}</h1>
        <p className="t-lede mt-7 max-w-2xl">The offer you followed is no longer running — but everything behind it still is. Start from a goal, browse the catalogue, or tell us what you need.</p>
        <div className="mt-6"><Badge>Campaign closed</Badge></div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button href="/solutions/" size="lg" arrow>Start a project</Button>
          <Button href="/products/" size="lg" variant="outline">Explore products</Button>
          <Button href="/billboards/" size="lg" variant="ghost">Explore billboards</Button>
        </div>
      </div>
    </section>
  );
}

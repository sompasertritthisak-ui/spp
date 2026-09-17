import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { leadLabel, priceLabel, hasPriceHint, toLite } from "@/components/catalogue/lite";
import { METHODS } from "@/components/catalogue/methods";
import { ProductColourProvider, ProductStage } from "@/components/catalogue/ProductStage";
import { ProductVisual } from "@/components/catalogue/ProductVisual";
import { WhatsAppLink } from "@/components/forms/WhatsAppLink";
import { EstimateWidget } from "@/components/quote/EstimateWidget";
import { CtaBand } from "@/components/site/CtaBand";
import { Section, SectionHead } from "@/components/site/PageHero";
import { Arrow, Button } from "@/components/ui/Button";
import { Badge, Plate } from "@/components/ui/Plate";
import { Reveal } from "@/components/ui/Reveal";
import { getContent, getProduct } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";

export const dynamicParams = false;

export async function generateStaticParams() {
  const { products } = await getContent();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  const title = p.seo?.title ?? `${p.name} — Custom Made in Laos`;
  const description = p.seo?.description ?? `${p.summary} Minimum order ${formatNumber(p.moq)}. ${p.leadTimeDays ? `Ready in ${p.leadTimeDays[0]}–${p.leadTimeDays[1]} working days. ` : ""}Request a quote from SPP in Vientiane.`;
  const url = absoluteUrl(`/products/${p.slug}/`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website" } };
}

const ld = (o: unknown) => ({ __html: JSON.stringify(o).replace(/</g, "\\u003c") });

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { products, categories, bundles, settings, flags } = await getContent();
  const p = products.find((x) => x.slug === slug);
  if (!p) notFound();

  const category = categories.find((c) => c.slug === p.category);
  const lite = toLite(p);
  const bySlug = new Map(products.map((x) => [x.slug, x]));
  const related = p.related.map((s) => bySlug.get(s)).filter((x) => x !== undefined);
  const inBundles = bundles.filter((b) => b.items.some((i) => i.product === p.slug));
  const studio = Boolean(p.studio && flags.MOCKUP_STUDIO);
  const wa = whatsappHref(settings.whatsapp, { kind: "product", product: p.name, qty: p.moq });
  const url = absoluteUrl(`/products/${p.slug}/`);
  const index = `${category?.plate ?? "00"}.${String(products.filter((x) => x.category === p.category).sort((a, b) => a.order - b.order).findIndex((x) => x.slug === p.slug) + 1).padStart(2, "0")}`;

  const productLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description, url,
    category: category?.name, brand: { "@type": "Brand", name: settings.companyName }, material: p.materials.join("; ") || undefined,
    ...(p.colours.length ? { color: p.colours.map((c) => c.name).join(", ") } : {}),
    // A "from" hint only — never a fabricated offer, rating or stock level.
    ...(hasPriceHint(p, flags.ONLINE_PRICING) ? { offers: { "@type": "AggregateOffer", priceCurrency: "LAK", lowPrice: p.priceFromLak, offerCount: 1, url, seller: { "@type": "Organization", name: settings.legalName } } } : {}),
  };
  const crumbsLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Products", item: absoluteUrl("/products/") },
      ...(category ? [{ "@type": "ListItem", position: 3, name: category.name, item: absoluteUrl(`/products/?category=${category.slug}`) }] : []),
      { "@type": "ListItem", position: category ? 4 : 3, name: p.name, item: url },
    ],
  };

  const specs: { label: string; items: string[] }[] = [
    { label: "Materials", items: p.materials },
    { label: "Sizes", items: p.sizes },
    { label: "Customisation", items: p.customisation },
    { label: "Made for", items: p.useCases },
  ].filter((s) => s.items.length > 0);

  return (
    <ProductColourProvider initial={p.colours.find((c) => c.name === "Navy")?.name ?? p.colours[0]?.name ?? null} product={p.slug}>
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(productLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbsLd)} />

      <section className="grain relative isolate border-b border-ink-700 pt-[calc(var(--nav-h)+2.5rem)] lg:pt-[calc(var(--nav-h)+4rem)]">
        <div className="shell pb-16 lg:pb-24">
          <nav aria-label="Breadcrumb" className="t-label mb-10 text-fog-500">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <li><Link href="/products/" className="inline-flex min-h-11 items-center hover:text-fog-50">Products</Link></li>
              {category && <><li aria-hidden>/</li><li><Link href={`/products/?category=${category.slug}`} className="inline-flex min-h-11 items-center hover:text-fog-50">{category.name}</Link></li></>}
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-fog-300">{p.name}</li>
            </ol>
          </nav>
          <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-20">
            <div className="flex flex-col">
              <Plate n={index}>{category?.name ?? "Product"}</Plate>
              <h1 className="t-display mt-6 text-fog-50 [animation:ink-in_.9s_var(--ease-sheet)_both]">{p.name}</h1>
              <p className="t-lede mt-6 max-w-xl">{p.summary}</p>

              <dl className="mt-10 grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 sm:grid-cols-3">
                <div className="bg-ink-950 p-5"><dt className="t-label text-fog-500">Minimum order</dt><dd className="t-data mt-2 text-2xl text-fog-50">{formatNumber(p.moq)}</dd></div>
                <div className="bg-ink-950 p-5"><dt className="t-label text-fog-500">Lead time</dt><dd className="mt-2 text-lg leading-tight text-fog-50">{leadLabel(p.leadTimeDays)}</dd></div>
                <div className="col-span-2 bg-ink-950 p-5 sm:col-span-1"><dt className="t-label text-fog-500">Pricing</dt><dd className="mt-2 text-lg leading-tight text-fog-50">{priceLabel(p, flags.ONLINE_PRICING)}</dd></div>
              </dl>

              <div className="mt-10 flex flex-wrap gap-3">
                {studio && <Button href={`/design/?product=${p.slug}`} size="lg" arrow>Customise this</Button>}
                <Button href={`/request-quote/?product=${p.slug}&qty=${p.moq}`} size="lg" variant={studio ? "outline" : "primary"} arrow={!studio}>Request a quote</Button>
                <Button href="/consultation/" size="lg" variant="ghost">Let&apos;s talk</Button>
                {wa && <WhatsAppLink href={wa} size="lg" variant="ghost" source={`product:${p.slug}`} />}
              </div>
              {studio && <p className="mt-4 text-sm text-fog-500">Design it in your browser, preview every side, then send it for a quote with its Design ID attached.</p>}
            </div>
            <ProductStage product={lite} plate={index} />
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-24">
          <div>
            <Plate n="A">The product</Plate>
            <p className="mt-7 text-xl leading-relaxed text-fog-100">{p.description}</p>
          </div>
          <dl className="rule-t">
            {specs.map((s) => (
              <Reveal key={s.label} className="rule-b grid gap-3 py-6 sm:grid-cols-[10rem_1fr]">
                <dt className="t-label pt-1 text-fog-400">{s.label}</dt>
                <dd><ul className="flex flex-col gap-1.5 text-fog-100">{s.items.map((i) => <li key={i}>{i}</li>)}</ul></dd>
              </Reveal>
            ))}
            {p.colours.length > 0 && (
              <Reveal className="rule-b grid gap-3 py-6 sm:grid-cols-[10rem_1fr]">
                <dt className="t-label pt-1 text-fog-400">Colours</dt>
                <dd><ul className="flex flex-wrap gap-x-5 gap-y-2 text-fog-100">{p.colours.map((c) => <li key={c.name} className="flex items-center gap-2"><span aria-hidden className="h-3.5 w-3.5 border border-ink-500" style={{ background: c.hex }} />{c.name}</li>)}</ul></dd>
              </Reveal>
            )}
          </dl>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHead tone="paper" plate="B" eyebrow="How it is printed" title={<>Printing, in <span className="t-feel">plain</span> language.</>} lede="You do not need to know the terms. Tell us what the artwork looks like and how many you need — we will recommend the right method." />
        <ol className="border-t border-paper-line">
          {p.printMethods.map((m, i) => (
            <li key={m} className="grid gap-4 border-b border-paper-line py-8 md:grid-cols-[4rem_14rem_1fr_1fr] md:gap-8">
              <span className="t-data text-sm text-paper-mute">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="t-heading text-paper-ink">{METHODS[m].label}</h3>
              <p className="text-paper-ink">{METHODS[m].plain}</p>
              <p className="text-paper-mute"><span className="t-label mb-1 block">Best for</span>{METHODS[m].bestFor}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="estimate" tone="raised">
        <SectionHead plate="C" eyebrow="Get an estimate" title={<>How many, by <span className="t-feel text-yellow">when</span>?</>} lede="Set the quantity and options. Whatever you choose here is carried straight into your quote request — nothing to retype." />
        <EstimateWidget product={lite} onlinePricing={flags.ONLINE_PRICING} />
      </Section>

      {(inBundles.length > 0 || related.length > 0) && (
        <Section>
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            {related.length > 0 && (
              <div>
                <Plate n="D">Goes well with</Plate>
                <ul className="mt-8 rule-t">
                  {related.map((r) => (
                    <li key={r.slug} className="rule-b">
                      <Link href={`/products/${r.slug}/`} className="group/row flex items-center gap-5 py-4 transition-colors hover:bg-ink-900">
                        <ProductVisual garment={r.studio?.garment ?? null} colour={r.colours[1]?.hex ?? r.colours[0]?.hex} category={r.category} name={r.name} className="h-16 w-16 flex-none" glyphClassName="h-full w-full p-1.5 text-fog-400" />
                        <span className="min-w-0 flex-1"><span className="t-heading block text-fog-50 group-hover/row:text-yellow">{r.name}</span><span className="block text-fog-400">{r.summary}</span></span>
                        <Arrow className="mr-2 text-fog-500 group-hover/row:translate-x-1 group-hover/row:text-yellow" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inBundles.length > 0 && (
              <div>
                <Plate n="E">Bundles with this product</Plate>
                <ul className="mt-8 rule-t">
                  {inBundles.map((b) => (
                    <li key={b.slug} className="rule-b py-5">
                      <div className="flex flex-wrap items-center gap-3"><h3 className="t-heading text-fog-50">{b.name}</h3><Badge tone="yellow">{b.discountPct}% bundle saving</Badge></div>
                      <p className="mt-2 text-fog-400">{b.summary}</p>
                      <p className="mt-2 text-sm text-fog-500">{b.items.map((i) => `${formatNumber(i.qty)} × ${bySlug.get(i.product)?.name ?? i.product}`).join(" · ")}</p>
                      <Button href={`/request-quote/?bundle=${b.slug}`} variant="outline" size="sm" className="mt-4" arrow>Quote this bundle</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      <CtaBand
        title={studio ? <>See it before it is made.</> : <>Ready when you are.</>}
        body={studio ? `Open SPP Studio with the ${p.name} loaded and place your artwork.` : `Tell us the quantity and the date. We will reply with a written quotation for ${p.name}.`}
        primary={studio ? { href: `/design/?product=${p.slug}`, label: "Customise this" } : { href: `/request-quote/?product=${p.slug}&qty=${p.moq}`, label: "Request a quote" }}
        secondary={{ href: "/consultation/", label: "Let's talk" }}
      />
    </ProductColourProvider>
  );
}

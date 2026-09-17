import Link from "next/link";
import { Prose, parseBlocks } from "@/app/(site)/blog/_lib/markdown-lite";
import { EMBED_PROVIDERS, sectionSchemas, type SectionKind, type SectionProps } from "@/components/admin/cms/section-kinds";
import { ProductVisual } from "@/components/catalogue/ProductVisual";
import { CoverArt, SampleBadge } from "@/components/home/CoverArt";
import { OutdoorMap } from "@/components/map/OutdoorMap";
import { CtaBand } from "@/components/site/CtaBand";
import { Section, SectionHead } from "@/components/site/PageHero";
import { Arrow, Button } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import type { SiteContent } from "@/content/types";
import type { CmsMedia, CmsPage } from "@/lib/cms-pages";
import { formatLak } from "@/lib/format";
import { EmbedFrame } from "./EmbedFrame";

type Ctx = { content: SiteContent; media: Record<string, CmsMedia> };

function Img({ m, className, priority = false }: { m: CmsMedia | undefined; className?: string; priority?: boolean }) {
  if (!m || !m.mime.startsWith("image/")) return null;
  // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser; dimensions reserve space (CLS)
  return <img src={m.url} alt={m.alt} width={m.width ?? undefined} height={m.height ?? undefined} loading={priority ? "eager" : "lazy"} decoding="async" className={className} />;
}

const renderers: { [K in SectionKind]: (p: SectionProps[K], ctx: Ctx, first: boolean) => React.ReactNode } = {
  hero: (p, { media }, first) => {
    const H = first ? "h1" : "h2";
    const [before, after] = p.feelWord && p.title.includes(p.feelWord) ? p.title.split(p.feelWord) : [p.title, ""];
    return (
      <section className={`grain relative isolate overflow-hidden border-b border-ink-700 ${first ? "pt-[calc(var(--nav-h)+4rem)] lg:pt-[calc(var(--nav-h)+7rem)]" : "pt-20 lg:pt-32"} ${p.tone === "paper" ? "on-paper" : ""}`}>
        <div className="shell grid gap-10 pb-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:pb-20">
          <div>
            {p.eyebrow && <Plate tone={p.tone} className="mb-7">{p.eyebrow}</Plate>}
            <H className="t-display">{before}{p.feelWord && p.title.includes(p.feelWord) && <span className={`t-feel ${p.tone === "paper" ? "text-ultra" : "text-gold"}`}>{p.feelWord}</span>}{after}</H>
            {p.lede && <p className={`mt-7 max-w-2xl text-lg leading-relaxed lg:text-xl ${p.tone === "paper" ? "text-paper-mute" : "text-fog-300"}`}>{p.lede}</p>}
            {(p.ctaHref || p.secondaryHref) && <div className="mt-9 flex flex-wrap gap-3">{p.ctaHref && p.ctaLabel && <Button href={p.ctaHref} size="lg" arrow variant={p.tone === "paper" ? "paper" : "primary"}>{p.ctaLabel}</Button>}{p.secondaryHref && p.secondaryLabel && <Button href={p.secondaryHref} size="lg" variant={p.tone === "paper" ? "paper" : "outline"}>{p.secondaryLabel}</Button>}</div>}
          </div>
          {p.mediaId && <Img m={media[p.mediaId]} priority={first} className="crop h-auto w-full object-cover" />}
        </div>
      </section>
    );
  },
  text: (p) => (
    <Section tone={p.tone}>
      <div className={p.width === "narrow" ? "mx-auto max-w-[68ch]" : "max-w-5xl"}>
        {p.heading && <h2 className="t-title mb-8">{p.heading}</h2>}
        <div className={p.tone === "paper" ? "[&_*]:!text-paper-ink [&_p]:!text-paper-mute" : ""}><Prose blocks={parseBlocks(p.body)} /></div>
      </div>
    </Section>
  ),
  image: (p, { media }) => media[p.mediaId] ? (
    <figure className={p.layout === "full" ? "bg-ink-950" : "shell bg-ink-950 py-12 lg:py-20"}>
      <Img m={media[p.mediaId]} className="h-auto w-full" />
      {p.caption && <figcaption className={`t-label mt-4 text-fog-500 ${p.layout === "full" ? "shell pb-6" : ""}`}>{p.caption}</figcaption>}
    </figure>
  ) : null,
  video: (p, { media }) => { const v = media[p.mediaId]; return v && v.mime.startsWith("video/") ? (
    <figure className="shell py-12 lg:py-20">
      <video src={v.url} poster={p.posterMediaId ? media[p.posterMediaId]?.url : undefined} controls preload="none" muted={p.muted} playsInline className="aspect-video w-full border border-ink-700 bg-ink-900" aria-label={p.caption || v.alt || "Video"} />
      {p.caption && <figcaption className="t-label mt-4 text-fog-500">{p.caption}</figcaption>}
    </figure>
  ) : null; },
  gallery: (p, { media }) => (
    <Section>
      {p.heading && <h2 className="t-title mb-10 text-fog-50">{p.heading}</h2>}
      <ul className={`grid grid-cols-2 gap-px bg-ink-700 ${p.columns === 4 ? "lg:grid-cols-4" : p.columns === 3 ? "lg:grid-cols-3" : ""}`}>
        {p.mediaIds.map((id) => media[id] && <li key={id} className="bg-ink-950"><Img m={media[id]} className="aspect-square h-full w-full object-cover" /></li>)}
      </ul>
    </Section>
  ),
  product_showcase: (p, { content }) => {
    const list = (p.mode === "featured" ? content.products.filter((x) => x.featured) : p.productSlugs.map((s) => content.products.find((x) => x.slug === s)).filter((x) => x !== undefined)).slice(0, p.limit);
    if (!list.length) return null;
    return (
      <Section tone="raised">
        {(p.heading || p.lede) && <SectionHead eyebrow="Products" title={p.heading || "Products"} lede={p.lede || undefined} />}
        <ul className="grid gap-px bg-ink-700 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((x) => (
            <li key={x.slug} className="bg-ink-900">
              <Link href={`/products/${x.slug}/`} className="group flex h-full flex-col p-6 transition-colors hover:bg-ink-850">
                <ProductVisual garment={x.studio?.garment ?? null} colour="#eef1f8" category={x.category} name={x.name} className="h-44 w-full" />
                <span className="t-heading mt-5 text-fog-50">{x.name}</span>
                <span className="mt-2 text-fog-400">{x.summary}</span>
                <span className="t-label mt-auto flex items-center gap-2 pt-6 text-gold">{x.studio ? "Customise this" : "View product"}<Arrow /></span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    );
  },
  cta: (p) => <CtaBand title={p.title} body={p.body || undefined} primary={{ href: p.ctaHref, label: p.ctaLabel }} secondary={p.secondaryHref && p.secondaryLabel ? { href: p.secondaryHref, label: p.secondaryLabel } : undefined} />,
  testimonials: (p, { content }) => content.testimonials.length === 0 ? null : (
    <Section tone="paper">
      {p.heading && <h2 className="t-title mb-12 text-paper-ink">{p.heading}</h2>}
      <ul className="grid gap-12 lg:grid-cols-3">
        {content.testimonials.slice(0, p.limit).map((t) => <li key={t.quote}><blockquote className="t-feel text-2xl leading-snug text-paper-ink">“{t.quote}”</blockquote><p className="t-label mt-6 text-paper-mute">{t.name}{t.role && ` · ${t.role}`}{t.company && ` · ${t.company}`}</p></li>)}
      </ul>
    </Section>
  ),
  faq: (p, { content }) => {
    const list = content.faqs.filter((f) => !p.topics.length || (p.topics as string[]).includes(f.topic)).slice(0, p.limit);
    if (!list.length) return null;
    return (
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <h2 className="t-title text-fog-50">{p.heading || "Questions, answered."}</h2>
          <div className="border-t border-ink-700">{list.map((f) => <details key={f.q} className="group border-b border-ink-700"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-lg text-fog-50 [&::-webkit-details-marker]:hidden">{f.q}<span aria-hidden className="t-data text-2xl text-gold transition-transform duration-200 group-open:rotate-45">+</span></summary><p className="max-w-3xl pb-6 text-fog-300">{f.a}</p></details>)}</div>
        </div>
      </Section>
    );
  },
  pricing: (p, { content }) => {
    const list = p.productSlugs.map((s) => content.products.find((x) => x.slug === s)).filter((x) => x !== undefined);
    if (!list.length) return null;
    return (
      <Section tone="raised">
        <SectionHead eyebrow="Guide prices" title={p.heading || "What it costs."} lede={p.lede || "Guide prices at minimum quantity. Your written quotation from SPP is the confirmed price."} />
        <ul className="border-t border-ink-700">
          {list.map((x) => (
            <li key={x.slug} className="grid gap-3 border-b border-ink-700 py-6 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-10">
              <div><p className="t-heading text-fog-50">{x.name}</p><p className="t-label mt-2 text-fog-500">Minimum {x.moq} · {x.priceUnit}</p></div>
              <p className="t-data text-2xl text-gold">{content.flags.ONLINE_PRICING && x.pricingMode !== "quote" && x.priceFromLak ? `From ${formatLak(x.priceFromLak)}` : "Quote on request"}</p>
              <Button href={`/products/${x.slug}/`} variant="outline" size="sm" arrow>Get an estimate</Button>
            </li>
          ))}
        </ul>
      </Section>
    );
  },
  portfolio: (p, { content }) => {
    const list = (p.mode === "featured" ? content.portfolio.filter((x) => x.featured) : p.slugs.map((s) => content.portfolio.find((x) => x.slug === s)).filter((x) => x !== undefined)).slice(0, p.limit);
    if (!list.length) return null;
    return (
      <Section>
        <SectionHead eyebrow="Selected work" title={p.heading || "Selected work."} />
        <ul className="grid gap-10 lg:grid-cols-3">
          {list.map((x) => <li key={x.slug}><Link href={`/portfolio/${x.slug}/`} className="group block"><div className="relative overflow-hidden"><CoverArt project={x} className="aspect-[4/3] w-full transition-transform duration-700 ease-[var(--ease-press)] group-hover:scale-[1.03]" />{x.isSample && <SampleBadge className="absolute left-3 top-3" />}</div><p className="t-heading mt-5 text-fog-50">{x.title}</p><p className="t-label mt-2 text-fog-500">{x.sector} · {x.year}</p></Link></li>)}
        </ul>
      </Section>
    );
  },
  billboard_map: (p, { content }) => {
    const sites = p.province ? content.billboards.filter((b) => b.province.toLowerCase() === p.province.toLowerCase()) : content.billboards;
    if (!sites.length) return null;
    return (
      <section className="border-y border-ink-700 bg-ink-950">
        {(p.heading || p.lede) && <div className="shell py-14"><SectionHead eyebrow="SPP Outdoor Network" title={p.heading || "Billboards, charted."} lede={p.lede || undefined} action={<Button href="/billboards/" variant="outline" arrow>Explore billboards</Button>} /></div>}
        <OutdoorMap billboards={sites} showPrices={content.flags.ONLINE_PRICING} />
      </section>
    );
  },
  campaign: (p) => (
    <Section tone="raised">
      <div className="flex flex-wrap items-end justify-between gap-6"><div><Plate className="mb-5">Campaign</Plate><h2 className="t-title text-fog-50">See the current offer.</h2></div><Button href={`/campaigns/?c=${encodeURIComponent(p.campaignSlug)}`} size="lg" arrow>View campaign</Button></div>
    </Section>
  ),
  embed: (p) => <div className="shell py-12 lg:py-20"><EmbedFrame src={p.src} title={p.title} provider={EMBED_PROVIDERS[p.provider]} aspect={p.aspect} /></div>,
};

/** Renders a CMS page. A section whose props fail validation is skipped so one bad edit can never break the build. */
export function CmsSections({ page, content }: { page: CmsPage; content: SiteContent }) {
  let first = true;
  return (
    <>
      {page.sections.map((s) => {
        const kind = s.kind as SectionKind;
        const schema = sectionSchemas[kind];
        const parsed = schema?.safeParse(s.props);
        if (!schema || !parsed?.success) return null;
        const render = renderers[kind] as (p: unknown, ctx: Ctx, first: boolean) => React.ReactNode;
        const node = render(parsed.data, { content, media: page.media }, first && kind === "hero");
        first = false;
        return <div key={s.id}>{node}</div>;
      })}
    </>
  );
}

export const pageHasHero = (page: CmsPage) => page.sections[0]?.kind === "hero";

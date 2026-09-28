import { Fragment, type ReactNode } from "react";
import { CmsSections } from "@/components/cms/Sections";
import { Hero } from "@/components/hero/Hero";
import { AnnouncementBar } from "@/components/home/AnnouncementBar";
import { CapabilityIndex } from "@/components/home/CapabilityIndex";
import type { SectionCopy } from "@/components/home/Copy";
import { FeaturedProducts, pickProducts } from "@/components/home/FeaturedProducts";
import { FivePlates } from "@/components/home/FivePlates";
import { GoalTeaser } from "@/components/home/GoalTeaser";
import { HomeCta } from "@/components/home/HomeCta";
import { chooseFaqs, HomeFaq } from "@/components/home/HomeFaq";
import { Manifesto } from "@/components/home/Manifesto";
import { OutdoorTeaser } from "@/components/home/OutdoorTeaser";
import { pickProjects, SelectedWork } from "@/components/home/SelectedWork";
import { pageMeta } from "@/components/home/seo";
import { StudioTeaser } from "@/components/home/StudioTeaser";
import { Testimonials } from "@/components/home/Testimonials";
import { ConnectBand } from "@/components/site/ConnectBand";
import type { Bilingual, HomeSection, HomeSectionKey } from "@/content/types";
import { getCmsPages, HOME_PAGE_SLUG } from "@/lib/cms-pages";
import { getContent } from "@/lib/content";
import { plateNumbers } from "@/lib/home";

export async function generateMetadata() {
  const { settings, home } = await getContent();
  return pageMeta({ title: home.seo.title.en || settings.seo.defaultTitle, description: home.seo.description.en || settings.seo.defaultDescription, path: "/", absoluteTitle: true });
}

const written = (b: Bilingual) => Boolean(b.en || b.lo);
/** Only the overrides SPP actually wrote travel to the browser. */
function copyOf(s: HomeSection): SectionCopy | undefined {
  const c: SectionCopy = { ...(written(s.eyebrow) && { eyebrow: s.eyebrow }), ...(written(s.title) && { title: s.title }), ...(written(s.lede) && { lede: s.lede }), ...(written(s.body) && { body: s.body }) };
  return Object.keys(c).length ? c : undefined;
}

/**
 * The landing page is assembled from Command Center → CMS → Home page: the
 * hero always opens it, then the sections in the order staff chose, skipping
 * the hidden ones. With the default settings this is the page as designed.
 */
export default async function Home() {
  const [c, pages] = await Promise.all([getContent(), getCmsPages()]);
  const { home } = c;
  const blocks = pages.find((p) => p.slug === HOME_PAGE_SLUG) ?? null;

  // What would each section draw? An empty one is skipped, and does not take a plate number.
  const hasContent: Record<HomeSectionKey, (s: HomeSection) => boolean> = {
    manifesto: () => true, plates: () => true, studio: () => true, capabilities: () => c.categories.length > 0, connect: () => true, cta: () => true,
    goals: () => true,
    outdoor: () => c.billboards.length > 0,
    featured: (s) => pickProducts(c.products, s.products).length > 0,
    work: (s) => pickProjects(c.portfolio, s.projects).length > 0,
    testimonials: () => c.testimonials.length > 0,
    faq: (s) => chooseFaqs(c.faqs, s.faqIds, s.faqLimit).length > 0,
    blocks: () => Boolean(blocks?.sections.length),
  };
  const shown = home.sections.filter((s) => s.visible && hasContent[s.key](s));
  const plate = plateNumbers(home.sections, shown.map((s) => s.key));

  const draw: Record<HomeSectionKey, (s: HomeSection) => ReactNode> = {
    manifesto: (s) => <Manifesto copy={copyOf(s)} plate={plate.manifesto} />,
    plates: (s) => <FivePlates copy={copyOf(s)} plate={plate.plates} />,
    goals: (s) => <GoalTeaser solutions={c.solutions} copy={copyOf(s)} plate={plate.goals} />,
    studio: (s) => <StudioTeaser templates={c.templates} copy={copyOf(s)} plate={plate.studio} />,
    outdoor: (s) => <OutdoorTeaser billboards={c.billboards} copy={copyOf(s)} plate={plate.outdoor} />,
    capabilities: (s) => <CapabilityIndex categories={c.categories} products={c.products} only={s.categories} copy={copyOf(s)} plate={plate.capabilities} />,
    featured: (s) => <FeaturedProducts products={c.products} categories={c.categories} slugs={s.products} onlinePricing={c.flags.ONLINE_PRICING} studioOn={c.flags.MOCKUP_STUDIO} copy={copyOf(s)} plate={plate.featured} />,
    work: (s) => <SelectedWork projects={c.portfolio} only={s.projects} copy={copyOf(s)} plate={plate.work} />,
    testimonials: (s) => <Testimonials items={c.testimonials} copy={copyOf(s)} plate={plate.testimonials} />,
    faq: (s) => <HomeFaq faqs={c.faqs} ids={s.faqIds} limit={s.faqLimit} copy={copyOf(s)} plate={plate.faq} />,
    blocks: () => (blocks ? <CmsSections page={blocks} content={c} embedded /> : null),
    connect: (s) => <ConnectBand settings={c.settings} copy={copyOf(s)} plate={plate.connect} />,
    cta: (s) => <HomeCta title={s.title} body={s.body} primary={s.primary} secondary={s.secondary} />,
  };

  return (
    <>
      <AnnouncementBar announcement={home.announcement} />
      <Hero word={home.hero.word} styles={home.hero.styles} copy={{ eyebrow: home.hero.eyebrow, line1: home.hero.line1, line2: home.hero.line2, line3: home.hero.line3, accent: home.hero.accent, lede: home.hero.lede }} primaryCta={home.hero.primaryCta} secondaryCta={home.hero.secondaryCta} />
      {shown.map((s) => <Fragment key={s.key}>{draw[s.key](s)}</Fragment>)}
    </>
  );
}

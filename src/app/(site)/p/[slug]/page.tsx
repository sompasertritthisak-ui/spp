import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsSections, pageHasHero } from "@/components/cms/Sections";
import { getCmsPages } from "@/lib/cms-pages";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

// Pages built in Command Center → CMS → Pages. Static export needs at least one
// param, so with no published pages a placeholder is emitted that renders the 404.
const NONE = "__none";
export const dynamicParams = false;

export async function generateStaticParams() {
  const pages = await getCmsPages();
  return pages.length ? pages.map((p) => ({ slug: p.slug })) : [{ slug: NONE }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = (await getCmsPages()).find((p) => p.slug === slug);
  if (!page) return { robots: { index: false } };
  const title = page.seo.title || page.title;
  return { title, description: page.seo.description, alternates: { canonical: absoluteUrl(`/p/${slug}/`) }, openGraph: { title, description: page.seo.description, url: absoluteUrl(`/p/${slug}/`), images: [absoluteUrl("/og.png")] } };
}

export default async function CmsPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [pages, content] = await Promise.all([getCmsPages(), getContent()]);
  const page = pages.find((p) => p.slug === slug);
  if (!page) notFound();
  return (
    <>
      {!pageHasHero(page) && <header className="shell border-b border-ink-700 pb-12 pt-[calc(var(--nav-h)+4rem)]"><h1 className="t-display text-fog-50">{page.title}</h1></header>}
      <CmsSections page={page} content={content} />
    </>
  );
}

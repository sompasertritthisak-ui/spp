import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/home/JsonLd";
import { pageMeta } from "@/components/home/seo";
import { CtaBand } from "@/components/site/CtaBand";
import { Arrow } from "@/components/ui/Button";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { parseBlocks, Prose } from "../_lib/markdown-lite";

export const dynamicParams = false;

export async function generateStaticParams() {
  const { posts } = await getContent();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { posts } = await getContent();
  const p = posts.find((x) => x.slug === slug);
  if (!p) return {};
  return pageMeta({ title: p.title, description: p.excerpt, path: `/blog/${p.slug}/`, type: "article", publishedTime: p.date });
}

/** The closing step depends on what the guide was about. */
function nextStep(tag: string) {
  const t = tag.toLowerCase();
  if (t.includes("outdoor")) return { title: "Ready to see your artwork on a billboard?", primary: { href: "/billboards/", label: "Explore billboards" } };
  if (t.includes("artwork")) return { title: "Got a file? Let the Studio check it.", primary: { href: "/spp-studio/", label: "Open SPP Studio" } };
  return { title: "See your design on the shirt before you order.", primary: { href: "/spp-studio/", label: "Open SPP Studio" } };
}

export default async function JournalPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { posts, settings } = await getContent();
  const post = posts.find((x) => x.slug === slug);
  if (!post) notFound();
  const blocks = parseBlocks(post.body);
  const toc = blocks.filter((b) => b.type === "h2");
  const more = posts.filter((p) => p.slug !== post.slug).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const cta = nextStep(post.tag);
  const url = absoluteUrl(`/blog/${post.slug}/`);

  return (
    <article>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article",
        headline: post.title, description: post.excerpt, datePublished: post.date, dateModified: post.date, articleSection: post.tag,
        inLanguage: "en", mainEntityOfPage: url, url, image: absoluteUrl("/og.png"),
        author: { "@type": "Organization", name: settings.legalName, url: absoluteUrl("/") },
        publisher: { "@id": absoluteUrl("/#organization") },
      }} />

      <header className="grain relative isolate overflow-hidden border-b border-ink-700 pt-[calc(var(--nav-h)+3rem)] lg:pt-[calc(var(--nav-h)+5rem)]">
        <div className="shell pb-14 lg:pb-20">
          <nav aria-label="Breadcrumb" className="t-label mb-10 flex flex-wrap items-center gap-3 text-fog-400">
            <Link href="/blog/" className="inline-flex min-h-11 items-center hover:text-yellow">Journal</Link>
            <span aria-hidden>/</span>
            <span className="text-sky">{post.tag}</span>
          </nav>
          <h1 className="t-display max-w-[20ch] text-[clamp(2.25rem,5.4vw,5.25rem)] text-fog-50 [animation:ink-in_.9s_var(--ease-sheet)_both]">{post.title}</h1>
          <p className="t-label mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-fog-400">
            <span aria-hidden className="reg text-yellow" />
            <time dateTime={post.date}>{formatDate(post.date, { day: "numeric", month: "long", year: "numeric" })}</time>
            <span>{post.readMins} min read</span>
            <span>By {settings.companyName}</span>
          </p>
        </div>
      </header>

      <div className="shell grid gap-x-16 gap-y-12 py-16 lg:grid-cols-12 lg:py-24">
        <aside className="lg:col-span-3">
          {toc.length > 1 && (
            <nav aria-label="In this guide" className="lg:sticky lg:top-[calc(var(--nav-h)+2rem)]">
              <p className="t-label mb-3 text-fog-500">In this guide</p>
              <ol className="border-b border-ink-700">
                {toc.map((h, i) => h.type === "h2" && (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="flex min-h-11 items-baseline gap-3 border-t border-ink-700 py-2.5 text-base text-fog-300 transition-colors hover:text-yellow">
                      <span className="t-data text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>{h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </aside>
        <div className="lg:col-span-8 lg:col-start-5">
          <Prose blocks={blocks} />
          <div aria-hidden className="colorbar mt-16 w-24" />
        </div>
      </div>

      {more.length > 0 && (
        <section aria-labelledby="more-title" className="border-t border-gold/30 bg-ink-900">
          <div className="shell py-16 lg:py-20">
            <h2 id="more-title" className="t-label mb-6 text-fog-400">Keep reading</h2>
            <ul className="grid border-b border-ink-700 md:grid-cols-2 md:gap-x-16">
              {more.map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}/`} className="group/btn flex h-full flex-col border-t border-ink-700 py-7">
                    <span className="t-label text-fog-500">{p.tag} · {p.readMins} min</span>
                    <span className="t-heading mt-3 text-fog-50 transition-colors group-hover/btn:text-yellow">{p.title}</span>
                    <span className="t-label mt-5 inline-flex items-center gap-3 text-fog-300">Read <Arrow /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand title={cta.title} primary={cta.primary} secondary={{ href: "/request-quote/", label: "Request a quote" }} />
    </article>
  );
}

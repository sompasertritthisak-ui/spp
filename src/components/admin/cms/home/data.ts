"use client";
import { useMemo } from "react";
import type { HomeSection, HomeSectionKey, SiteSettings } from "@/content/types";
import { backend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { HOME_PAGE_SLUG } from "@/lib/cms-pages";
import type { PickOption } from "../../resource/pickers";
import { SITE_ROUTES } from "./meta";
import type { LinkOption } from "./fields";

type Named = { slug: string; name: string; status: string };
type Project = { slug: string; title: string; status: string; featured: boolean };
type Question = { id: string; q: string; topic: string; status: string };
type HomePage = { id: string; status: string; publish_at: string | null; page_sections: { id: string }[] };

export type HomeData = {
  products: Named[]; categories: Named[]; projects: Project[]; faqs: Question[];
  testimonials: number; billboards: number;
  /** the CMS page that holds the landing page's custom blocks, when it exists */
  blocks: { id: string; published: boolean; status: string; count: number } | null;
  pages: { slug: string; title: string }[];
  site: Pick<SiteSettings, "seo"> | null;
};

const live = (status: string) => status === "published";

async function load(): Promise<HomeData> {
  const b = backend()!;
  const [products, categories, projects, faqs, testimonials, billboards, pages, site] = await Promise.all([
    b.from("products").select("slug,name,status").order("name").limit(1000),
    b.from("categories").select("slug,name,status").order("sort").limit(200),
    b.from("portfolio_projects").select("slug,title,status,featured").order("sort").limit(500),
    b.from("faqs").select("id,q,topic,status").order("sort").limit(500),
    b.from("testimonials").select("id", { count: "exact", head: true }).eq("status", "published"),
    b.from("billboards").select("id", { count: "exact", head: true }).eq("publish", "published"),
    b.from("pages").select("id,slug,title,status,publish_at,page_sections(id)").order("title").limit(500),
    b.from("settings").select("value").eq("key", "site").maybeSingle(),
  ]);
  const failed = [products, categories, projects, faqs, testimonials, billboards, pages, site].find((r) => r.error);
  if (failed?.error) throw failed.error;
  const all = (pages.data ?? []) as unknown as (HomePage & { slug: string; title: string })[];
  const home = all.find((p) => p.slug === HOME_PAGE_SLUG);
  return {
    products: (products.data ?? []) as unknown as Named[],
    categories: (categories.data ?? []) as unknown as Named[],
    projects: (projects.data ?? []) as unknown as Project[],
    faqs: (faqs.data ?? []) as unknown as Question[],
    testimonials: testimonials.count ?? 0,
    billboards: billboards.count ?? 0,
    blocks: home ? { id: home.id, status: home.status, published: live(home.status) && (!home.publish_at || new Date(home.publish_at) <= new Date()), count: home.page_sections.length } : null,
    pages: all.filter((p) => p.slug !== HOME_PAGE_SLUG && live(p.status)).map((p) => ({ slug: p.slug, title: p.title })),
    site: (site.data?.value as Pick<SiteSettings, "seo"> | undefined) ?? null,
  };
}

/** Everything the pickers and the status chips need, read as the signed-in member of staff (drafts included). */
export function useHomeData() {
  const q = useQuery<HomeData>(() => load().catch((e: unknown) => { throw toBackendError(e as { message?: string; code?: string }); }), []);
  const data = q.data;
  const options = useMemo(() => {
    const draft = (status: string) => (live(status) ? undefined : `${status} — not on the site`);
    return {
      products: (data?.products ?? []).map((p): PickOption => ({ value: p.slug, label: p.name, hint: draft(p.status) })),
      categories: (data?.categories ?? []).map((c): PickOption => ({ value: c.slug, label: c.name, hint: draft(c.status) })),
      projects: (data?.projects ?? []).map((p): PickOption => ({ value: p.slug, label: p.title, hint: draft(p.status) ?? (p.featured ? "featured" : undefined) })),
      faqs: (data?.faqs ?? []).map((f): PickOption => ({ value: f.id, label: f.q, hint: draft(f.status) ?? f.topic })),
      links: [
        ...SITE_ROUTES.map((r): LinkOption => ({ ...r, group: "Site pages" })),
        ...(data?.pages ?? []).map((p): LinkOption => ({ href: `/p/${p.slug}/`, label: p.title, group: "Pages built in the CMS" })),
        ...(data?.products ?? []).filter((p) => live(p.status)).map((p): LinkOption => ({ href: `/products/${p.slug}/`, label: p.name, group: "Products" })),
      ],
    };
  }, [data]);
  return { data, options, loading: q.loading, error: q.error, reload: q.reload };
}

export type SectionState = { status: "visible" | "hidden" | "empty"; note: string | null };

/** Visible / Hidden / Empty — and, for Empty, what would make the section appear. `data` is null while it loads. */
export function sectionState(s: HomeSection, data: HomeData | null): SectionState {
  if (!s.visible) return { status: "hidden", note: "Switched off: visitors do not see this section." };
  if (!data) return { status: "visible", note: null };
  const published = <T extends { status: string }>(rows: T[]) => rows.filter((r) => live(r.status));
  const empty = (note: string): SectionState => ({ status: "empty", note });
  const checks: Partial<Record<HomeSectionKey, () => SectionState | null>> = {
    featured: () => {
      if (!s.products.length) return empty("No product chosen yet, so nothing is shown. Choose at least one product below.");
      const on = s.products.filter((slug) => published(data.products).some((p) => p.slug === slug));
      return on.length ? null : empty("None of the chosen products is published, so nothing is shown.");
    },
    blocks: () => (!data.blocks ? empty("No custom blocks yet. Open the page builder to add the first one.") : !data.blocks.count ? empty("The page builder has no blocks yet, so nothing is shown.") : !data.blocks.published ? empty("The blocks exist, but their page is not marked Published, so nothing is shown.") : null),
    testimonials: () => (data.testimonials ? null : empty("No testimonial is published, so nothing is shown.")),
    outdoor: () => (data.billboards ? null : empty("No billboard site is published, so nothing is shown.")),
    work: () => (published(data.projects).length ? null : empty("No portfolio project is published, so nothing is shown.")),
    faq: () => (published(data.faqs).length ? null : empty("No question is published, so nothing is shown.")),
    goals: () => null,
    capabilities: () => (published(data.categories).length ? null : empty("No category is published, so nothing is shown.")),
  };
  return checks[s.key]?.() ?? { status: "visible", note: null };
}

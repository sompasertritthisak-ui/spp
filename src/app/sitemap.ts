import type { MetadataRoute } from "next";
import { getContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/env";

export const dynamic = "force-static";

/** Indexable, public routes only. Query-string screens (/design/, /account/…)
 *  and illustrative sample case studies are deliberately left out. */
const STATIC: { path: string; priority: number; freq: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, freq: "weekly" },
  { path: "/products/", priority: 0.9, freq: "weekly" },
  { path: "/spp-studio/", priority: 0.9, freq: "monthly" },
  { path: "/billboards/", priority: 0.9, freq: "weekly" },
  { path: "/solutions/", priority: 0.8, freq: "monthly" },
  { path: "/services/", priority: 0.8, freq: "monthly" },
  { path: "/request-quote/", priority: 0.8, freq: "monthly" },
  { path: "/consultation/", priority: 0.6, freq: "monthly" },
  { path: "/portfolio/", priority: 0.7, freq: "monthly" },
  { path: "/blog/", priority: 0.6, freq: "weekly" },
  { path: "/about/", priority: 0.5, freq: "monthly" },
  { path: "/brand/", priority: 0.4, freq: "yearly" },
  { path: "/contact/", priority: 0.6, freq: "monthly" },
  { path: "/privacy/", priority: 0.2, freq: "yearly" },
  { path: "/terms/", priority: 0.2, freq: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const c = await getContent();
  return [
    ...STATIC.map((r) => ({ url: absoluteUrl(r.path), changeFrequency: r.freq, priority: r.priority })),
    ...c.products.map((p) => ({ url: absoluteUrl(`/products/${p.slug}/`), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...c.portfolio.filter((p) => !p.isSample).map((p) => ({ url: absoluteUrl(`/portfolio/${p.slug}/`), changeFrequency: "yearly" as const, priority: 0.5 })),
    ...c.posts.map((p) => ({ url: absoluteUrl(`/blog/${p.slug}/`), lastModified: p.date, changeFrequency: "yearly" as const, priority: 0.5 })),
  ];
}

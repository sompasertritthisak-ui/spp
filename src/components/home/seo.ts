import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/env";

/** Next replaces `openGraph` wholesale per segment, so every page restates the
 *  full object. One helper keeps title, canonical and the share image in step. */
export function pageMeta({ title, description, path, absoluteTitle = false, type = "website", publishedTime }: {
  title: string; description: string; path: string; absoluteTitle?: boolean; type?: "website" | "article"; publishedTime?: string;
}): Metadata {
  const url = absoluteUrl(path);
  const image = { url: absoluteUrl("/og.png"), width: 1200, height: 630, alt: "SPP — Design it. Visualise it. Make it real." };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: { type, siteName: "SPP", locale: "en_LA", title, description, url, images: [image], ...(type === "article" && publishedTime ? { publishedTime } : {}) },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

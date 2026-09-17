import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/env";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // Staff, customer and per-design screens hold nothing for a search engine.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/account/", "/design/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

import type { MetadataRoute } from "next";
import { getContent } from "@/lib/content";
import { asset } from "@/lib/env";

export const dynamic = "force-static";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { settings } = await getContent();
  return {
    name: settings.seo.defaultTitle,
    short_name: settings.companyName,
    description: settings.seo.defaultDescription,
    start_url: asset("/"),
    scope: asset("/"),
    display: "standalone",
    background_color: "#09090a",
    theme_color: "#09090a",
    lang: "en",
    icons: [
      { src: asset("/brand/spp-icon.svg"), sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: asset("/apple-icon.png"), sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}

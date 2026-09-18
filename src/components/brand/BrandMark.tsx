import { clsx } from "clsx";
import type { SiteSettings } from "@/content/types";
import { asset } from "@/lib/env";
import { Logo } from "./Logo";

const src = (p: string) => (/^https?:\/\//.test(p) ? p : asset(p));

/**
 * The SPP mark wherever it appears. Uses SPP's uploaded logo file when Settings
 * carries one, otherwise the roundel drawn in Logo.tsx — so the site is never
 * logo-less while the real artwork is on its way.
 */
export function BrandMark({ logo, tone = "ink", className, title = "SPP" }: { logo?: SiteSettings["logo"]; tone?: "ink" | "paper" | "mono"; className?: string; title?: string }) {
  const file = tone === "paper" ? (logo?.wordmarkOnPaper ?? logo?.wordmark) : logo?.wordmark;
  if (file)
    // eslint-disable-next-line @next/next/no-img-element -- brand file from /public or the media library; static export
    return <img src={src(file)} alt={title} className={clsx("block h-6 w-auto", className)} decoding="async" />;
  return <Logo tone={tone} className={className} title={title} />;
}

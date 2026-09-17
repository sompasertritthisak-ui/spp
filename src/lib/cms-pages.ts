import { cache } from "react";
import { backendConfigured, env } from "./env";

/**
 * CMS-built pages (Command Center → CMS → Pages), fetched at BUILD time through
 * the public REST API — the anon key + RLS return published pages only.
 * Props are validated per section by the renderer; a bad section is skipped,
 * never allowed to break the build.
 */
export type CmsMedia = { id: string; url: string; alt: string; width: number | null; height: number | null; mime: string };
export type CmsSection = { id: string; kind: string; props: unknown };
export type CmsPage = { slug: string; title: string; seo: { title?: string; description?: string }; sections: CmsSection[]; media: Record<string, CmsMedia> };

async function rest<T>(path: string): Promise<T[]> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, { headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${env.supabaseAnonKey}` }, cache: "force-cache" });
  if (!res.ok) throw new Error(`cms fetch ${path} → ${res.status}`);
  return (await res.json()) as T[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function mediaIds(props: unknown): string[] {
  if (!props || typeof props !== "object") return [];
  const p = props as Record<string, unknown>;
  return [p.mediaId, p.posterMediaId, ...(Array.isArray(p.mediaIds) ? p.mediaIds : [])].filter((v): v is string => typeof v === "string" && UUID.test(v));
}

export const getCmsPages = cache(async (): Promise<CmsPage[]> => {
  if (!backendConfigured) return [];
  try {
    type Row = { slug: string; title: string; seo: CmsPage["seo"] | null; page_sections: { id: string; kind: string; props: unknown; sort: number }[] };
    const rows = await rest<Row>("pages?select=slug,title,seo,page_sections(id,kind,props,sort)&status=eq.published");
    const ids = [...new Set(rows.flatMap((r) => r.page_sections.flatMap((s) => mediaIds(s.props))))];
    const media = ids.length ? await rest<{ id: string; path: string; alt: string; width: number | null; height: number | null; mime: string }>(`media?select=id,path,alt,width,height,mime&bucket=eq.public-media&id=in.(${ids.join(",")})`) : [];
    const lookup = Object.fromEntries(media.map((m) => [m.id, { id: m.id, url: `${env.supabaseUrl}/storage/v1/object/public/public-media/${m.path.split("/").map(encodeURIComponent).join("/")}`, alt: m.alt, width: m.width, height: m.height, mime: m.mime }]));
    return rows.map((r) => ({ slug: r.slug, title: r.title, seo: r.seo ?? {}, media: lookup, sections: [...r.page_sections].sort((a, b) => a.sort - b.sort).map(({ id, kind, props }) => ({ id, kind, props })) }));
  } catch (e) {
    console.warn(`[cms] pages unavailable at build: ${(e as Error).message}`);
    return [];
  }
});

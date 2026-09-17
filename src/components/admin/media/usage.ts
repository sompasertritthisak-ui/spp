import { backend } from "@/lib/backend/client";

export type MediaUse = { where: string; label: string; href: string | null };

/** Everywhere a media row is referenced. page_sections keeps ids inside jsonb, so that table is scanned client-side (it is small). */
export async function findMediaUsage(id: string): Promise<MediaUse[]> {
  const b = backend()!;
  const [cover, gallery, bbs, port, posts, team, camps, sections] = await Promise.all([
    b.from("products").select("id,name").eq("cover_media_id", id),
    b.from("product_media").select("products(id,name)").eq("media_id", id),
    b.from("billboard_media").select("billboards(id,code,name)").eq("media_id", id),
    b.from("portfolio_projects").select("id,title").eq("cover_media_id", id),
    b.from("blog_posts").select("id,title").eq("cover_media_id", id),
    b.from("team_members").select("id,name").eq("photo_media_id", id),
    b.from("campaigns").select("id,name").eq("hero_media_id", id),
    b.from("page_sections").select("id,kind,props,pages(id,title)").in("kind", ["hero", "image", "video", "gallery"]),
  ]);
  const failed = [cover, gallery, bbs, port, posts, team, camps, sections].find((r) => r.error);
  if (failed?.error) throw new Error("Usage could not be checked right now.");
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const out: MediaUse[] = [];
  for (const p of (cover.data ?? []) as { id: string; name: string }[]) out.push({ where: "Product cover", label: p.name, href: `/admin/products/?id=${p.id}` });
  for (const r of (gallery.data ?? []) as unknown as { products: { id: string; name: string } | { id: string; name: string }[] | null }[]) { const p = one(r.products); if (p) out.push({ where: "Product gallery", label: p.name, href: `/admin/products/?id=${p.id}` }); }
  for (const r of (bbs.data ?? []) as unknown as { billboards: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null }[]) { const x = one(r.billboards); if (x) out.push({ where: "Billboard", label: `${x.code} · ${x.name}`, href: `/admin/billboards/?id=${x.id}` }); }
  for (const p of (port.data ?? []) as { id: string; title: string }[]) out.push({ where: "Portfolio cover", label: p.title, href: `/admin/cms/?tab=portfolio&id=${p.id}` });
  for (const p of (posts.data ?? []) as { id: string; title: string }[]) out.push({ where: "Journal cover", label: p.title, href: `/admin/cms/?tab=journal&id=${p.id}` });
  for (const p of (team.data ?? []) as { id: string; name: string }[]) out.push({ where: "Team photo", label: p.name, href: `/admin/cms/?tab=team&id=${p.id}` });
  for (const p of (camps.data ?? []) as { id: string; name: string }[]) out.push({ where: "Campaign hero", label: p.name, href: `/admin/campaigns/?id=${p.id}` });
  for (const s of (sections.data ?? []) as unknown as { kind: string; props: Record<string, unknown> | null; pages: { id: string; title: string } | { id: string; title: string }[] | null }[]) {
    const pr = s.props ?? {};
    const hit = pr.mediaId === id || pr.posterMediaId === id || (Array.isArray(pr.mediaIds) && pr.mediaIds.includes(id));
    const page = one(s.pages);
    if (hit && page) out.push({ where: `Page · ${s.kind} section`, label: page.title, href: `/admin/cms/?tab=pages&id=${page.id}` });
  }
  return out;
}

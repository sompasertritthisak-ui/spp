import { cache } from "react";
import { seed } from "@/content/seed";
import type { Billboard, BlogPost, MediaRef, Bundle, Category, DesignTemplate, Faq, FeatureFlags, PortfolioProject, Product, Service, SiteContent, SiteSettings, Solution, Testimonial } from "@/content/types";
import { backendConfigured, env } from "./env";

/**
 * Build-time content. With Supabase configured, published rows are fetched
 * through the public REST API (anon key → RLS → published only) and baked into
 * the static HTML. Without it — first run, or CI with no secrets — the seed
 * builds the site. Either way, pages never fetch content in the browser.
 */
type Row = Record<string, unknown>;

async function rest<T = Row>(path: string): Promise<T[]> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${env.supabaseAnonKey}` },
    cache: "force-cache",
  });
  if (!res.ok) throw new Error(`content fetch ${path} → ${res.status}`);
  return (await res.json()) as T[];
}

const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "number" ? v : v == null ? null : Number(v));

async function fromDatabase(): Promise<SiteContent> {
  const [settingsRows, flagRows, cats, prods, rels, svcs, sols, bnds, bitems, bbs, port, faqRows, tms, blog, tpls, mediaRows, productMedia] = await Promise.all([
    rest("settings?key=eq.site&select=value"),
    rest("feature_flags?select=key,enabled"),
    rest("categories?select=*&order=sort"),
    rest("products?select=*,categories(slug)&order=sort"),
    rest("product_relations?select=sort,product:products!product_relations_product_id_fkey(slug),related:products!product_relations_related_id_fkey(slug)&order=sort"),
    rest("services?select=*&order=sort"),
    rest("solutions?select=*&order=sort"),
    rest("bundles?select=*"),
    rest("bundle_items?select=qty,note,sort,bundles(slug),products(slug)&order=sort"),
    rest("billboards?select=*&order=code"),
    rest("portfolio_projects?select=*&order=sort"),
    rest("faqs?select=*&order=sort"),
    rest("testimonials?select=*&order=sort"),
    rest("blog_posts?select=*&order=published_at.desc"),
    rest("design_templates?select=*&order=sort"),
    rest("media?select=id,path,alt,width,height,mime&bucket=eq.public-media"),
    rest("product_media?select=product_id,media_id,sort&order=sort"),
  ]);

  // Public-bucket images are addressed by id in content rows; resolve once here.
  const mediaById = new Map<string, MediaRef>();
  for (const m of mediaRows) if (s(m.mime).startsWith("image/")) mediaById.set(s(m.id), { url: `${env.supabaseUrl}/storage/v1/object/public/public-media/${s(m.path).split("/").map(encodeURIComponent).join("/")}`, alt: s(m.alt), width: n(m.width), height: n(m.height) });
  const media = (id: unknown) => (typeof id === "string" ? mediaById.get(id) ?? null : null);

  const settings = (settingsRows[0]?.value as SiteSettings | undefined) ?? seed.settings;
  const flags = { ...seed.flags, ...Object.fromEntries(flagRows.map((f) => [s(f.key), Boolean(f.enabled)])) } as FeatureFlags;

  const categories: Category[] = cats.map((c) => ({ slug: s(c.slug), name: s(c.name), blurb: s(c.blurb), plate: s(c.plate), order: n(c.sort) ?? 0 }));
  const products: Product[] = prods.map((p) => {
    const d = (p.data ?? {}) as Partial<Product> & { seo?: Product["seo"] };
    const lead: [number, number] | null = p.lead_min_days != null && p.lead_max_days != null ? [Number(p.lead_min_days), Number(p.lead_max_days)] : null;
    return {
      slug: s(p.slug), name: s(p.name), category: s((p.categories as Row | null)?.slug), summary: s(p.summary), description: s(p.description),
      materials: d.materials ?? [], sizes: d.sizes ?? [], colours: d.colours ?? [], printMethods: d.printMethods ?? [], customisation: d.customisation ?? [], useCases: d.useCases ?? [],
      moq: n(p.moq) ?? 1, leadTimeDays: lead, pricingMode: s(p.pricing_mode) as Product["pricingMode"], priceFromLak: n(p.price_from_lak), priceUnit: s(p.price_unit),
      studio: d.studio ?? null, featured: Boolean(p.featured), order: n(p.sort) ?? 0, seo: d.seo,
      related: rels.filter((r) => s((r.product as Row | null)?.slug) === s(p.slug)).map((r) => s((r.related as Row | null)?.slug)).filter(Boolean),
      cover: media(p.cover_media_id),
      gallery: productMedia.filter((pm) => pm.product_id === p.id).map((pm) => media(pm.media_id)).filter((m): m is MediaRef => m !== null),
    };
  });
  const services: Service[] = svcs.map((v) => ({ slug: s(v.slug), name: s(v.name), verb: s(v.verb) as Service["verb"], summary: s(v.summary), body: s(v.body), deliverables: (v.deliverables as string[]) ?? [], products: (v.product_slugs as string[]) ?? [], order: n(v.sort) ?? 0 }));
  const solutions: Solution[] = sols.map((v) => ({ slug: s(v.slug), goal: s(v.goal), prompt: s(v.prompt), summary: s(v.summary), recommend: (v.recommend as Solution["recommend"]) ?? [], bundle: s(v.bundle_slug) || undefined, order: n(v.sort) ?? 0 }));
  const bundles: Bundle[] = bnds.map((b) => ({
    slug: s(b.slug), name: s(b.name), summary: s(b.summary), discountPct: n(b.discount_pct) ?? 0, featured: Boolean(b.featured),
    items: bitems.filter((i) => s((i.bundles as Row | null)?.slug) === s(b.slug)).map((i) => ({ product: s((i.products as Row | null)?.slug), qty: n(i.qty) ?? 1, note: s(i.note) || undefined })),
  }));
  const billboards: Billboard[] = bbs.map((b) => ({
    code: s(b.code), name: s(b.name), province: s(b.province), district: s(b.district), address: s(b.address), lat: Number(b.lat), lng: Number(b.lng),
    widthM: Number(b.width_m), heightM: Number(b.height_m), orientation: s(b.orientation) as Billboard["orientation"], faces: (n(b.faces) ?? 1) as 1 | 2, facing: s(b.facing), lit: Boolean(b.lit),
    visibility: s(b.visibility), traffic: (b.traffic as string | null) ?? null, status: s(b.status) as Billboard["status"], availableFrom: (b.available_from as string | null) ?? null,
    pricingMode: s(b.pricing_mode) as Billboard["pricingMode"], priceFromUsdMonth: n(b.price_from_usd_month), minMonths: n(b.min_months) ?? 1, installation: s(b.installation), description: s(b.description), verified: Boolean(b.verified),
  }));
  const portfolio: PortfolioProject[] = port.map((p) => ({
    slug: s(p.slug), title: s(p.title), client: s(p.client), sector: s(p.sector), year: n(p.year) ?? 0, services: (p.services as string[]) ?? [], summary: s(p.summary), isSample: Boolean(p.is_sample), featured: Boolean(p.featured),
    palette: ((p.palette as string[]) ?? ["#f5b81f", "#0b0e2c", "#f5f7fd"]).slice(0, 3) as [string, string, string], cover: media(p.cover_media_id), study: (p.study as PortfolioProject["study"]) ?? [], impact: (p.impact as PortfolioProject["impact"]) ?? [],
  }));
  const faqs: Faq[] = faqRows.map((f) => ({ q: s(f.q), a: s(f.a), topic: s(f.topic) as Faq["topic"] }));
  const testimonials: Testimonial[] = tms.map((t) => ({ quote: s(t.quote), name: s(t.name), role: s(t.role), company: s(t.company) }));
  const posts: BlogPost[] = blog.map((p) => ({ slug: s(p.slug), title: s(p.title), excerpt: s(p.excerpt), body: s(p.body), tag: s(p.tag), readMins: n(p.read_mins) ?? 3, date: s(p.published_at).slice(0, 10), cover: media(p.cover_media_id) }));
  const templates: DesignTemplate[] = tpls.map((t) => ({ slug: s(t.slug), name: s(t.name), category: s(t.category) as DesignTemplate["category"], garments: (t.garments as DesignTemplate["garments"]) ?? [], suggestedColour: s(t.suggested_colour), featured: Boolean(t.featured), sides: (t.sides as DesignTemplate["sides"]) ?? {} }));

  return { settings, flags, categories, products, services, solutions, bundles, billboards, portfolio, faqs, testimonials, posts, templates };
}

export const getContent = cache(async (): Promise<SiteContent> => {
  if (!backendConfigured) return seed;
  try {
    const db = await fromDatabase();
    // An empty catalogue means the database has not been seeded yet.
    return db.products.length ? db : seed;
  } catch (e) {
    // On a real deploy a silent fallback would publish stale seed content over live CMS content.
    // Fail the build instead: the previous deployment stays online until the cause is fixed.
    if (process.env.CI) throw new Error(`[content] could not read published content from the database: ${(e as Error).message}`);
    console.warn(`[content] database unavailable, building from seed: ${(e as Error).message}`);
    return seed;
  }
});

export async function getProduct(slug: string) {
  const c = await getContent();
  return c.products.find((p) => p.slug === slug) ?? null;
}

/**
 * Public content model. These shapes mirror the published-content views in
 * Postgres (supabase/migrations) one-to-one, so the same objects flow from
 * seed → database → static build without translation.
 */

export type Slug = string;

export type PricingMode = "fixed" | "estimated" | "quote";

export type SiteSettings = {
  companyName: string;
  legalName: string;
  tagline: string;
  description: string;
  foundedYear: number;
  address: { line1: string; city: string; country: string; lat: number; lng: number };
  /** E.164 without spaces, e.g. +85620XXXXXXXX. Empty string = not configured → UI hides the channel. */
  phone: string;
  whatsapp: string;
  email: string;
  hours: { days: string; time: string }[];
  social: { platform: "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube" | "line"; url: string; handle: string }[];
  seo: { titleTemplate: string; defaultTitle: string; defaultDescription: string; keywords: string[] };
};

export type FeatureFlagKey =
  | "AI_DESIGN"
  | "MOCKUP_STUDIO"
  | "BILLBOARD_BOOKING"
  | "ONLINE_PRICING"
  | "PREORDERS"
  | "CUSTOMER_PORTAL"
  | "PAYMENTS"
  | "PRODUCTION_WORKFLOW";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export type Category = {
  slug: Slug;
  name: string;
  blurb: string;
  plate: string; // two-digit index shown as the plate number
  order: number;
};

export type PrintMethod = "screen" | "dtf" | "sublimation" | "embroidery" | "uv" | "offset" | "large-format" | "vinyl-cut";

export type ProductColour = { name: string; hex: string };

export type PrintArea = {
  key: "front" | "back" | "left-sleeve" | "right-sleeve" | "panel";
  label: string;
  /** physical printable size in millimetres — drives DPI preflight */
  widthMm: number;
  heightMm: number;
};

export type Product = {
  slug: Slug;
  name: string;
  category: Slug;
  summary: string;
  description: string;
  materials: string[];
  sizes: string[];
  colours: ProductColour[];
  printMethods: PrintMethod[];
  customisation: string[];
  useCases: string[];
  moq: number;
  leadTimeDays: [number, number] | null;
  pricingMode: PricingMode;
  /** public "from" hint in LAK; the real rules live server-side in pricing_rules */
  priceFromLak: number | null;
  priceUnit: string;
  /** which Studio garment this product opens, if any */
  studio: { garment: GarmentKey; areas: PrintArea[] } | null;
  related: Slug[];
  featured: boolean;
  order: number;
  seo?: { title?: string; description?: string };
};

export type GarmentKey = "tee" | "polo" | "sleeveless" | "cap" | "tote";

export type Service = {
  slug: Slug;
  name: string;
  verb: "Design" | "Produce" | "Promote" | "Visualise";
  summary: string;
  body: string;
  deliverables: string[];
  products: Slug[];
  order: number;
};

export type Solution = {
  slug: Slug;
  goal: string;
  prompt: string;
  summary: string;
  recommend: { group: "Apparel" | "Print" | "Promotional" | "Display" | "Outdoor" | "Digital"; items: { label: string; product?: Slug; note?: string }[] }[];
  bundle?: Slug;
  order: number;
};

export type Bundle = {
  slug: Slug;
  name: string;
  summary: string;
  discountPct: number;
  items: { product: Slug; qty: number; note?: string }[];
  featured: boolean;
};

export type BillboardStatus = "available" | "reserved" | "unavailable" | "maintenance";

export type Billboard = {
  code: string; // SPP-BB-001
  name: string;
  province: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  widthM: number;
  heightM: number;
  orientation: "landscape" | "portrait";
  faces: 1 | 2;
  facing: string;
  lit: boolean;
  visibility: string;
  traffic: string | null;
  status: BillboardStatus;
  availableFrom: string | null; // ISO date
  pricingMode: PricingMode;
  priceFromUsdMonth: number | null;
  minMonths: number;
  installation: string;
  description: string;
  /** pending on-site confirmation by SPP */
  verified: boolean;
};

export type PortfolioProject = {
  slug: Slug;
  title: string;
  client: string;
  sector: string;
  year: number;
  services: string[];
  summary: string;
  isSample: boolean;
  featured: boolean;
  palette: [string, string, string];
  study: { heading: CaseHeading; body: string }[];
  impact: { value: string; label: string }[];
};

export type CaseHeading =
  | "The Client"
  | "The Challenge"
  | "The Idea"
  | "The Approach"
  | "The Design"
  | "The Production"
  | "The Result"
  | "The Impact";

export type Faq = { q: string; a: string; topic: "ordering" | "artwork" | "billboards" | "studio" | "delivery" };

export type Testimonial = { quote: string; name: string; role: string; company: string };

export type BlogPost = {
  slug: Slug;
  title: string;
  excerpt: string;
  date: string;
  readMins: number;
  tag: string;
  body: string; // markdown-lite: paragraphs, ## headings, - lists
};

export type DesignTemplate = {
  slug: Slug;
  name: string;
  category:
    | "Corporate"
    | "Restaurant"
    | "Sports"
    | "School"
    | "Event"
    | "Promotional"
    | "Streetwear"
    | "Festival"
    | "Campaign"
    | "Minimal"
    | "Premium";
  garments: GarmentKey[];
  suggestedColour: string;
  featured: boolean;
  /** serialised studio layers per side — see src/lib/studio/schema.ts */
  sides: Record<string, unknown[]>;
};

export type SiteContent = {
  settings: SiteSettings;
  flags: FeatureFlags;
  categories: Category[];
  products: Product[];
  services: Service[];
  solutions: Solution[];
  bundles: Bundle[];
  billboards: Billboard[];
  portfolio: PortfolioProject[];
  faqs: Faq[];
  testimonials: Testimonial[];
  posts: BlogPost[];
  templates: DesignTemplate[];
};

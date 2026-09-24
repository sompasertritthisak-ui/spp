import { z } from "zod";

/**
 * The SPP Studio design document. This is what is stored in designs.sides,
 * design_templates.sides and design_versions.sides, what the AI assistant may
 * suggest, and what every renderer (editor, thumbnail, export) consumes.
 *
 * Coordinate space: per print area, width = 1000 units, height = 1000 × aspect.
 * x / y are the layer CENTRE. Sizes are in the same units. Angles in degrees.
 */
export const AREA_W = 1000;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a 6-digit hex value");
const base = {
  id: z.string().min(1).max(40),
  x: z.number().finite().min(-2000).max(3000),
  y: z.number().finite().min(-2000).max(4000),
  angle: z.number().finite().min(-360).max(360).default(0),
  opacity: z.number().min(0.05).max(1).default(1),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
};

export const FONT_KEYS = ["display", "serif", "sans", "mono", "impact", "condensed", "sport", "editorial", "script", "marker", "retro", "rounded", "comic", "stencil", "geometric", "hand", "lao"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

/** Everything the UI and renderers need to know about a face. Files are self-hosted via next/font (src/app/layout.tsx). */
export type FontMeta = { label: string; var: string; weights: [number, number]; italic: boolean; generic: "sans-serif" | "serif" | "monospace" | "cursive"; sample: string; group: "Headline" | "Script & hand" | "Display" | "Text" | "Lao" };
export const FONT_META: Record<FontKey, FontMeta> = {
  display: { label: "Grotesque", var: "--font-bricolage", weights: [300, 800], italic: false, generic: "sans-serif", sample: "HEADLINE", group: "Headline" },
  impact: { label: "Impact Block", var: "--font-anton", weights: [400, 400], italic: false, generic: "sans-serif", sample: "CHAMPIONS", group: "Headline" },
  condensed: { label: "Tall Condensed", var: "--font-bebas", weights: [400, 400], italic: false, generic: "sans-serif", sample: "VIENTIANE 2026", group: "Headline" },
  sport: { label: "Sport Block", var: "--font-oswald", weights: [300, 700], italic: false, generic: "sans-serif", sample: "TEAM 10", group: "Headline" },
  stencil: { label: "Stencil", var: "--font-blackops", weights: [400, 400], italic: false, generic: "sans-serif", sample: "CREW 07", group: "Headline" },
  comic: { label: "Comic", var: "--font-bangers", weights: [400, 400], italic: false, generic: "sans-serif", sample: "BOOM!", group: "Display" },
  rounded: { label: "Retro Rounded", var: "--font-righteous", weights: [400, 400], italic: false, generic: "sans-serif", sample: "Good Vibes", group: "Display" },
  editorial: { label: "Editorial Serif", var: "--font-playfair", weights: [400, 900], italic: true, generic: "serif", sample: "Est. 2014", group: "Display" },
  serif: { label: "Serif Italic", var: "--font-instrument", weights: [400, 400], italic: true, generic: "serif", sample: "Signature", group: "Script & hand" },
  script: { label: "Brush Script", var: "--font-pacifico", weights: [400, 400], italic: false, generic: "cursive", sample: "Sabaidee", group: "Script & hand" },
  retro: { label: "Retro Script", var: "--font-lobster", weights: [400, 400], italic: false, generic: "cursive", sample: "Riverside", group: "Script & hand" },
  marker: { label: "Marker", var: "--font-marker", weights: [400, 400], italic: false, generic: "cursive", sample: "hand made", group: "Script & hand" },
  hand: { label: "Handwritten", var: "--font-caveat", weights: [400, 700], italic: false, generic: "cursive", sample: "with love", group: "Script & hand" },
  sans: { label: "Clean Sans", var: "--font-geist", weights: [300, 800], italic: false, generic: "sans-serif", sample: "brand name", group: "Text" },
  geometric: { label: "Geometric Sans", var: "--font-montserrat", weights: [300, 900], italic: false, generic: "sans-serif", sample: "modern", group: "Text" },
  mono: { label: "Technical Mono", var: "--font-jetbrains", weights: [400, 500], italic: false, generic: "monospace", sample: "EST. 2026 · VIENTIANE", group: "Text" },
  lao: { label: "Lao Sans", var: "--font-notolao", weights: [300, 800], italic: false, generic: "sans-serif", sample: "ສະບາຍດີ", group: "Lao" },
};
export const FONT_LABEL: Record<FontKey, string> = Object.fromEntries(FONT_KEYS.map((k) => [k, FONT_META[k].label])) as Record<FontKey, string>;
export const FONT_VAR: Record<FontKey, string> = Object.fromEntries(FONT_KEYS.map((k) => [k, FONT_META[k].var])) as Record<FontKey, string>;
/** Clamp a weight into what the face actually ships, so a layer never asks for a synthetic bold. */
export const clampWeight = (font: FontKey, w: number) => Math.min(FONT_META[font].weights[1], Math.max(FONT_META[font].weights[0], Math.round(w / 100) * 100));

export const SHAPE_KEYS = ["rect", "circle", "ring", "triangle", "star", "burst", "shield", "badge", "line"] as const;
export type ShapeKey = (typeof SHAPE_KEYS)[number];

export const textLayer = z.object({
  ...base,
  type: z.literal("text"),
  text: z.string().min(1).max(200),
  font: z.enum(FONT_KEYS).default("display"),
  weight: z.number().int().min(100).max(900).default(700),
  size: z.number().min(8).max(1200),
  fill: hex,
  italic: z.boolean().optional(),
  tracking: z.number().min(-100).max(600).default(0), // thousandths of an em
  align: z.enum(["left", "center", "right"]).default("center"),
});

export const shapeLayer = z.object({
  ...base,
  type: z.literal("shape"),
  shape: z.enum(SHAPE_KEYS),
  w: z.number().min(2).max(3000),
  h: z.number().min(2).max(4000),
  fill: hex,
});

export const graphicLayer = z.object({
  ...base,
  type: z.literal("graphic"),
  graphic: z.string().min(1).max(40), // key into the Studio element library
  w: z.number().min(2).max(3000),
  h: z.number().min(2).max(4000),
  fill: hex,
});

export const imageLayer = z.object({
  ...base,
  type: z.literal("image"),
  /** design_assets.id once uploaded. Private: resolved to a short-lived signed URL at render time. */
  assetId: z.uuid().optional(),
  /** key into the in-browser artwork registry (bitmap + original file) while editing */
  artKey: z.string().max(40).optional(),
  name: z.string().max(200).default("artwork"),
  mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  w: z.number().min(2).max(3000),
  h: z.number().min(2).max(4000),
  naturalW: z.number().int().min(1).max(30000),
  naturalH: z.number().int().min(1).max(30000),
  vector: z.boolean().optional(),
});

export const layerSchema = z.discriminatedUnion("type", [textLayer, shapeLayer, graphicLayer, imageLayer]);
export type Layer = z.infer<typeof layerSchema>;
export type TextLayer = z.infer<typeof textLayer>;
export type ShapeLayer = z.infer<typeof shapeLayer>;
export type GraphicLayer = z.infer<typeof graphicLayer>;
export type ImageLayer = z.infer<typeof imageLayer>;

export const sidesSchema = z.record(z.string().max(20), z.array(layerSchema).max(60));
export type Sides = Record<string, Layer[]>;

export const designDocSchema = z.object({
  productSlug: z.string().min(1).max(120),
  garment: z.enum(["tee", "polo", "sleeveless", "cap", "tote"]),
  colour: hex,
  size: z.string().max(20).optional(),
  sides: sidesSchema,
});
export type DesignDoc = z.infer<typeof designDocSchema>;

let counter = 0;
export const newLayerId = () => `l${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Accepts loosely-shaped layers (seed templates, AI suggestions) and returns only valid ones, each with an id. */
export function normaliseLayers(raw: unknown): Layer[] {
  if (!Array.isArray(raw)) return [];
  const out: Layer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const parsed = layerSchema.safeParse({ id: newLayerId(), ...(item as Record<string, unknown>) });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function normaliseSides(raw: unknown): Sides {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, normaliseLayers(v)]));
}

export const sideHasArt = (sides: Sides, key: string) => (sides[key] ?? []).some((l) => !l.hidden);
export const usedSides = (sides: Sides) => Object.keys(sides).filter((k) => sideHasArt(sides, k));

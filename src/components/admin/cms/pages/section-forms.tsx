"use client";
import { useState } from "react";
import { titleCase } from "@/lib/format";
import { MediaListField } from "../../media/MediaField";
import { SelectField, TextField } from "../../resource/fields";
import { CheckGroupField } from "../../resource/rows";
import type { FieldDef, FieldGroup } from "../../resource/types";
import { MarkdownLiteField } from "../editors";
import { EMBED_PROVIDERS, FAQ_TOPIC_KEYS, parseEmbed, type SectionKind } from "../section-kinds";

const TONE: FieldDef = { name: "tone", label: "Background", type: "select", options: [{ value: "ink", label: "Ink (dark)" }, { value: "paper", label: "Paper (light)" }] };
const HEADING: FieldDef = { name: "heading", label: "Heading", type: "text", max: 160, wide: true, hint: "Optional." };
const LEDE: FieldDef = { name: "lede", label: "Supporting line", type: "textarea", rows: 2, max: 400 };
const LINK_HINT = "A site path such as /request-quote/ or a full https:// address.";
const buttons = (required: boolean): FieldDef[] => [
  { name: "ctaLabel", label: "Button label", type: "text", max: 40, required },
  { name: "ctaHref", label: "Button link", type: "text", max: 300, required, hint: LINK_HINT },
  { name: "secondaryLabel", label: "Second button label", type: "text", max: 40 },
  { name: "secondaryHref", label: "Second button link", type: "text", max: 300 },
];
const limit = (max: number): FieldDef => ({ name: "limit", label: "How many", type: "number", integer: true, min: 1, max, required: true });

/** Paste a link or an <iframe> snippet; only the allow-listed, normalised src is kept. */
function EmbedSrcField({ value, onChange, error, disabled }: { value: string; onChange: (v: string) => void; error: string | null; disabled: boolean }) {
  const [draft, setDraft] = useState(value);
  const parsed = parseEmbed(draft);
  const bad = draft.trim() !== "" && !parsed;
  return (
    <div className="grid gap-2">
      <TextField label="Link to embed" required disabled={disabled} value={draft} onChange={(v) => { setDraft(v); onChange(parseEmbed(v)?.src ?? ""); }} placeholder="https://www.youtube.com/watch?v=…"
        error={bad ? `That link is not accepted. Allowed: ${Object.values(EMBED_PROVIDERS).join(", ")} (for Google Maps use Share → “Embed a map”).` : error}
        hint="Paste the page link, the embed link or the whole <iframe> snippet. Raw HTML is never stored — only a checked https address." />
      {parsed && <p className="text-xs text-fog-400"><span className="t-label mr-2 text-ok">{EMBED_PROVIDERS[parsed.provider]}</span><span className="t-data break-all">{parsed.src}</span></p>}
    </div>
  );
}

export const sectionForms: Record<SectionKind, FieldGroup[]> = {
  hero: [{ title: "Hero", fields: [
    { name: "eyebrow", label: "Eyebrow", type: "text", max: 60, hint: "Small label above the title." },
    { name: "feelWord", label: "Feeling word", type: "text", max: 30, hint: "One word of the title to set in italic serif. Must appear in the title." , check: (v, all) => (typeof v === "string" && v && !String(all.title ?? "").toLowerCase().includes(v.toLowerCase()) ? "This word does not appear in the title." : null) },
    { name: "title", label: "Title", type: "text", max: 120, required: true, wide: true },
    LEDE, ...buttons(false), { name: "mediaId", label: "Image", type: "media", category: "pages" }, TONE,
  ] }],
  text: [{ title: "Text", fields: [HEADING, { name: "body", label: "Body", type: "custom", render: ({ value, onChange, error, disabled }) => <MarkdownLiteField value={typeof value === "string" ? value : ""} onChange={onChange} error={error} disabled={disabled} /> },
    { name: "width", label: "Measure", type: "select", options: [{ value: "narrow", label: "Narrow (reading width)" }, { value: "wide", label: "Wide" }] }, TONE] }],
  image: [{ title: "Image", fields: [{ name: "mediaId", label: "Image", type: "media", required: true, category: "pages", hint: "Alt text comes from the media library — set it there." }, { name: "caption", label: "Caption", type: "text", max: 240, wide: true },
    { name: "layout", label: "Layout", type: "select", options: [{ value: "contained", label: "Contained" }, { value: "full", label: "Full width" }] }] }],
  video: [{ title: "Video", fields: [{ name: "mediaId", label: "MP4 file", type: "media", imagesOnly: false, required: true, category: "pages", hint: "Upload an MP4 (max 10 MB). For longer films use an Embed section." }, { name: "posterMediaId", label: "Poster image", type: "media", category: "pages" },
    { name: "caption", label: "Caption", type: "text", max: 240, wide: true }, { name: "muted", label: "Sound", type: "toggle", onLabel: "Starts muted", offLabel: "Starts with sound" }] }],
  gallery: [{ title: "Gallery", fields: [HEADING, { name: "mediaIds", label: "Images", type: "custom", render: ({ value, onChange, error, disabled }) => <MediaListField label="Images" required error={error} disabled={disabled} category="pages" value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} /> },
    { name: "columns", label: "Columns", type: "custom", render: ({ value, onChange, disabled }) => <SelectField label="Columns on desktop" disabled={disabled} value={String(value ?? 3)} onChange={(v) => onChange(Number(v))} options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} /> }] }],
  product_showcase: [{ title: "Product showcase", fields: [HEADING, LEDE, { name: "mode", label: "Which products", type: "select", options: [{ value: "selected", label: "The products chosen below" }, { value: "featured", label: "Featured products (automatic)" }] },
    { ...limit(12), showIf: (v) => v.mode === "featured" }, { name: "productSlugs", label: "Products", type: "relation", table: "products", valueField: "slug", labelField: "name", hintField: "status", multiple: true, showIf: (v) => v.mode !== "featured" }] }],
  cta: [{ title: "Call to action", fields: [{ name: "title", label: "Title", type: "text", max: 120, required: true, wide: true }, { name: "body", label: "Supporting line", type: "textarea", rows: 2, max: 400 }, ...buttons(true), TONE] }],
  testimonials: [{ title: "Testimonials", note: "Shows published testimonials with recorded consent. If there are none, the section is left out of the page.", fields: [HEADING, limit(12)] }],
  faq: [{ title: "FAQ", fields: [HEADING, { name: "topics", label: "Topics", type: "custom", render: ({ value, onChange, disabled }) => <CheckGroupField label="Topics" hint="None ticked = all topics." disabled={disabled} options={FAQ_TOPIC_KEYS.map((t) => ({ value: t, label: titleCase(t) }))} value={Array.isArray(value) ? (value as (typeof FAQ_TOPIC_KEYS)[number][]) : []} onChange={onChange} /> }, limit(30)] }],
  pricing: [{ title: "Pricing", note: "Shows each product's public “from” price and pricing mode with a GET AN ESTIMATE button. Confidential pricing rules are never exposed.", fields: [HEADING, LEDE, { name: "productSlugs", label: "Products", type: "relation", table: "products", valueField: "slug", labelField: "name", hintField: "pricing_mode", multiple: true, required: true }] }],
  portfolio: [{ title: "Portfolio", fields: [HEADING, { name: "mode", label: "Which projects", type: "select", options: [{ value: "featured", label: "Featured projects (automatic)" }, { value: "selected", label: "The projects chosen below" }] },
    { ...limit(12), showIf: (v) => v.mode !== "selected" }, { name: "slugs", label: "Projects", type: "relation", table: "portfolio_projects", valueField: "slug", labelField: "title", hintField: "status", multiple: true, showIf: (v) => v.mode === "selected" }] }],
  billboard_map: [{ title: "Billboard map", fields: [HEADING, LEDE, { name: "province", label: "Focus on province", type: "text", max: 80, hint: "Optional. Must match the province name used on the billboards, e.g. Vientiane Capital." }] }],
  campaign: [{ title: "Campaign", fields: [{ name: "campaignSlug", label: "Campaign", type: "relation", table: "campaigns", valueField: "slug", labelField: "name", hintField: "status", required: true }] }],
  embed: [{ title: "Embed", note: "Third-party players load only after the visitor clicks, so the page stays fast and private.", fields: [
    { name: "src", label: "Link", type: "custom", render: ({ value, onChange, error, disabled }) => <EmbedSrcField value={typeof value === "string" ? value : ""} onChange={onChange} error={error} disabled={disabled} /> },
    { name: "title", label: "Accessible title", type: "text", max: 160, required: true, wide: true, hint: "Read out by screen readers, e.g. “Film: how we print a jersey”." },
    { name: "aspect", label: "Shape", type: "select", options: [{ value: "16:9", label: "16:9 widescreen" }, { value: "4:3", label: "4:3" }, { value: "1:1", label: "Square" }] },
  ] }],
};

import { titleCase } from "@/lib/format";
import type { ResourceConfig } from "../../resource/types";

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

export const FAQ_TOPICS = ["ordering", "artwork", "billboards", "studio", "delivery"] as const;

export const faqsConfig: ResourceConfig<"faqs"> = {
  table: "faqs", singular: "FAQ", plural: "FAQs", cap: "content", statusField: "status", sortField: "sort",
  order: [{ column: "sort" }, { column: "q" }],
  intro: "Questions shown on the FAQ page and in the FAQ blocks of product and billboard pages, grouped by topic. Answer in plain language; one idea per answer.",
  search: (r) => `${r.q} ${r.a} ${r.topic}`, titleOf: (r) => r.q,
  columns: [
    { key: "q", header: "Question", cell: (r) => <span className="block max-w-xl"><span className="block text-fog-50">{r.q}</span><span className="block text-xs text-fog-500">{clip(r.a)}</span></span> },
    { key: "topic", header: "Topic", hideBelow: "sm", cell: (r) => <span className="t-label text-fog-400">{r.topic}</span> },
  ],
  defaults: () => ({ topic: "ordering", sort: 0 }),
  groups: [{ title: "Question", fields: [
    { name: "topic", label: "Topic", type: "select", required: true, options: FAQ_TOPICS.map((t) => ({ value: t, label: titleCase(t) })) },
    { name: "sort", label: "Order", type: "number", integer: true, min: 0, hint: "Lower numbers appear first." },
    { name: "q", label: "Question", type: "text", required: true, max: 200, wide: true },
    { name: "a", label: "Answer", type: "textarea", required: true, rows: 6, max: 2000 },
  ] }],
};

export const testimonialsConfig: ResourceConfig<"testimonials"> = {
  table: "testimonials", singular: "Testimonial", plural: "Testimonials", cap: "content", statusField: "status", sortField: "sort",
  order: [{ column: "sort" }, { column: "name" }],
  intro: <>Only real words from real clients. A testimonial <strong className="text-fog-200">cannot be published until consent is recorded</strong> — the database enforces this. The section is hidden on the site while there are no published testimonials.</>,
  search: (r) => `${r.quote} ${r.name} ${r.company}`, titleOf: (r) => `${r.name}${r.company ? ` · ${r.company}` : ""}`,
  columns: [
    { key: "quote", header: "Quote", cell: (r) => <span className="block max-w-xl"><span className="block text-fog-50">“{clip(r.quote, 110)}”</span><span className="block text-xs text-fog-500">{r.name}{r.role && `, ${r.role}`}{r.company && ` · ${r.company}`}</span></span> },
    { key: "consent", header: "Consent", cell: (r) => <span className={`t-label ${r.consent_recorded ? "text-ok" : "text-warn"}`}>{r.consent_recorded ? "Recorded" : "Not recorded"}</span> },
  ],
  defaults: () => ({ sort: 0, consent_recorded: false }),
  validate: (v): Record<string, string> => (v.status === "published" && !v.consent_recorded ? { consent_recorded: "Record the client's consent before publishing. Keep the written permission (email or message) on file.", status: "Cannot be published without recorded consent." } : {}),
  groups: [
    { title: "Testimonial", fields: [
      { name: "quote", label: "Quote", type: "textarea", required: true, rows: 5, max: 600, hint: "Use the client's exact words. Do not embellish." },
      { name: "name", label: "Name", type: "text", required: true, max: 120 },
      { name: "role", label: "Role", type: "text", max: 120 },
      { name: "company", label: "Company", type: "text", max: 160 },
      { name: "sort", label: "Order", type: "number", integer: true, min: 0 },
    ] },
    { title: "Consent", note: "SPP only publishes a testimonial when the person has agreed to their name and words appearing on the website.", fields: [
      { name: "consent_recorded", label: "Consent to publish", type: "toggle", onLabel: "Consent obtained and on file", offLabel: "Not recorded yet" },
    ] },
  ],
};

export const teamConfig: ResourceConfig<"team_members"> = {
  table: "team_members", singular: "Team member", plural: "Team members", cap: "content", statusField: "status", sortField: "sort",
  order: [{ column: "sort" }, { column: "name" }],
  intro: "People shown on the About page. Use real names, titles and photographs only.",
  search: (r) => `${r.name} ${r.title}`, titleOf: (r) => r.name,
  columns: [
    { key: "name", header: "Name", cell: (r) => <span><span className="block text-fog-50">{r.name}</span><span className="block text-xs text-fog-500">{r.title}</span></span> },
    { key: "photo", header: "Photo", hideBelow: "sm", cell: (r) => <span className={`t-label ${r.photo_media_id ? "text-fog-400" : "text-warn"}`}>{r.photo_media_id ? "Set" : "Missing"}</span> },
  ],
  defaults: () => ({ sort: 0 }),
  groups: [{ title: "Person", fields: [
    { name: "name", label: "Name", type: "text", required: true, max: 120 },
    { name: "title", label: "Job title", type: "text", max: 120 },
    { name: "bio", label: "Short bio", type: "textarea", rows: 5, max: 1200 },
    { name: "photo_media_id", label: "Photo", type: "media", category: "team" },
    { name: "sort", label: "Order", type: "number", integer: true, min: 0 },
  ] }],
};

export const servicesConfig: ResourceConfig<"services"> = {
  table: "services", singular: "Service", plural: "Services", cap: "content", statusField: "status", sortField: "sort",
  order: [{ column: "sort" }, { column: "name" }],
  intro: "The four service pillars on the Services page. Each links to the products that deliver it.",
  search: (r) => `${r.name} ${r.slug} ${r.summary}`, titleOf: (r) => r.name,
  columns: [
    { key: "name", header: "Service", cell: (r) => <span><span className="block text-fog-50">{r.name}</span><span className="t-data block text-xs text-fog-500">/services/{r.slug}/</span></span> },
    { key: "verb", header: "Verb", hideBelow: "sm", cell: (r) => <span className="t-label text-fog-400">{r.verb}</span> },
    { key: "products", header: "Products", hideBelow: "md", cell: (r) => <span className="t-data">{r.product_slugs.length}</span> },
  ],
  defaults: () => ({ verb: "Produce", sort: 0 }),
  groups: [{ title: "Service", fields: [
    { name: "name", label: "Name", type: "text", required: true, max: 120 },
    { name: "verb", label: "Verb", type: "select", required: true, options: ["Design", "Produce", "Promote", "Visualise"].map((v) => ({ value: v, label: v })), hint: "The action word used as the eyebrow on the site." },
    { name: "slug", label: "Slug", type: "slug", from: "name", required: true, prefix: "/services/" },
    { name: "summary", label: "Summary", type: "textarea", rows: 3, max: 400 },
    { name: "body", label: "Body", type: "textarea", rows: 8, max: 6000 },
    { name: "deliverables", label: "Deliverables", type: "tags", hint: "What the client receives. One short phrase each." },
    { name: "product_slugs", label: "Related products", type: "relation", table: "products", valueField: "slug", labelField: "name", hintField: "status", multiple: true },
    { name: "sort", label: "Order", type: "number", integer: true, min: 0 },
  ] }],
};

export const categoriesConfig: ResourceConfig<"categories"> = {
  table: "categories", singular: "Category", plural: "Categories", cap: "catalogue", statusField: "status", sortField: "sort",
  order: [{ column: "sort" }, { column: "name" }],
  intro: "Catalogue categories. A category that still has products cannot be deleted — archive it, or move its products first. Changing a slug changes public URLs.",
  search: (r) => `${r.name} ${r.slug}`, titleOf: (r) => r.name,
  columns: [
    { key: "plate", header: "Plate", className: "w-16", cell: (r) => <span className="t-data text-fog-400">{r.plate}</span> },
    { key: "name", header: "Category", cell: (r) => <span><span className="block text-fog-50">{r.name}</span><span className="t-data block text-xs text-fog-500">{r.slug}</span></span> },
  ],
  defaults: () => ({ plate: "00", sort: 0, status: "published" }),
  groups: [{ title: "Category", fields: [
    { name: "name", label: "Name", type: "text", required: true, max: 120 },
    { name: "plate", label: "Plate number", type: "text", required: true, max: 2, pattern: /^\d{2}$/, patternMessage: "Two digits, e.g. 04.", hint: "The two-digit index printed beside the category." },
    { name: "slug", label: "Slug", type: "slug", from: "name", required: true },
    { name: "blurb", label: "Blurb", type: "textarea", rows: 3, max: 400 },
    { name: "sort", label: "Order", type: "number", integer: true, min: 0 },
  ] }],
};

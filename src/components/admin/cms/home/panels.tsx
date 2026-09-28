"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { PRINT_STYLES } from "@/components/hero/prints";
import { Button } from "@/components/ui/Button";
import type { Bilingual, HomeConfig, HomeSection } from "@/content/types";
import { HOME_LIMITS } from "@/lib/home";
import { NumberField, SelectField, TextField, ToggleField } from "../../resource/fields";
import { MultiPick } from "../../resource/pickers";
import { SeoField } from "../../resource/seo";
import { Panel } from "../../ui";
import { sectionState, type HomeData, type useHomeData } from "./data";
import { BilingualField, ButtonField, CheckList, LinkField } from "./fields";
import { CTA_BUTTONS, HERO_BUTTONS, HERO_FIELDS, SECTION_META } from "./meta";

type Errors = Record<string, string>;
type Options = ReturnType<typeof useHomeData>["options"];
type Common = { errors: Errors; disabled: boolean; options: Options; loading: boolean };

const Lead = ({ children }: { children: React.ReactNode }) => <p className="mb-5 max-w-3xl text-sm leading-relaxed text-fog-400">{children}</p>;
const Note = ({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) => <p role="status" className={clsx("mb-5 border px-3 py-2.5 text-sm leading-relaxed text-fog-50", tone === "warn" ? "border-warn/40 bg-warn/10" : "border-ink-600 bg-ink-950")}>{children}</p>;
const Stack = ({ children }: { children: React.ReactNode }) => <div className="grid gap-5">{children}</div>;

/* ── Announcement bar ─────────────────────────────────────────────────────── */
export function AnnouncementPanel({ value, onChange, errors, disabled, options }: Common & { value: HomeConfig["announcement"]; onChange: (v: HomeConfig["announcement"]) => void }) {
  const set = <K extends keyof HomeConfig["announcement"]>(k: K, v: HomeConfig["announcement"][K]) => onChange({ ...value, [k]: v });
  const text = value.text.en || value.text.lo;
  return (
    <Panel title="Announcement bar">
      <Lead>A slim bar above the menu on the landing page — for a holiday closure, a new service or an event. Visitors can close it; it stays closed until they end their browser session, and a new message shows again.</Lead>
      <Stack>
        <ToggleField label="Show the bar" value={value.visible} onChange={(v) => set("visible", v)} onLabel="On — shown after the next publish" offLabel="Off" disabled={disabled} />
        <BilingualField label="Message" value={value.text} onChange={(v) => set("text", v)} max={HOME_LIMITS.announcement} rows={2} fallback={{ en: "", lo: "" }} hint="One short sentence. State facts only — dates, places, what is new." errors={errors} path="announcement.text" disabled={disabled} />
        <LinkField label="Link (optional)" value={value.href} onChange={(v) => set("href", v)} options={options.links} optional error={errors["announcement.href"]} disabled={disabled} />
        <SelectField label="Colour" value={value.tone} onChange={(v) => set("tone", v)} options={[{ value: "gold", label: "Gold — dark text on SPP gold" }, { value: "navy", label: "Navy — white text on deep blue" }]} disabled={disabled} />
        <div>
          <p className="t-label mb-2 text-fog-400">Preview</p>
          <div className={clsx("flex min-h-11 items-center justify-between gap-4 px-4 text-sm font-medium", value.tone === "navy" ? "bg-navy text-white" : "on-gold", !value.visible && "opacity-50")}>
            <span className="py-2">{text || "Your message appears here."}{value.href && text ? " →" : ""}</span>
            <span aria-hidden>×</span>
          </div>
          {!value.visible && <p className="mt-2 text-xs text-fog-500">The bar is switched off, so visitors do not see it.</p>}
        </div>
      </Stack>
    </Panel>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
export function HeroPanel({ value, onChange, errors, disabled, options }: Common & { value: HomeConfig["hero"]; onChange: (v: HomeConfig["hero"]) => void }) {
  const set = <K extends keyof HomeConfig["hero"]>(k: K, v: HomeConfig["hero"][K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4">
      <Panel title="Hero · headline">
        <Lead>The opening screen. It is always the first thing on the page. Empty fields use the site&rsquo;s own wording, already written in English and Lao.</Lead>
        <Stack>{HERO_FIELDS.map((f) => <BilingualField key={f.name} label={f.label} value={value[f.name]} onChange={(v) => set(f.name, v)} max={f.max} rows={"rows" in f ? f.rows : 1} fallback={f.fallback} hint={"hint" in f ? f.hint : undefined} errors={errors} path={`hero.${f.name}`} disabled={disabled} />)}</Stack>
      </Panel>
      <Panel title="Hero · the printed word">
        <Lead>The 3D T-shirt, billboard, poster, cup and bag are printed with this word until the visitor types their own brand name. The typeface changes every few seconds.</Lead>
        <Stack>
          <TextField label="Word" required value={value.word} onChange={(v) => set("word", v.slice(0, HOME_LIMITS.word))} maxLength={HOME_LIMITS.word} error={errors["hero.word"]} disabled={disabled} hint={<>Short works best — a name, not a sentence. <span className="t-data">{value.word.length}/{HOME_LIMITS.word}</span></>} />
          <CheckList label="Print styles to cycle through" hint="Untick a style to leave it out. Every style stays available inside SPP Studio." options={PRINT_STYLES.map((s) => ({ value: s.name, label: s.name, note: s.tag }))} value={value.styles} onChange={(v) => set("styles", v)} error={errors["hero.styles"]} disabled={disabled} />
        </Stack>
      </Panel>
      <Panel title="Hero · buttons">
        <Stack>
          {(["primaryCta", "secondaryCta"] as const).map((k) => <ButtonField key={k} label={HERO_BUTTONS[k].label} value={value[k]} onChange={(v) => set(k, v)} fallback={HERO_BUTTONS[k].fallback} options={options.links} optional={!HERO_BUTTONS[k].required} errors={errors} path={`hero.${k}`} disabled={disabled} />)}
        </Stack>
      </Panel>
    </div>
  );
}

/* ── Landing-page SEO ─────────────────────────────────────────────────────── */
export function SeoPanel({ value, onChange, disabled, data }: { value: HomeConfig["seo"]; onChange: (v: HomeConfig["seo"]) => void; disabled: boolean; data: HomeData | null }) {
  return (
    <Panel title="Search engines (SEO)">
      <Lead>How the landing page appears in Google and when the link is shared. Leave both empty to use the site-wide defaults from Settings → Company &amp; contact. Search engines read the English page, so there is no Lao field here.</Lead>
      <SeoField disabled={disabled} path="/" value={{ ...(value.title.en && { title: value.title.en }), ...(value.description.en && { description: value.description.en }) }}
        onChange={(v) => onChange({ title: { en: (v.title ?? "").slice(0, HOME_LIMITS.seoTitle) }, description: { en: (v.description ?? "").slice(0, HOME_LIMITS.seoDescription) } })}
        fallbackTitle={data?.site?.seo?.defaultTitle ?? ""} fallbackDescription={data?.site?.seo?.defaultDescription ?? ""} />
    </Panel>
  );
}

/* ── Custom blocks ────────────────────────────────────────────────────────── */
export function BlocksCard({ data, loading, canWrite, busy, onOpen }: { data: HomeData | null; loading: boolean; canWrite: boolean; busy: boolean; onOpen: () => void }) {
  const b = data?.blocks ?? null;
  return (
    <Panel title="Custom blocks">
      <Lead>Add anything of your own to the landing page — text, image with text, gallery, video, banner, product grid, price list, map — built in the page builder, no code. The blocks appear where “Custom blocks” sits in the list on the left.</Lead>
      {loading && !data ? <div className="skeleton h-11 w-64" /> : (
        <>
          <p className="mb-4 text-sm text-fog-100">
            {!b ? "No custom blocks have been created yet." : <>{b.count === 0 ? "The page builder is ready, with no blocks yet." : `${b.count} block${b.count === 1 ? "" : "s"} in the page builder.`} {b.published ? "Marked Published." : <span className="text-warn">Not marked Published — visitors do not see the blocks.</span>}</>}
          </p>
          <Button size="sm" className="min-h-11" loading={busy} disabled={!b && !canWrite} arrow onClick={onOpen}>{b ? "Open the page builder" : "Create and open the page builder"}</Button>
          {!b && !canWrite && <p className="mt-2 text-xs text-fog-500">Your role can view content but not change it.</p>}
        </>
      )}
      <p className="mt-5 border-t border-ink-700 pt-4 text-xs leading-relaxed text-fog-500">Blocks are saved in the page builder as you edit them — they are separate from the Save button on this screen. Like everything else, they reach the public site at the next “Publish site”.</p>
    </Panel>
  );
}

/* ── One section ──────────────────────────────────────────────────────────── */
export function SectionPanel({ value, onChange, errors, disabled, options, loading, data, blocks }: Common & { value: HomeSection; onChange: (v: HomeSection) => void; data: HomeData | null; blocks: React.ReactNode }) {
  const meta = SECTION_META[value.key];
  const state = sectionState(value, data);
  const path = `sections.${value.key}`;
  const set = <K extends keyof HomeSection>(k: K, v: HomeSection[K]) => onChange({ ...value, [k]: v });
  const copy = (name: "eyebrow" | "title" | "lede" | "body", v: Bilingual) => set(name, v);
  return (
    <div className="grid gap-4">
      <Panel title={meta.label} action={<span className={clsx("t-label border px-2 py-1 text-[0.625rem]", state.status === "visible" ? "border-ok/40 text-ok" : state.status === "empty" ? "border-warn/40 text-warn" : "border-ink-500 text-fog-400")}>{state.status === "visible" ? "Visible" : state.status === "empty" ? "Empty" : "Hidden"}</span>}>
        <Lead>{meta.blurb}{meta.source && <> {meta.source.text} <Link href={meta.source.href} className="text-sky underline underline-offset-4 hover:text-fog-50">{meta.source.label}</Link>.</>}</Lead>
        {state.note && <Note tone={state.status === "empty" ? "warn" : "info"}>{state.note}</Note>}
        <Stack>
          <ToggleField label="Show this section" value={value.visible} onChange={(v) => set("visible", v)} onLabel="Shown" offLabel="Hidden" disabled={disabled} />

          {value.key === "featured" && <MultiPick label="Products to feature" required max={HOME_LIMITS.products} options={options.products} loading={loading} value={value.products} onChange={(v) => set("products", v)} error={errors[`${path}.products`]} disabled={disabled} emptyText="No product chosen — the section is not shown." hint={`Search by name, click to add, then order with ↑ ↓. Up to ${HOME_LIMITS.products}. A price is shown only when online pricing is on and the product has a public “from” price.`} />}
          {value.key === "capabilities" && <MultiPick label="Categories to show" max={HOME_LIMITS.categories} options={options.categories} loading={loading} value={value.categories} onChange={(v) => set("categories", v)} disabled={disabled} emptyText="Nothing chosen — every category is shown, in catalogue order." hint="Choose some to show only those, in the order you put them." />}
          {value.key === "work" && <MultiPick label="Projects to show" max={HOME_LIMITS.projects} options={options.projects} loading={loading} value={value.projects} onChange={(v) => set("projects", v)} error={errors[`${path}.projects`]} disabled={disabled} emptyText="Nothing chosen — the first three projects marked Featured are shown." hint={`Up to ${HOME_LIMITS.projects}. Sample projects keep their “Sample project” label.`} />}
          {value.key === "faq" && (
            <>
              <MultiPick label="Questions to show" max={HOME_LIMITS.faqs} options={options.faqs} loading={loading} value={value.faqIds} onChange={(v) => set("faqIds", v)} error={errors[`${path}.faqIds`]} disabled={disabled} emptyText="Nothing chosen — one question per topic is shown." hint="Choose questions to show exactly those, in your order." />
              {value.faqIds.length === 0 && <NumberField label="How many questions" min={1} max={HOME_LIMITS.faqLimit} step={1} value={value.faqLimit} onChange={(v) => set("faqLimit", v ?? 5)} error={errors[`${path}.faqLimit`]} disabled={disabled} hint="Used while no question is chosen above." className="max-w-xs" />}
            </>
          )}

          {meta.fields.map((f) => <BilingualField key={f.name} label={f.label} value={value[f.name]} onChange={(v) => copy(f.name, v)} max={f.max} rows={f.rows} accent={f.accent} fallback={f.fallback} hint={f.hint} errors={errors} path={`${path}.${f.name}`} disabled={disabled} />)}

          {value.key === "cta" && (["primary", "secondary"] as const).map((k) => <ButtonField key={k} label={CTA_BUTTONS[k].label} value={value[k]} onChange={(v) => set(k, v)} fallback={CTA_BUTTONS[k].fallback} options={options.links} optional={!CTA_BUTTONS[k].required} errors={errors} path={`${path}.${k}`} disabled={disabled} />)}
        </Stack>
      </Panel>
      {value.key === "blocks" && blocks}
    </div>
  );
}

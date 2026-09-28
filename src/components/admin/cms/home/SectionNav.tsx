"use client";
import { clsx } from "clsx";
import type { HomeConfig, HomeSectionKey } from "@/content/types";
import { Panel } from "../../ui";
import { sectionState, type HomeData } from "./data";
import { SECTION_META, type EditorItem } from "./meta";

const CHIP = { visible: "border-ok/40 text-ok", hidden: "border-ink-500 text-fog-400", empty: "border-warn/40 text-warn", on: "border-ok/40 text-ok", off: "border-ink-500 text-fog-400" } as const;
const Chip = ({ tone, children }: { tone: keyof typeof CHIP; children: string }) => <span className={clsx("t-label inline-flex flex-none items-center border px-1.5 py-0.5 text-[0.5625rem]", CHIP[tone])}>{children}</span>;

const row = (active: boolean) => clsx("flex items-stretch border bg-ink-950 transition-colors", active ? "border-yellow" : "border-ink-700");
const pick = "min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-ink-850 focus-visible:bg-ink-850";

/**
 * The landing page from top to bottom. The announcement bar and the hero are
 * fixed at the top; the sections below them move with ↑ ↓ (plain buttons, so
 * they work from the keyboard and on a phone) and each has its own on/off switch.
 */
export function SectionNav({ config, data, errors, selected, onSelect, onMove, onToggle, canWrite }: {
  config: HomeConfig; data: HomeData | null; errors: Record<string, string>; selected: EditorItem;
  onSelect: (item: EditorItem) => void; onMove: (key: HomeSectionKey, by: -1 | 1) => void; onToggle: (key: HomeSectionKey) => void; canWrite: boolean;
}) {
  const bad = (prefix: string) => Object.keys(errors).some((k) => k === prefix || k.startsWith(`${prefix}.`));
  const fixed = (item: EditorItem, label: string, note: string, chip: React.ReactNode) => (
    <li className={row(selected === item)}>
      <button type="button" onClick={() => onSelect(item)} aria-current={selected === item ? "true" : undefined} className={pick}>
        <span className="flex flex-wrap items-center gap-2"><span className="text-sm text-fog-50">{label}</span>{chip}{bad(item) && <Chip tone="empty">Check</Chip>}</span>
        <span className="mt-0.5 block truncate text-xs text-fog-500">{note}</span>
      </button>
    </li>
  );

  return (
    <Panel title="The page, top to bottom">
      <ul className="grid gap-2">
        {fixed("announcement", "Announcement bar", "A slim bar above the menu", <Chip tone={config.announcement.visible ? "on" : "off"}>{config.announcement.visible ? "On" : "Off"}</Chip>)}
        {fixed("hero", "Hero", "Always first · headline, printed word, buttons", <Chip tone="visible">Visible</Chip>)}
      </ul>

      <p className="t-label mb-2 mt-5 flex items-center justify-between text-[0.625rem] text-fog-500"><span>Sections · in page order</span><span>Move · Show</span></p>
      <ol className="grid gap-2">
        {config.sections.map((s, i) => {
          const state = sectionState(s, data);
          const name = SECTION_META[s.key].label;
          return (
            <li key={s.key} className={row(selected === s.key)}>
              <button type="button" onClick={() => onSelect(s.key)} aria-current={selected === s.key ? "true" : undefined} className={pick}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="t-data text-xs text-fog-500">{String(i + 1).padStart(2, "0")}</span>
                  <span className={clsx("text-sm", s.visible ? "text-fog-50" : "text-fog-400")}>{name}</span>
                  <Chip tone={state.status}>{state.status === "visible" ? "Visible" : state.status === "hidden" ? "Hidden" : "Empty"}</Chip>
                  {bad(`sections.${s.key}`) && <Chip tone="empty">Check</Chip>}
                </span>
              </button>
              <span className="flex flex-none items-center border-l border-ink-700">
                <button type="button" disabled={!canWrite || i === 0} onClick={() => onMove(s.key, -1)} aria-label={`Move ${name} up`} title="Move up" className="h-11 w-9 text-fog-400 hover:text-yellow disabled:opacity-25">↑</button>
                <button type="button" disabled={!canWrite || i === config.sections.length - 1} onClick={() => onMove(s.key, 1)} aria-label={`Move ${name} down`} title="Move down" className="h-11 w-9 text-fog-400 hover:text-yellow disabled:opacity-25">↓</button>
                <button type="button" role="switch" aria-checked={s.visible} aria-label={`Show ${name} on the landing page`} disabled={!canWrite} onClick={() => onToggle(s.key)} className="flex h-11 w-11 items-center justify-center disabled:opacity-50">
                  <span aria-hidden className={clsx("relative h-5 w-9 flex-none border transition-colors", s.visible ? "border-yellow bg-yellow/20" : "border-ink-500 bg-ink-950")}><span className={clsx("absolute top-0.5 h-3.5 w-3.5 transition-[left,background] duration-150", s.visible ? "left-[1.125rem] bg-yellow" : "left-0.5 bg-fog-500")} /></span>
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <ul className="mt-5 grid gap-2">
        {fixed("seo", "Search engines (SEO)", "Title and description of the landing page", config.seo.title.en || config.seo.description.en ? <Chip tone="on">Custom</Chip> : <Chip tone="off">Default</Chip>)}
      </ul>
    </Panel>
  );
}

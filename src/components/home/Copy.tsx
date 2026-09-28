"use client";
import { Fragment, type ReactNode } from "react";
import type { Bilingual } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { pickBilingual } from "@/lib/i18n/core";

/** The text overrides a landing-page section accepts. Anything left empty keeps the site's own wording. */
export type SectionCopy = { eyebrow?: Bilingual; title?: Bilingual; lede?: Bilingual; body?: Bilingual };

/** How the *accent* word of a headline is set. `box` is the manifesto's ink block behind gold type. */
export type Accent = "feel" | "plain" | "gold" | "box";
const ACCENT: Record<Exclude<Accent, "box">, string> = { feel: "t-feel text-yellow", plain: "t-feel", gold: "t-feel text-gold" };

function accentNode(word: string, accent: Accent): ReactNode {
  if (accent === "box") return <span className="relative isolate whitespace-nowrap text-gold"><span aria-hidden className="absolute -inset-x-[0.06em] bottom-[0.04em] top-[0.2em] -z-10 bg-ink-950" />{word}</span>;
  return <span className={ACCENT[accent]}>{word}</span>;
}

/** "See it *before* it exists." → the starred words become the headline's accent. No HTML is ever interpreted. */
export function rich(text: string, accent: Accent): ReactNode {
  return text.split(/\*([^*]+)\*/g).map((part, i) => (part === "" ? null : <Fragment key={i}>{i % 2 ? accentNode(part, accent) : part}</Fragment>));
}

/** The visitor's language when SPP wrote it, else English, else `undefined` so the caller keeps its default. */
export function useCopy() {
  const { lang } = useLang();
  return (value: Bilingual | null | undefined) => pickBilingual(value, lang)?.text;
}

/**
 * One piece of landing-page text: SPP's override in the visitor's language, or
 * the site's default — a `fallback` string, or `children` when the default is
 * already translated markup. Server components render it like any other element.
 */
export function Copy({ value, fallback = "", accent, children, as: Tag, className }: {
  value?: Bilingual | null; fallback?: string; accent?: Accent; children?: ReactNode;
  /** wrap the text in this element — and render nothing at all when there is no text to show */
  as?: "p" | "span"; className?: string;
}) {
  const { lang } = useLang();
  const picked = pickBilingual(value, lang);
  if (!picked && children !== undefined) return <>{children}</>;
  const text = picked?.text ?? fallback;
  const node = accent ? rich(text, accent) : text;
  if (Tag) return text ? <Tag lang={picked?.lang === "lo" ? "lo" : undefined} className={className}>{node}</Tag> : null;
  return picked?.lang === "lo" ? <span lang="lo">{node}</span> : <>{node}</>;
}

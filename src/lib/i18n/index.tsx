"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_LANG, isLang, STORAGE_KEY, translate, translateLiteral, type Key, type Lang, type TFn, type Vars } from "./core";

export { LANGS } from "./core";
export type { Key, Lang, TFn, Vars } from "./core";

/*
 * The site is a static export, so the HTML is always English. The visitor's
 * choice lives in localStorage and is applied after hydration through
 * useSyncExternalStore — the server snapshot is English, so the first client
 * render matches the markup and React then re-renders in the saved language.
 */
const listeners = new Set<() => void>();
let memory: Lang | null = null; // the choice still works for the visit when storage is blocked

function read(): Lang {
  if (memory) return memory;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLang(saved) ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function write(lang: Lang) {
  memory = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  // another tab changing the language changes this one too
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) { memory = null; cb(); } };
  listeners.add(cb);
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: TFn };
const LangCtx = createContext<Ctx>({ lang: DEFAULT_LANG, setLang: () => {}, t: (k, v) => translate(DEFAULT_LANG, k, v) });

/* Geist, Bricolage and JetBrains Mono carry no Lao glyphs. Noto Sans Lao (self-hosted by the root layout as
   --font-notolao) is slotted in after each Latin face, so Latin keeps the brand type and Lao gets a real Lao face.
   Lao stacks tone marks above and below the line, so translated headings and labels get room to breathe. */
const LAO_SANS = 'var(--font-geist), var(--font-notolao), system-ui, -apple-system, "Segoe UI", sans-serif';
const LAO_CSS = `
html[lang="lo"] :is(.t-hero,.t-display,.t-title,.t-heading){font-family:var(--font-bricolage),var(--font-notolao),"Helvetica Neue",Arial,sans-serif}
html[lang="lo"] .t-feel{font-family:var(--font-instrument),var(--font-notolao),"Times New Roman",serif}
html[lang="lo"] :is(.t-label,.t-data,.font-mono){font-family:var(--font-jetbrains),var(--font-notolao),ui-monospace,"SF Mono",Menlo,monospace}
html[lang="lo"] .t-label{letter-spacing:.04em;line-height:1.5}
html[lang="lo"] :is(.t-title,.t-heading){line-height:1.3}
html[lang="lo"] :is(.t-hero,.t-display):is([lang="lo"],:has([lang="lo"])){line-height:1.25;letter-spacing:-.01em}
`;

export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, read, () => DEFAULT_LANG);
  const t = useCallback<TFn>((key, vars) => translate(lang, key, vars), [lang]);
  const value = useMemo<Ctx>(() => ({ lang, setLang: write, t }), [lang, t]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.style.fontFamily = lang === "lo" ? LAO_SANS : "";
  }, [lang]);

  return (
    <LangCtx.Provider value={value}>
      {lang === "lo" && <style>{LAO_CSS}</style>}
      {children}
    </LangCtx.Provider>
  );
}

export const useLang = () => useContext(LangCtx);

/** `const t = useT(); t("common.requestQuote")` — for client components. */
export const useT = (): TFn => useContext(LangCtx).t;

/** `const say = useLiteral(); say("Request a quote")` — a known English phrase in the visitor's language, anything else unchanged. */
export function useLiteral() {
  const { lang } = useContext(LangCtx);
  return useCallback((text: string) => translateLiteral(lang, text), [lang]);
}

/** Marks a Lao text node so assistive tech and the type rules know its language. */
function Text({ lang, children }: { lang: Lang; children: string }) {
  return lang === "lo" ? <span lang="lo">{children}</span> : <>{children}</>;
}

/** A translated text node, usable from server components: `<T k="footer.explore" />`. */
export function T({ k, vars }: { k: Key; vars?: Vars }) {
  const { lang, t } = useContext(LangCtx);
  return <Text lang={lang}>{t(k, vars)}</Text>;
}

/**
 * Translates an English literal when it is one of the site's known phrases
 * (see LITERALS in core.ts) and otherwise renders it as authored. Lets shared
 * chrome translate labels that pages hand over as plain strings.
 */
export function Tx({ text }: { text: string }) {
  const { lang } = useContext(LangCtx);
  const out = translateLiteral(lang, text);
  return out === text ? <>{text}</> : <Text lang={lang}>{out}</Text>;
}

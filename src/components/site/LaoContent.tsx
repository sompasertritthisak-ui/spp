"use client";
import { useEffect } from "react";
import { useLang } from "@/lib/i18n";

/**
 * Whole-page Lao. When the visitor reads Lao, every English segment on the
 * page that has a translation (src/content/lao/segments.json, loaded only
 * then) is swapped for it in place, and swapped back when they return to
 * English. The dictionary strings in lo.ts stay the first choice: a component
 * that already renders Lao is left alone.
 */
export function LaoContent() {
  const { lang } = useLang();
  useEffect(() => {
    if (lang !== "lo") return;
    let stop: (() => void) | undefined, alive = true;
    void Promise.all([import("@/lib/i18n/dom-translator"), import("@/content/lao/segments.json")]).then(([{ DomTranslator }, data]) => {
      if (!alive) return;
      const dict = (data.default ?? data) as { segments: Record<string, string>; attrs: Record<string, string> };
      const t = new DomTranslator(dict.segments, dict.attrs, document.body);
      t.start();
      stop = () => t.stop();
    });
    return () => { alive = false; stop?.(); };
  }, [lang]);
  return null;
}

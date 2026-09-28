"use client";
import { clsx } from "clsx";
import { Fragment } from "react";
import { LANGS, useLang, type Lang } from "@/lib/i18n";

/* Each language is named in itself, whatever the page is currently showing. */
const NAME: Record<Lang, { short: string; full: string }> = { en: { short: "EN", full: "English" }, lo: { short: "ລາວ", full: "ພາສາລາວ" } };

/**
 * The compact EN | ລາວ switch. The choice is remembered on this device.
 * `className` goes on the wrapper, so the caller decides visibility
 * (hidden / md:block) while the switch itself stays one inline row.
 */
export function LangToggle({ className, tone = "ink" }: { className?: string; tone?: "ink" | "quiet" }) {
  const { lang, setLang, t } = useLang();
  const idle = tone === "quiet" ? "text-fog-500 hover:text-fog-50" : "text-fog-400 hover:text-fog-50";
  return (
    <div className={className}>
      <div role="group" aria-label={t("lang.label")} data-lang-toggle className="t-label inline-flex items-center">
        {LANGS.map((l, i) => (
          <Fragment key={l}>
            {i > 0 && <span aria-hidden className="text-fog-500">|</span>}
            <button
              type="button" lang={l} aria-pressed={lang === l} aria-label={NAME[l].full} onClick={() => setLang(l)}
              style={l === "lo" ? { fontFamily: "var(--font-notolao), sans-serif", letterSpacing: "0.02em" } : undefined}
              className={clsx("flex min-h-11 min-w-10 items-center justify-center px-2 transition-colors duration-200", lang === l ? "text-gold" : idle)}
            >
              {NAME[l].short}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

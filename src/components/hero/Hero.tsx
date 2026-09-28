"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Arrow, Button } from "@/components/ui/Button";
import { track } from "@/lib/backend/analytics";
import { GARMENTS, toSvgPath } from "@/lib/garments";
import type { Bilingual, HomeLink } from "@/content/types";
import { useLang, type Key } from "@/lib/i18n";
import { pickBilingual } from "@/lib/i18n/core";
import { PRINT_STYLES } from "./prints";

// The WebGL bundle is fetched only after first paint, and only on capable devices.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

type Tier = "pending" | "webgl" | "lite";

function detectTier(): Tier {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return "lite";
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
    if (nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? "")) return "lite";
    if ((nav.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 2) return "lite";
    return "webgl";
  } catch {
    return "lite";
  }
}

/** Headline overrides from CMS → Home page. An empty field keeps the translated default. */
export type HeroCopy = { eyebrow?: Bilingual; line1?: Bilingual; line2?: Bilingual; line3?: Bilingual; accent?: Bilingual; lede?: Bilingual };

export function Hero({ word = "SPP", styles = [], copy, primaryCta, secondaryCta }: {
  /** printed on the objects until the visitor types their own */
  word?: string;
  /** PRINT_STYLES names to cycle through; empty (or none recognised) = all of them */
  styles?: string[];
  copy?: HeroCopy;
  primaryCta?: HomeLink;
  /** no `href` = no second button */
  secondaryCta?: HomeLink;
}) {
  const router = useRouter();
  const { lang, t } = useLang();
  const say = (value: Bilingual | undefined, key: Key) => pickBilingual(value, lang)?.text ?? t(key);
  const stage = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [shown, setShown] = useState(word.trim().slice(0, 22) || "SPP");
  const cycle = useMemo(() => {
    const chosen = styles.map((name) => PRINT_STYLES.findIndex((s) => s.name === name)).filter((i) => i >= 0);
    return chosen.length ? chosen : PRINT_STYLES.map((_, i) => i);
  }, [styles]);
  const [step, setStep] = useState(0);
  const style = cycle[step % cycle.length] ?? 0;
  const [tier, setTier] = useState<Tier>("pending");
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [compact, setCompact] = useState(false);
  const touched = useRef(false);
  const section = useRef<HTMLElement>(null);

  // The glow layers behind the scene drift with the cursor (a few pixels, opposite to the 3D parallax).
  useEffect(() => {
    const el = section.current;
    if (!el || reduced) return;
    let raf = 0;
    const on = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", String(((e.clientX / window.innerWidth) * 2 - 1) * -28));
        el.style.setProperty("--my", String(((e.clientY / window.innerHeight) * 2 - 1) * -18));
      });
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => { window.removeEventListener("pointermove", on); cancelAnimationFrame(raf); };
  }, [reduced]);

  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqCompact = window.matchMedia("(max-width: 900px)");
    const sync = () => { setReduced(mqMotion.matches); setCompact(mqCompact.matches); };
    sync();
    mqMotion.addEventListener("change", sync);
    mqCompact.addEventListener("change", sync);
    // let text + CTA paint first; 3D is an enhancement, never a gate
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 250));
    const id = idle(() => setTier(detectTier()));
    return () => { mqMotion.removeEventListener("change", sync); mqCompact.removeEventListener("change", sync); (window.cancelIdleCallback ?? clearTimeout)(id as number); };
  }, []);

  // Stop rendering when the hero is off-screen or the tab is hidden.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let visible = true;
    const update = () => setActive(visible && !document.hidden);
    const io = new IntersectionObserver(([e]) => { visible = Boolean(e?.isIntersecting); update(); }, { threshold: 0.05 });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  // The word stays as set (or what the visitor types); the typeface and treatment change every few seconds.
  useEffect(() => {
    if (reduced || cycle.length < 2) return;
    const t = setInterval(() => setStep((i) => (i + 1) % cycle.length), 3400);
    return () => clearInterval(t);
  }, [reduced, cycle.length]);

  // Debounce texture repaints while typing.
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setShown(text), 90);
    return () => clearTimeout(t);
  }, [text]);

  const open = (e: FormEvent) => {
    e.preventDefault();
    track("customizer_started", { step: "hero" });
    // read the field itself: a name typed while the page was still loading is in the input before it is in state
    const typed = (e.currentTarget as HTMLFormElement).querySelector("input")?.value || text;
    const q = typed.trim() ? `?text=${encodeURIComponent(typed.trim().slice(0, 22))}` : "";
    router.push(`/design/${q}`);
  };

  return (
    <section ref={section} aria-labelledby="hero-title" className="theme-dark grain relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink-950 pt-[var(--nav-h)]">
      {/* atmosphere: sky top-right, gold behind the products, violet low-left — the brand trio, not one blue wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [transform:translate3d(calc(var(--mx,0)*1px),calc(var(--my,0)*1px),0)] transition-transform duration-700 ease-out">
        <div className="absolute -right-[8%] -top-[6%] h-[64vmin] w-[64vmin] rounded-full bg-sky/40 blur-[110px]" />
        <div className="absolute right-[14%] top-[34%] h-[50vmin] w-[50vmin] rounded-full bg-gold/25 blur-[120px]" />
        <div className="absolute -left-[12%] bottom-[-8%] h-[62vmin] w-[62vmin] rounded-full bg-violet/55 blur-[130px]" />
        <div className="absolute left-[38%] top-[58%] h-[36vmin] w-[36vmin] rounded-full bg-ultra/50 blur-[100px]" />
      </div>
      <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 right-0 -z-10 w-1/2 text-fog-50/[0.07] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]" />

      {/* 3D stage */}
      <div ref={stage} className="absolute inset-x-0 top-[var(--nav-h)] -z-[5] h-[62svh] lg:inset-y-0 lg:left-[36%] lg:top-0 lg:h-auto">
        {tier === "webgl" && <Scene text={shown} style={style} active={active} reducedMotion={reduced} compact={compact} />}
        {tier === "lite" && <LiteStage text={shown} style={style} />}
      </div>

      <div className="shell relative flex flex-1 flex-col justify-end gap-10 pb-10 pt-[58svh] lg:justify-center lg:pb-16 lg:pt-10">
        <div className="max-w-[58rem]">
          <p className="t-label mb-6 flex items-center gap-3 text-fog-400 [animation:register_.8s_var(--ease-press)_both]">
            <span aria-hidden className="reg text-yellow" />
            {say(copy?.eyebrow, "hero.eyebrow")}
          </p>
          <h1 id="hero-title" className="t-hero text-fog-50">
            <span className="block [animation:ink-in_.9s_var(--ease-sheet)_.05s_both]">{say(copy?.line1, "hero.line1")}</span>
            <span className="block [animation:ink-in_.9s_var(--ease-sheet)_.2s_both]">{say(copy?.line2, "hero.line2")}</span>
            <span className="block [animation:ink-in_.9s_var(--ease-sheet)_.35s_both]">
              {say(copy?.line3, "hero.line3")} <span className="t-feel text-yellow lowercase">{say(copy?.accent, "hero.line3accent")}</span>
            </span>
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,30rem)_1fr] lg:items-end">
          <div className="flex flex-col gap-6 [animation:register_.8s_var(--ease-press)_.55s_both]">
            <p className="t-lede max-w-xl">
              {say(copy?.lede, "hero.lede")}
            </p>

            <form onSubmit={open} className="crop group/f flex items-stretch border border-ink-500 bg-ink-900/80 backdrop-blur-sm transition-colors focus-within:border-yellow">
              <label htmlFor="hero-brand" className="sr-only">{t("hero.inputLabel")}</label>
              <input
                id="hero-brand"
                value={text}
                onChange={(e) => { touched.current = true; setText(e.target.value.slice(0, 22)); }}
                onFocus={() => { touched.current = true; }}
                placeholder={t("hero.placeholder")}
                autoComplete="off"
                spellCheck={false}
                maxLength={22}
                className="min-h-14 min-w-0 flex-1 bg-transparent px-5 font-display text-lg font-semibold tracking-tight text-fog-50 placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-fog-500 focus:outline-none"
              />
              <button type="submit" className="group/btn t-label flex items-center gap-3 bg-yellow px-5 text-ink-950 transition-colors hover:bg-fog-50">
                <span className="hidden xs:inline">{t("hero.design")}</span>
                <span className="xs:hidden">{t("hero.designShort")}</span>
                <Arrow />
              </button>
            </form>
            <p className="t-label -mt-2 text-fog-500" aria-live="polite">
              {text ? t("hero.hintTyped") : t("hero.hintStyle", { style: PRINT_STYLES[style]?.name ?? "Grotesque" })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end [animation:register_.8s_var(--ease-press)_.7s_both]">
            <Button href={primaryCta?.href || "/request-quote/"} size="lg" arrow>{say(primaryCta?.label, "common.startProject")}</Button>
            {(secondaryCta ? secondaryCta.href : "/services/") && <Button href={secondaryCta?.href || "/services/"} size="lg" variant="outline">{say(secondaryCta?.label, "common.exploreServices")}</Button>}
          </div>
        </div>
      </div>

      <div aria-hidden className="shell flex items-center justify-between border-t border-ink-700 py-4 text-fog-500">
        <span className="t-label">{t("hero.scroll")}</span>
        <span className="t-label hidden sm:block">{t("hero.path")}</span>
        <span className="t-label">Plate 00</span>
      </div>
    </section>
  );
}

/** No-WebGL / data-saver composition: same idea, a few kilobytes of SVG. */
function LiteStage({ text, style }: { text: string; style: number }) {
  const st = PRINT_STYLES[style % PRINT_STYLES.length] ?? PRINT_STYLES[0]!;
  const label = (st.upper ? (text.trim() || "SPP").toUpperCase() : text.trim() || "SPP").slice(0, 22);
  const face = `var(${st.font}), ${st.fallback}`;
  const size = Math.min(92, 760 / Math.max(label.length, 4));
  return (
    <svg viewBox="0 0 1200 1000" className="h-full w-full" role="img" aria-label={`A T-shirt and a billboard printed with “${label}”`} preserveAspectRatio="xMidYMid meet">
      <g transform="translate(60 40) rotate(-4)">
        <rect x="0" y="0" width="520" height="260" fill="#f5b81f" stroke="#161b45" strokeWidth="14" />
        <text x="260" y="150" textAnchor="middle" fontFamily={face} fontWeight={st.weight} fontStyle={st.italic ? "italic" : undefined} fontSize={Math.min(80, 440 / Math.max(label.length * 0.62, 3))} fill="#0b0e2c">{label}</text>
        <rect x="120" y="260" width="16" height="260" fill="#161b45" /><rect x="384" y="260" width="16" height="260" fill="#161b45" />
      </g>
      <g transform="translate(330 120) scale(0.78)">
        <path d={toSvgPath(GARMENTS.tee.sides[0]!.body)} fill="#eef1f8" />
        <text x="500" y="470" textAnchor="middle" fontFamily={face} fontWeight={st.weight} fontStyle={st.italic ? "italic" : undefined} fontSize={size} fill="#0b0e2c">{label}</text>
        <text x="500" y="560" textAnchor="middle" fontFamily="var(--font-serif)" fontStyle="italic" fontSize="54" fill="#0b0e2c">{st.tag}</text>
      </g>
    </svg>
  );
}

"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Arrow, Button } from "@/components/ui/Button";
import { track } from "@/lib/backend/analytics";
import { GARMENTS, toSvgPath } from "@/lib/garments";

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

const SUGGESTIONS = ["Riverside Café", "Mekong FC", "Lao Skyway", "Your brand"];

export function Hero() {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [shown, setShown] = useState("Your brand");
  const [tier, setTier] = useState<Tier>("pending");
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [compact, setCompact] = useState(false);
  const touched = useRef(false);

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

  // Until the visitor types, cycle example names so the idea demonstrates itself.
  useEffect(() => {
    if (text || reduced) return;
    let i = 0;
    const t = setInterval(() => { if (!touched.current) { i = (i + 1) % SUGGESTIONS.length; setShown(SUGGESTIONS[i]!); } }, 3200);
    return () => clearInterval(t);
  }, [text, reduced]);

  // Debounce texture repaints while typing.
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setShown(text), 90);
    return () => clearTimeout(t);
  }, [text]);

  const open = (e: FormEvent) => {
    e.preventDefault();
    track("customizer_started", { step: "hero" });
    const q = text.trim() ? `?text=${encodeURIComponent(text.trim().slice(0, 22))}` : "";
    router.push(`/design/${q}`);
  };

  return (
    <section aria-labelledby="hero-title" className="grain relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink-950 pt-[var(--nav-h)]">
      {/* atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-[10%] top-[8%] h-[70vmin] w-[70vmin] rounded-full bg-sky/15 blur-[120px]" />
        <div className="absolute -left-[15%] bottom-0 h-[60vmin] w-[60vmin] rounded-full bg-violet/30 blur-[140px]" />
        <div className="halftone absolute inset-y-0 right-0 w-1/2 text-fog-50/[0.06] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]" />
      </div>

      {/* 3D stage */}
      <div ref={stage} className="absolute inset-x-0 top-[var(--nav-h)] -z-[5] h-[62svh] lg:inset-y-0 lg:left-[36%] lg:top-0 lg:h-auto">
        {tier === "webgl" && <Scene text={shown} active={active} reducedMotion={reduced} compact={compact} />}
        {tier === "lite" && <LiteStage text={shown} />}
      </div>

      <div className="shell relative flex flex-1 flex-col justify-end gap-10 pb-10 pt-[58svh] lg:justify-center lg:pb-16 lg:pt-10">
        <div className="max-w-[58rem]">
          <p className="t-label mb-6 flex items-center gap-3 text-fog-400 [animation:register_.8s_var(--ease-press)_both]">
            <span aria-hidden className="reg text-yellow" />
            Creative production · Vientiane, Lao PDR
          </p>
          <h1 id="hero-title" className="t-hero text-fog-50">
            <span className="block [animation:ink-in_.9s_var(--ease-sheet)_.05s_both]">Design it.</span>
            <span className="block [animation:ink-in_.9s_var(--ease-sheet)_.2s_both]">Visualise it.</span>
            <span className="block [animation:ink-in_.9s_var(--ease-sheet)_.35s_both]">
              Make it <span className="t-feel text-yellow lowercase">real.</span>
            </span>
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,30rem)_1fr] lg:items-end">
          <div className="flex flex-col gap-6 [animation:register_.8s_var(--ease-press)_.55s_both]">
            <p className="t-lede max-w-xl">
              From custom clothing and printed materials to signage, outdoor advertising and complete brand campaigns — SPP turns ideas into physical experiences.
            </p>

            <form onSubmit={open} className="crop group/f flex items-stretch border border-ink-500 bg-ink-900/80 backdrop-blur-sm transition-colors focus-within:border-yellow">
              <label htmlFor="hero-brand" className="sr-only">Type your brand name to see it printed</label>
              <input
                id="hero-brand"
                value={text}
                onChange={(e) => { touched.current = true; setText(e.target.value.slice(0, 22)); }}
                onFocus={() => { touched.current = true; }}
                placeholder="Type your brand name…"
                autoComplete="off"
                spellCheck={false}
                maxLength={22}
                className="min-h-14 min-w-0 flex-1 bg-transparent px-5 font-display text-lg font-semibold tracking-tight text-fog-50 placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-fog-500 focus:outline-none"
              />
              <button type="submit" className="group/btn t-label flex items-center gap-3 bg-yellow px-5 text-ink-950 transition-colors hover:bg-fog-50">
                <span className="hidden xs:inline">Design something</span>
                <span className="xs:hidden">Design</span>
                <Arrow />
              </button>
            </form>
            <p className="t-label -mt-2 text-fog-500" aria-live="polite">
              {text ? "↑ Printed live on every object. Press enter to open it in SPP Studio." : "↑ Try it — watch it print on the shirt, the billboard, the cup."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end [animation:register_.8s_var(--ease-press)_.7s_both]">
            <Button href="/request-quote/" size="lg" arrow>Start a project</Button>
            <Button href="/services/" size="lg" variant="outline">Explore our services</Button>
          </div>
        </div>
      </div>

      <div aria-hidden className="shell flex items-center justify-between border-t border-ink-700 py-4 text-fog-500">
        <span className="t-label">Scroll</span>
        <span className="t-label hidden sm:block">Idea → Design → Visualise → Produce → Promote</span>
        <span className="t-label">Plate 00</span>
      </div>
    </section>
  );
}

/** No-WebGL / data-saver composition: same idea, a few kilobytes of SVG. */
function LiteStage({ text }: { text: string }) {
  const label = (text.trim() || "Your brand").toUpperCase().slice(0, 22);
  const size = Math.min(92, 760 / Math.max(label.length, 4));
  return (
    <svg viewBox="0 0 1200 1000" className="h-full w-full" role="img" aria-label={`A T-shirt and a billboard printed with “${label}”`} preserveAspectRatio="xMidYMid meet">
      <g transform="translate(60 40) rotate(-4)">
        <rect x="0" y="0" width="520" height="260" fill="#f5b81f" stroke="#161b45" strokeWidth="14" />
        <text x="260" y="150" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize={Math.min(80, 440 / Math.max(label.length * 0.62, 3))} fill="#0b0e2c">{label}</text>
        <rect x="120" y="260" width="16" height="260" fill="#161b45" /><rect x="384" y="260" width="16" height="260" fill="#161b45" />
      </g>
      <g transform="translate(330 120) scale(0.78)">
        <path d={toSvgPath(GARMENTS.tee.sides[0]!.body)} fill="#eef1f8" />
        <text x="500" y="470" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize={size} fill="#0b0e2c">{label}</text>
        <text x="500" y="560" textAnchor="middle" fontFamily="var(--font-serif)" fontStyle="italic" fontSize="54" fill="#0b0e2c">made real</text>
      </g>
    </svg>
  );
}

"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { HomeAnnouncement } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { pickBilingual } from "@/lib/i18n/core";
import { Arrow } from "@/components/ui/Button";

const STORE = "spp.announce";
const listeners = new Set<() => void>();
let memory: string | null = null; // closing still works for the visit when storage is blocked

const read = () => {
  if (memory) return memory;
  try { return sessionStorage.getItem(STORE) ?? ""; } catch { return ""; }
};
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
function dismiss(id: string) {
  memory = id;
  try { sessionStorage.setItem(STORE, id); } catch {}
  for (const l of listeners) l();
}

/** A short fingerprint of the message, so a NEW announcement shows again to someone who closed the last one. */
export function announcementId(a: Pick<HomeAnnouncement, "text" | "href">) {
  let h = 5381;
  for (const ch of `${a.text.en}|${a.text.lo}|${a.href}`) h = ((h << 5) + h + ch.codePointAt(0)!) >>> 0;
  return h.toString(36);
}

/**
 * The slim bar above the navigation on the landing page (CMS → Home page →
 * Announcement bar). It sits in the page flow; the fixed header is moved down
 * by exactly the visible part of the bar and returns to the top as the visitor
 * scrolls. Closing it lasts for the browser session. The tiny inline script
 * hides an already-closed bar before first paint, so it never flashes.
 */
export function AnnouncementBar({ announcement }: { announcement: HomeAnnouncement }) {
  const { lang, t } = useLang();
  const id = announcementId(announcement);
  const closed = useSyncExternalStore(subscribe, read, () => "") === id;
  const bar = useRef<HTMLDivElement>(null);
  const picked = pickBilingual(announcement.text, lang);
  const show = announcement.visible && picked !== null && !closed;

  useEffect(() => {
    const el = bar.current;
    const root = document.documentElement;
    if (!show || !el) return;
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => root.style.setProperty("--announce-gap", `${Math.max(0, Math.round(el.getBoundingClientRect().bottom))}px`));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); root.style.removeProperty("--announce-gap"); delete root.dataset.announce; };
  }, [show]);

  if (!show || !picked) return null;

  const message = <span lang={picked.lang === "lo" ? "lo" : undefined}>{picked.text}</span>;
  const external = announcement.href.startsWith("https://");
  const linkCls = "group/btn inline-flex min-h-11 items-center gap-3 py-2 underline decoration-current/40 underline-offset-4 hover:decoration-current";

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem(${JSON.stringify(STORE)})===${JSON.stringify(id)})document.documentElement.dataset.announce="off"}catch(e){}` }} />
      <style>{`html[data-announce="off"] [data-announcement]{display:none}html:not([data-announce="off"]) .theme-light>header{top:var(--announce-gap,2.75rem)}html:not([data-announce="off"]) #site-menu{padding-top:calc(var(--nav-h) + var(--announce-gap,2.75rem))}`}</style>
      <aside ref={bar} data-announcement aria-label={t("home.announce.label")} className={clsx("relative z-10", announcement.tone === "navy" ? "bg-navy text-white" : "on-gold text-ink-950")}>
        <div className="shell flex min-h-11 items-center justify-between gap-4">
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug sm:text-center">
            {announcement.href
              ? external
                ? <a href={announcement.href} target="_blank" rel="noopener noreferrer" className={linkCls}>{message}<Arrow /></a>
                : <Link href={announcement.href} className={linkCls}>{message}<Arrow /></Link>
              : <span className="inline-block py-2.5">{message}</span>}
          </p>
          <button type="button" onClick={() => dismiss(id)} aria-label={t("home.announce.dismiss")} className="-mr-3 flex h-11 w-11 flex-none items-center justify-center opacity-70 transition-opacity hover:opacity-100">
            <svg aria-hidden viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l12 12M13 1L1 13" /></svg>
          </button>
        </div>
      </aside>
    </>
  );
}

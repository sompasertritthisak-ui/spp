"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import type { SiteSettings } from "@/content/types";
import { Button } from "@/components/ui/Button";
import { primaryNav, secondaryNav } from "./nav-links";

export function Nav({ logo }: { logo?: SiteSettings["logo"] }) {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenAt((cur) => ((typeof v === "function" ? v(cur === path) : v) ? path : null));
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    const id = requestAnimationFrame(on);
    window.addEventListener("scroll", on, { passive: true });
    return () => { cancelAnimationFrame(id); window.removeEventListener("scroll", on); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("overflow-hidden", open);
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const active = (href: string) => path === href || (href !== "/" && path.startsWith(href));

  return (
    <>
      <header className={clsx("fixed inset-x-0 top-0 z-40 transition-[background,border-color,backdrop-filter] duration-300", scrolled || open ? "border-b border-ink-700 bg-ink-950/85 backdrop-blur-md" : "border-b border-transparent")}>
        <div className="shell flex h-[var(--nav-h)] items-center justify-between gap-6">
          <Link href="/" aria-label="SPP — home" className="flex items-center gap-3">
            <BrandMark logo={logo} className="h-8 sm:h-9" />
            <span aria-hidden className="t-label hidden text-fog-500 sm:block">Vientiane · Lao PDR</span>
          </Link>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {primaryNav.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} aria-current={active(l.href) ? "page" : undefined} className={clsx("t-label relative flex min-h-11 items-center px-3.5 transition-colors duration-200", active(l.href) ? "text-fog-50" : "text-fog-400 hover:text-fog-50")}>
                    {"accent" in l && <span aria-hidden className="mr-2 h-1.5 w-1.5 bg-yellow" />}
                    {l.label}
                    <span aria-hidden className={clsx("absolute inset-x-3.5 bottom-2 h-px origin-left bg-yellow transition-transform duration-300 ease-[var(--ease-press)]", active(l.href) ? "scale-x-100" : "scale-x-0")} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/account/" className="t-label hidden min-h-11 items-center px-3 text-fog-400 transition-colors hover:text-fog-50 md:flex">My SPP</Link>
            <Button href="/request-quote/" size="sm" arrow className="hidden sm:inline-flex">Start a project</Button>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu" className="relative flex h-11 w-11 items-center justify-center lg:hidden">
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              <span aria-hidden className={clsx("absolute h-px w-6 bg-fog-50 transition-transform duration-300", open ? "rotate-45" : "-translate-y-1.5")} />
              <span aria-hidden className={clsx("absolute h-px w-6 bg-fog-50 transition-transform duration-300", open ? "-rotate-45" : "translate-y-1.5")} />
            </button>
          </div>
        </div>
      </header>

      <div id="site-menu" hidden={!open} className="fixed inset-0 z-30 overflow-y-auto bg-ink-950 pt-[var(--nav-h)] lg:hidden">
        <nav aria-label="Mobile" className="shell flex min-h-full flex-col justify-between gap-10 py-8">
          <ul>
            {primaryNav.map((l, i) => (
              <li key={l.href} className="rule-b [animation:register_.5s_var(--ease-press)_both]" style={{ animationDelay: `${i * 40}ms` }}>
                <Link href={l.href} className="flex items-baseline justify-between py-4">
                  <span className="t-title">{l.label}</span>
                  <span className="t-label text-fog-500">0{i + 1}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-6">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
              {[...secondaryNav, { href: "/account/", label: "My SPP" }].map((l) => (
                <li key={l.href}><Link href={l.href} className="t-label flex min-h-11 items-center text-fog-400">{l.label}</Link></li>
              ))}
            </ul>
            <Button href="/request-quote/" size="lg" arrow className="w-full">Start a project</Button>
          </div>
        </nav>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

const LINKS = [
  { href: "/products/", label: "Products" },
  { href: "/spp-studio/", label: "SPP Studio" },
  { href: "/billboards/", label: "Billboards" },
  { href: "/portfolio/", label: "Selected work" },
  { href: "/contact/", label: "Contact" },
] as const;

/** Rendered outside the (site) group on purpose: no nav, no footer — a blank sheet with a way home. */
export default function NotFound() {
  return (
    <main id="main" className="grain relative isolate flex min-h-dvh flex-col overflow-hidden bg-ink-950">
      <div aria-hidden className="halftone pointer-events-none absolute inset-0 -z-10 text-fog-50/[0.05] [mask-image:radial-gradient(ellipse_at_70%_30%,black,transparent_65%)]" />
      <header className="shell flex items-center justify-between py-6">
        <Link href="/" aria-label="SPP — home" className="inline-flex min-h-11 items-center"><Logo className="h-7 w-auto" /></Link>
        <p className="t-label text-fog-500">Plate 404</p>
      </header>

      <div className="shell flex flex-1 flex-col justify-center py-16">
        <p className="t-label mb-8 flex items-center gap-3 text-fog-400"><span aria-hidden className="reg text-yellow" />Blank sheet — nothing on the press</p>
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <h1 className="t-display text-fog-50 [animation:ink-in_.9s_var(--ease-sheet)_both]">
              Looks like this page hasn’t been <span className="t-feel text-yellow">printed</span> yet.
            </h1>
            <p className="t-lede mt-7 max-w-xl">The address may be mistyped, or the page may have moved. Nothing is lost — start again from the front page.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/" size="lg" arrow>Back to home</Button>
              <Button href="/request-quote/" size="lg" variant="outline">Start a project</Button>
            </div>
          </div>
          {/* an empty, cropped sheet where the page should have been */}
          <div aria-hidden className="hidden lg:col-span-4 lg:block">
            <div className="crop ml-auto aspect-[3/4] w-full max-w-[16rem] border border-dashed border-ink-500 [--crop-color:var(--color-fog-500)]">
              <p className="t-data flex h-full items-center justify-center text-6xl font-medium tracking-[-0.05em] text-ink-600">404</p>
            </div>
          </div>
        </div>
      </div>

      <nav aria-label="Useful pages" className="shell border-t border-ink-700 py-5">
        <ul className="flex flex-wrap gap-x-8 gap-y-1">
          {LINKS.map((l) => (
            <li key={l.href}><Link href={l.href} className="t-label inline-flex min-h-11 items-center text-fog-400 transition-colors hover:text-yellow">{l.label}</Link></li>
          ))}
        </ul>
      </nav>
      <div aria-hidden className="colorbar" />
    </main>
  );
}

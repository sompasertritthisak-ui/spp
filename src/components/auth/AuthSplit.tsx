import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Plate } from "@/components/ui/Plate";
import { ValueLine } from "./ValueLine";

/** Standalone auth layout: brand plate on the left, the form on the right. */
export function AuthSplit({ plate, children }: { plate: string; children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="grid min-h-dvh flex-1 focus:outline-none lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="grain relative hidden overflow-hidden border-r border-ink-700 bg-ink-900 lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-20">
        <div aria-hidden className="halftone pointer-events-none absolute inset-y-0 right-0 w-1/2 text-ink-600 opacity-60" />
        <Link href="/" aria-label="SPP — home" className="relative inline-flex w-fit items-center gap-4">
          <Logo className="h-10" />
          <span className="t-label text-fog-500">My SPP</span>
        </Link>
        <div className="relative flex flex-col gap-8">
          <Plate n="00">Customer portal</Plate>
          <ValueLine />
        </div>
        <div className="relative flex flex-col gap-4">
          <div aria-hidden className="colorbar w-40" />
          <p className="t-label text-fog-500">Design · Visualise · Print · Promote</p>
        </div>
      </aside>

      <section className="flex flex-col">
        <header className="flex h-[var(--nav-h)] items-center justify-between border-b border-ink-700 px-5 sm:px-10 lg:border-b-0">
          <Link href="/" aria-label="SPP — home" className="flex min-h-11 items-center lg:invisible"><Logo className="h-[1.35rem]" /></Link>
          <Link href="/" className="t-label flex min-h-11 items-center text-fog-400 transition-colors hover:text-fog-50">Back to site</Link>
        </header>
        <div className="flex flex-1 items-start justify-center px-5 py-10 sm:px-10 lg:items-center lg:py-16">
          <div className="w-full max-w-md">
            <Plate className="mb-6">{plate}</Plate>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}

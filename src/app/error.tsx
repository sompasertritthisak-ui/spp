"use client";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

/** Route-level error boundary. The error itself is deliberately never rendered:
 *  visitors get a way forward, not a stack trace. `digest` is an opaque id that
 *  is safe to show and lets SPP match a report to a log line. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="grain relative isolate flex min-h-dvh flex-col overflow-hidden bg-ink-950">
      <header className="shell flex items-center justify-between py-6">
        <Link href="/" aria-label="SPP — home" className="inline-flex min-h-11 items-center"><Logo className="h-7 w-auto" /></Link>
        <p className="t-label text-fog-500">Press stopped</p>
      </header>

      <div className="shell flex flex-1 flex-col justify-center py-16" role="alert">
        <p className="t-label mb-8 flex items-center gap-3 text-fog-400"><span aria-hidden className="reg text-yellow" />Out of register</p>
        <h1 className="t-display max-w-5xl text-fog-50">
          Something went wrong behind the <span className="t-feel text-yellow">scenes.</span>
        </h1>
        <p className="t-lede mt-7 max-w-xl">It is not you, it is us. Try again — and if it keeps happening, the rest of the site is still working.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button size="lg" onClick={reset} arrow>Try again</Button>
          <Button href="/" size="lg" variant="outline">Back to home</Button>
          <Button href="/contact/" size="lg" variant="ghost">Let&rsquo;s talk</Button>
        </div>
        {error.digest && <p className="t-label mt-12 text-fog-500">Reference · {error.digest}</p>}
      </div>
      <div aria-hidden className="colorbar" />
    </main>
  );
}

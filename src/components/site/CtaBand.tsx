import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/** The closing conversion band. Every page ends on a contextual next step — never a dead end. */
export function CtaBand({ title, body, primary, secondary }: { title: ReactNode; body?: string; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <section className="relative isolate overflow-hidden bg-yellow text-ink-950">
      <div aria-hidden className="halftone absolute inset-0 -z-10 text-ink-950/10 [mask-image:linear-gradient(90deg,transparent,black)]" />
      <div className="shell grid gap-10 py-16 lg:grid-cols-[1fr_auto] lg:items-end lg:py-24">
        <div>
          <p className="t-label mb-5 flex items-center gap-3"><span aria-hidden className="reg" />Next step</p>
          <h2 className="t-display max-w-4xl">{title}</h2>
          {body && <p className="mt-5 max-w-xl text-lg text-ink-950/75">{body}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href={primary.href} variant="paper" size="lg" arrow>{primary.label}</Button>
          {secondary && <Button href={secondary.href} size="lg" className="border border-ink-950 !bg-transparent hover:!bg-ink-950 hover:!text-yellow">{secondary.label}</Button>}
        </div>
      </div>
    </section>
  );
}

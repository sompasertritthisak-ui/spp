"use client";
import { useEffect, useState } from "react";

/* Only things the portal genuinely does. No numbers, no promises about speed. */
const LINES: { lead: string; feel: string; rest: string }[] = [
  { lead: "Your designs and orders,", feel: "already", rest: "here when you come back." },
  { lead: "Reorder a past job and", feel: "only", rest: "change the quantities." },
  { lead: "Every quotation in writing. The decision stays", feel: "yours", rest: "." },
  { lead: "Your artwork stays", feel: "private", rest: "to you and the SPP team." },
];

export function ValueLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 6000);
    return () => clearInterval(t);
  }, []);
  const l = LINES[i] ?? LINES[0]!;
  return (
    <div className="min-h-[13rem] xl:min-h-[15rem]">
      <p key={i} className="t-display max-w-xl text-fog-50 [animation:register_.5s_var(--ease-press)_both]">
        {l.lead} <span className="t-feel text-yellow">{l.feel}</span>{l.rest === "." ? "." : ` ${l.rest}`}
      </p>
      <ol aria-hidden className="mt-8 flex gap-2">
        {LINES.map((_, n) => <li key={n} className={`h-px w-8 transition-colors duration-300 ${n === i ? "bg-yellow" : "bg-ink-500"}`} />)}
      </ol>
    </div>
  );
}

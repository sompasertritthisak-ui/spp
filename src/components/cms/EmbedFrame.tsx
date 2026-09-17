"use client";
import { useState } from "react";

/** Third-party content never loads on page view: the visitor clicks first. */
export function EmbedFrame({ src, title, provider, aspect }: { src: string; title: string; provider: string; aspect: "16:9" | "4:3" | "1:1" }) {
  const [on, setOn] = useState(false);
  const ratio = aspect === "4:3" ? "aspect-[4/3]" : aspect === "1:1" ? "aspect-square" : "aspect-video";
  return (
    <div className={`relative w-full overflow-hidden border border-ink-700 bg-ink-900 ${ratio}`}>
      {on ? (
        <iframe src={src} title={title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" className="absolute inset-0 h-full w-full" />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full border border-gold text-gold transition-transform duration-300 ease-[var(--ease-press)] group-hover:scale-110"><svg viewBox="0 0 12 14" className="ml-1 h-5 w-5" fill="currentColor"><path d="M0 0l12 7-12 7z" /></svg></span>
          <span className="t-heading text-fog-50">{title}</span>
          <span className="t-label text-fog-500">Loads content from {provider} · click to play</span>
        </button>
      )}
    </div>
  );
}

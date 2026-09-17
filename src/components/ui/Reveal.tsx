"use client";
import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** Registers content into place as it enters the viewport. CSS does the motion
 *  (and the reduced-motion / no-JS fallbacks); this only flips one attribute. */
export function Reveal({ children, as = "div", i = 0, className, style }: { children: ReactNode; as?: "div" | "section" | "li" | "article" | "p" | "h2" | "span"; i?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return void el.setAttribute("data-in", "");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          el.setAttribute("data-in", "");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return createElement(as, { ref, "data-reveal": "", className, style: { ...style, "--i": i } as CSSProperties }, children);
}

"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { track } from "@/lib/backend/analytics";
import { isDark } from "@/lib/garments";
import type { ProductLite } from "./lite";
import { ProductVisual } from "./ProductVisual";

type Ctx = { colour: string | null; setColour: (name: string) => void };
const ColourCtx = createContext<Ctx>({ colour: null, setColour: () => {} });

/** The colour NAME chosen on the product page; the estimate widget carries it into the quote. */
export const useProductColour = () => useContext(ColourCtx).colour;

export function ProductColourProvider({ initial, product, children }: { initial: string | null; product: string; children: ReactNode }) {
  const [colour, setColour] = useState(initial);
  useEffect(() => { track("product_view", { product }); }, [product]);
  const value = useMemo(() => ({ colour, setColour }), [colour]);
  return <ColourCtx.Provider value={value}>{children}</ColourCtx.Provider>;
}

/** The product "photograph": drawn garment (recoloured by the swatches) or the category glyph. */
export function ProductStage({ product: p, plate }: { product: ProductLite; plate: string }) {
  const { colour, setColour } = useContext(ColourCtx);
  const current = p.colours.find((c) => c.name === colour) ?? p.colours[0];
  return (
    <div>
      <div className="crop relative border border-gold/40 bg-ink-900">
        <div aria-hidden className="halftone absolute inset-0 text-gold/[0.12] [mask-image:radial-gradient(ellipse_at_50%_60%,black,transparent_75%)]" />
        <span className="t-label absolute left-4 top-4 text-gold">Plate {plate}</span>
        {current && p.garment && <span className="t-label absolute right-4 top-4 text-fog-300">{current.name}</span>}
        {p.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- CMS photo from Supabase Storage; static export has no image optimiser
          <img src={p.cover.url} alt={p.cover.alt || p.name} width={p.cover.width ?? undefined} height={p.cover.height ?? undefined} loading="eager" decoding="async" className="relative mx-auto aspect-square w-full max-w-[34rem] object-contain p-6 sm:p-10" />
        ) : (
          <ProductVisual garment={p.garment} colour={current?.hex} category={p.category} name={p.name} className="relative mx-auto aspect-square w-full max-w-[34rem] p-10 sm:p-14" glyphClassName="h-full w-full text-fog-300" />
        )}
        <div aria-hidden className="colorbar absolute inset-x-0 bottom-0 opacity-80" />
      </div>
      {p.gallery.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-px bg-ink-700" aria-label="Product photos">
          {p.gallery.slice(0, 8).map((m) => (
            <li key={m.url} className="bg-ink-900">
              {/* eslint-disable-next-line @next/next/no-img-element -- CMS gallery photo; static export */}
              <img src={m.url} alt={m.alt} width={m.width ?? undefined} height={m.height ?? undefined} loading="lazy" decoding="async" className="aspect-square h-full w-full object-cover" />
            </li>
          ))}
        </ul>
      )}
      {p.colours.length > 0 && (
        <fieldset className="mt-6">
          <legend className="t-label text-fog-400">Colour — <span className="text-fog-50">{current?.name}</span></legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.colours.map((c) => {
              const on = c.name === current?.name;
              return (
                <label key={c.name} className="relative cursor-pointer" title={c.name}>
                  <input type="radio" name="product-colour" className="peer sr-only" checked={on} onChange={() => setColour(c.name)} />
                  <span className={clsx("flex h-11 w-11 items-center justify-center border transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold", on ? "border-gold" : "border-ink-600 hover:border-gold/60")}>
                    <span className="flex h-8 w-8 items-center justify-center" style={{ background: c.hex }}>
                      {on && <svg aria-hidden viewBox="0 0 12 10" className="h-2.5 w-3" fill="none" stroke={isDark(c.hex) ? "#fff" : "#09090a"} strokeWidth="2"><path d="M1 5l3.5 3.5L11 1" /></svg>}
                    </span>
                  </span>
                  <span className="sr-only">{c.name}</span>
                </label>
              );
            })}
          </div>
          {!p.garment && <p className="mt-3 text-sm text-fog-500">Colours shown are a guide. We confirm against a physical swatch before production.</p>}
        </fieldset>
      )}
    </div>
  );
}

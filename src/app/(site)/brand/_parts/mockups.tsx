import type { ReactNode } from "react";
import type { GarmentKey } from "@/content/types";
import { BRAND } from "@/lib/brand";
import { GARMENT_BOX, getSide, isDark, shade, toSvgPath } from "@/lib/garments";
import { MarkG } from "./marks";

const MONO = "var(--font-jetbrains), monospace";
const DISPLAY = "var(--font-bricolage), sans-serif";
const SERIF = "var(--font-instrument), serif";

/** Same garment geometry SPP Studio uses, with the wordmark placed inside the real print area. */
function GarmentMock({ garment, side, colour, label, children }: { garment: GarmentKey; side: string; colour: string; label: string; children: ReactNode }) {
  const g = getSide(garment, side);
  const dark = isDark(colour);
  const seam = dark ? shade(colour, 0.22) : shade(colour, -0.2);
  const trim = dark ? shade(colour, 0.08) : shade(colour, -0.09);
  return (
    <svg viewBox={`0 0 ${GARMENT_BOX.w} ${GARMENT_BOX.h}`} role="img" aria-label={label} className="block h-auto w-full">
      <path d={toSvgPath(g.body)} fill={colour} stroke={seam} strokeWidth={3} strokeLinejoin="round" />
      {g.trims.map((d) => <path key={d} d={d} fill={trim} stroke={seam} strokeWidth={2.5} strokeLinejoin="round" />)}
      {g.seams.map((d) => <path key={d} d={d} fill="none" stroke={seam} strokeWidth={2.5} strokeLinecap="round" />)}
      {children}
    </svg>
  );
}

function Tile({ n, title, note, wide = false, ground = "bg-ink-900", children }: { n: string; title: string; note: string; wide?: boolean; ground?: string; children: ReactNode }) {
  return (
    <li className={`flex flex-col bg-ink-950 ${wide ? "sm:col-span-2" : ""}`}>
      <div className={`flex flex-1 items-center justify-center overflow-hidden ${ground} ${wide ? "p-0" : "p-6 sm:p-10"}`}>{children}</div>
      <div className="flex items-baseline gap-4 border-t border-ink-700 p-5">
        <span className="t-data text-xs text-fog-500">{n}</span>
        <div>
          <h3 className="t-label text-fog-50">{title}</h3>
          <p className="mt-2 text-base text-fog-400">{note}</p>
        </div>
      </div>
    </li>
  );
}

export function Mockups({ email, city }: { email: string; city: string }) {
  return (
    <ul className="grid gap-px border border-ink-700 bg-ink-700 sm:grid-cols-2">
      <Tile n="01" title="T-shirt" note="White wordmark with the gold dot on SPP Navy, centred in the front print area. Screen print or DTF.">
        <GarmentMock garment="tee" side="front" colour={BRAND.navy} label="Navy T-shirt with the SPP wordmark across the chest">
          <MarkG transform="translate(338 330) scale(1.5)" />
        </GarmentMock>
      </Tile>
      <Tile n="02" title="Polo shirt" note="Indigo wordmark at left chest, 90 mm wide. Embroidery." ground="bg-ink-800">
        <GarmentMock garment="polo" side="front" colour={BRAND.garmentWhite} label="White polo shirt with a small SPP wordmark on the left chest">
          <MarkG stroke="var(--color-ink-900)" transform="translate(566 392) scale(.5)" />
        </GarmentMock>
      </Tile>
      <Tile n="03" title="Cap" note="Mono indigo wordmark on gold. Flat embroidery on the front panel." ground="bg-ink-800">
        <GarmentMock garment="cap" side="panel" colour={BRAND.gold} label="Gold cap with a midnight-indigo SPP wordmark on the front panel">
          <MarkG stroke="var(--color-ink-950)" dot="var(--color-ink-950)" transform="translate(381 372) scale(1.1)" />
        </GarmentMock>
      </Tile>
      <Tile n="04" title="Tote bag" note="Mono wordmark with the tagline. Single-colour screen print in midnight indigo on white canvas.">
        <GarmentMock garment="tote" side="front" colour={BRAND.garmentWhite} label="White tote bag with the SPP wordmark and tagline">
          <MarkG stroke="var(--color-ink-900)" dot="var(--color-ink-900)" transform="translate(338 590) scale(1.5)" />
          <text x="500" y="830" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="56" fill="var(--color-ink-900)">make it real.</text>
        </GarmentMock>
      </Tile>

      <Tile n="05" title="Billboard" note="Gold face, indigo wordmark, seven words or fewer. On gold, the dot takes the indigo of the strokes." wide>
        <svg viewBox="0 0 1200 560" role="img" aria-label="Roadside billboard with a gold face carrying the SPP wordmark and tagline" className="block h-auto w-full">
          <rect width="1200" height="560" fill="var(--color-ink-900)" />
          <g fill="var(--color-ink-850)" stroke="var(--color-ink-700)"><path d="M0 470V420H70V380H150V430H230V400H300V470Z" /><path d="M900 470V410H960V370H1040V425H1120V395H1200V470Z" /></g>
          <path d="M0 470H1200" stroke="var(--color-ink-600)" /><path d="M0 520H1200" stroke="var(--color-ink-600)" strokeDasharray="40 30" />
          <g fill="var(--color-ink-800)" stroke="var(--color-ink-600)"><rect x="430" y="330" width="22" height="140" /><rect x="748" y="330" width="22" height="140" /><rect x="250" y="316" width="700" height="14" /></g>
          <rect x="262" y="52" width="676" height="264" fill="var(--color-ink-950)" stroke="var(--color-ink-500)" />
          <rect x="272" y="62" width="656" height="244" fill="var(--color-gold)" />
          <MarkG stroke="var(--color-ink-950)" dot="var(--color-ink-950)" transform="translate(312 104) scale(1.6)" />
          <text x="690" y="170" fontFamily={DISPLAY} fontWeight="800" fontSize="44" letterSpacing="-1.5" fill="var(--color-ink-950)">Design it.</text>
          <text x="690" y="216" fontFamily={DISPLAY} fontWeight="800" fontSize="44" letterSpacing="-1.5" fill="var(--color-ink-950)">Visualise it.</text>
          <text x="690" y="262" fontFamily={SERIF} fontStyle="italic" fontSize="50" fill="var(--color-ink-950)">Make it real.</text>
          <g stroke="var(--color-fog-500)" strokeWidth="2" fill="none">{[340, 500, 660, 820].map((x) => <path key={x} d={`M${x} 52V28H${x + 22}`} />)}</g>
        </svg>
      </Tile>

      <Tile n="06" title="Business card" note="Indigo front with the wordmark alone; white back with details in mono. 90 × 54 mm." ground="bg-ink-800">
        <svg viewBox="0 0 600 440" role="img" aria-label="SPP business card, front and back" className="block h-auto w-full">
          <g transform="rotate(-6 300 220)">
            <rect x="150" y="150" width="360" height="216" fill="var(--color-paper)" />
            <MarkG stroke="var(--color-ink-900)" transform="translate(178 176) scale(.3)" />
            <g fontFamily={MONO} fontSize="11" letterSpacing="1.4" fill="var(--color-ink-900)">
              <text x="178" y="268" fontFamily={DISPLAY} fontWeight="700" fontSize="22" letterSpacing="-.4">Your Name</text>
              <text x="178" y="290" fill="var(--color-paper-mute)">POSITION</text>
              <text x="178" y="326">{email.toUpperCase()}</text>
              <text x="178" y="344" fill="var(--color-paper-mute)">{city.toUpperCase()}</text>
            </g>
            <rect x="150" y="360" width="360" height="6" fill="var(--color-gold)" />
          </g>
          <g transform="rotate(4 300 220)">
            <rect x="70" y="60" width="360" height="216" fill="var(--color-ink-950)" stroke="var(--color-ink-600)" />
            <MarkG transform="translate(163 128) scale(.8)" />
          </g>
        </svg>
      </Tile>

      <Tile n="07" title="Vehicle side" note="Wordmark on the cargo panel, gold sill band, contact line in mono. Cut vinyl." ground="bg-ink-800">
        <svg viewBox="0 0 600 440" role="img" aria-label="Side view of a delivery van with the SPP wordmark on the cargo panel" className="block h-auto w-full">
          <path d="M20 352H580" stroke="var(--color-ink-600)" />
          <path d="M60 330V150Q60 130 80 130H400Q420 130 432 146L486 220H520Q548 224 552 256V330Z" fill="var(--color-ink-850)" stroke="var(--color-ink-500)" strokeWidth="2" />
          <path d="M60 296H552V330H60Z" fill="var(--color-gold)" />
          <path d="M404 152H420L468 220H404Z" fill="var(--color-ink-700)" stroke="var(--color-ink-500)" />
          <path d="M392 140V296" stroke="var(--color-ink-600)" strokeWidth="2" />
          <MarkG transform="translate(104 170) scale(1.05)" />
          <text x="104" y="320" fontFamily={MONO} fontSize="11" letterSpacing="1.6" fill="var(--color-ink-950)">{email.toUpperCase()} · DESIGN · PRINT · OUTDOOR</text>
          {[150, 462].map((cx) => (
            <g key={cx}><circle cx={cx} cy="334" r="34" fill="var(--color-ink-950)" stroke="var(--color-ink-500)" strokeWidth="2" /><circle cx={cx} cy="334" r="14" fill="var(--color-ink-800)" stroke="var(--color-ink-500)" /></g>
          ))}
        </svg>
      </Tile>
    </ul>
  );
}

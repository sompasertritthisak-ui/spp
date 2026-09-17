import type { ReactNode } from "react";

const ORNAMENTS: { name: string; rule: string; demo: ReactNode }[] = [
  { name: "Crop marks", rule: "Frame ONE hero object per view — a mockup, a form, a cover. They mean “this is the finished piece”.", demo: <div className="crop h-16 w-28 border border-ink-600 bg-ink-800 [--crop-color:var(--color-fog-400)]" /> },
  { name: "Registration target", rule: "Opens every eyebrow label and plate marker. Gold on indigo; indigo on white and on gold.", demo: <span className="reg h-10 w-10 text-yellow" /> },
  { name: "Plate number", rule: "Sections are numbered like press plates. Numbers run in order down the page and are never decorative.", demo: <p className="t-label flex items-center gap-3 text-fog-400"><span className="reg text-yellow" /><span className="text-fog-50">Plate 04</span><span className="h-px w-6 bg-current opacity-40" />Studio</p> },
  { name: "Halftone", rule: "A quiet dot field at 5–10% opacity, always masked to fade out. Atmosphere, never pattern.", demo: <div className="halftone h-20 w-full text-fog-50/40 [mask-image:linear-gradient(90deg,black,transparent)]" /> },
  { name: "Colour bar", rule: "The only place process cyan and magenta appear at all. A 6 px strip at the edge of a section — once per page.", demo: <div className="colorbar w-full" /> },
  { name: "Hairline rules", rule: "1 px lines build every list and table. Depth comes from rules and tone steps — never shadows, never rounded cards.", demo: <div className="w-full"><div className="border-t border-fog-50" /><div className="mt-3 border-t border-ink-600" /><div className="mt-3 border-t border-ink-600" /></div> },
];

export function Ornaments() {
  return (
    <ul className="grid gap-px border border-ink-700 bg-ink-700 sm:grid-cols-2 lg:grid-cols-3">
      {ORNAMENTS.map((o) => (
        <li key={o.name} className="flex flex-col bg-ink-950">
          <div aria-hidden className="flex h-44 items-center justify-center overflow-hidden bg-ink-900 px-10">{o.demo}</div>
          <div className="p-5 sm:p-6">
            <h3 className="t-heading text-fog-50">{o.name}</h3>
            <p className="mt-2 text-base leading-relaxed text-fog-400">{o.rule}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const CTAS = ["Start a project", "Design something", "Open SPP Studio", "Customise this", "Build my project", "Request a quote", "Get an estimate", "Explore billboards", "Request this location", "Let’s talk", "Upload artwork", "Visualise it", "Save design", "Download mockup", "Reorder", "View case study"];

const PAIRS: [string, string, string][] = [
  ["Request this location", "Book now", "A billboard request is not a booking until SPP confirms it."],
  ["Get an estimate", "See the price", "On-site figures are a guide. The written quote is the price."],
  ["Looks like this page hasn’t been printed yet.", "Error 404", "Even the dead ends sound like a print shop."],
  ["Sample project", "Trusted by leading brands", "We never borrow credibility we have not earned."],
  ["Automated preflight checks are advisory.", "Your file is approved!", "A person at SPP signs off every file."],
];

export function Voice() {
  return (
    <div className="grid gap-x-16 gap-y-14 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <h3 className="t-heading text-paper-ink">Calls to action</h3>
        <p className="mt-3 max-w-[44ch] text-base leading-relaxed text-paper-mute">Buttons are verbs in the customer’s voice, set in mono capitals. They say exactly what happens next — no “Submit”, no “Learn more”.</p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {CTAS.map((c, i) => (
            <li key={c} className={`t-label inline-flex min-h-9 items-center border px-3 ${i === 0 ? "border-paper-ink bg-paper-ink text-paper" : "border-paper-ink text-paper-ink"}`}>{c}</li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-7">
        <h3 className="t-heading text-paper-ink">We say / we don’t say</h3>
        <div className="mt-6 border-b border-paper-ink">
          {PAIRS.map(([yes, no, why]) => (
            <div key={yes} className="grid gap-x-8 gap-y-2 border-t border-paper-ink py-5 sm:grid-cols-2">
              <p className="text-lg font-semibold text-paper-ink"><span className="t-label mr-3 text-paper-mute">Say</span>{yes}</p>
              <p className="text-lg text-paper-mute line-through decoration-1"><span className="t-label mr-3 inline-block no-underline">Not</span>{no}</p>
              <p className="text-base text-paper-mute sm:col-span-2">{why}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

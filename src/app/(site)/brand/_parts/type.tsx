const FACES = [
  {
    name: "Bricolage Grotesque", role: "Display", cls: "font-display font-extrabold [font-stretch:85%] tracking-[-0.04em]", sample: "Make it real.",
    spec: ["Headlines, titles, oversized numerals", "Weight 600–800 · width 80–88%", "Tracking −1.5% to −4.5% · leading 0.86–1.15", "Sentence case or uppercase — never title case"],
  },
  {
    name: "Instrument Serif Italic", role: "Feeling", cls: "font-serif italic", sample: "real.",
    spec: ["ONE feeling-word inside a headline", "Always italic, always lowercase", "Never for body text, labels or buttons", "Often the only yellow word on the page"],
  },
  {
    name: "Geist", role: "Body", cls: "font-sans", sample: "What you approve on screen is what gets made.",
    spec: ["Paragraphs, descriptions, form text", "16 px minimum on public pages", "Leading 1.5–1.75 · measure ≤ 68 characters", "Regular for text, 600 for emphasis"],
  },
  {
    name: "JetBrains Mono", role: "Label & data", cls: "font-mono uppercase tracking-[0.14em]", sample: "Plate 03 — Visualise",
    spec: ["Eyebrows, labels, meta, buttons, plate numbers", "11 px · uppercase · tracking +14%", "Tabular figures for prices, sizes and counts", "The voice of the job ticket"],
  },
] as const;

export function TypeSpecimens() {
  return (
    <ol className="border-b border-ink-700">
      {FACES.map((f, i) => (
        <li key={f.name} className="grid gap-x-12 gap-y-6 border-t border-ink-700 py-10 lg:grid-cols-12 lg:py-14">
          <div className="lg:col-span-3">
            <p className="t-label text-yellow">{String(i + 1).padStart(2, "0")} — {f.role}</p>
            <h3 className="t-heading mt-3 text-fog-50">{f.name}</h3>
            <ul className="mt-5 space-y-2 text-base text-fog-400">
              {f.spec.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div className="min-w-0 lg:col-span-9">
            <p aria-hidden className={`${f.cls} ${i === 3 ? "text-[clamp(1.25rem,3.4vw,3rem)]" : i === 2 ? "text-[clamp(1.5rem,3.6vw,3.25rem)] leading-tight" : "text-[clamp(3.5rem,11vw,10rem)] leading-[0.9]"} break-words text-fog-50`}>
              {f.sample}
            </p>
            <p aria-hidden className={`${f.cls.replace("uppercase", "")} mt-8 break-all text-xl leading-relaxed text-fog-500 tracking-normal!`}>
              ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 &amp;?!₭$
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Hierarchy() {
  return (
    <div className="crop border border-ink-700 bg-ink-900 p-6 sm:p-10">
      <p className="t-label flex items-center gap-3 text-fog-400"><span aria-hidden className="reg text-yellow" />Plate 03 — Example</p>
      <p className="t-display mt-6 text-fog-50">See it before it is <span className="t-feel text-yellow">real.</span></p>
      <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-fog-300">Four faces, four jobs. The grotesque shouts, the serif feels, the sans explains and the mono keeps the records. They never swap roles.</p>
      <p className="t-label mt-8 inline-flex min-h-11 items-center bg-yellow px-5 text-ink-950">Open SPP Studio</p>
    </div>
  );
}

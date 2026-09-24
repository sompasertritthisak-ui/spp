"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { FormError, Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Plate";
import type { BundleLite, ProductLite } from "@/components/catalogue/lite";
import { leadLabel } from "@/components/catalogue/lite";
import { Chip, QtyStepper, Segmented } from "@/components/forms/controls";
import { isIsoDate, todayIso } from "@/components/forms/validation";
import type { Category, Solution } from "@/content/types";
import { recordIntent, track } from "@/lib/backend/analytics";
import { formatDate, formatNumber } from "@/lib/format";
import { ItemQtyRow } from "./ItemQtyRow";
import { AUDIENCES, buildPlan, EMPTY_ANSWERS, MATERIALS, OTHER_GOAL, recommendedProducts, type Answers } from "./project-logic";
import { useStartQuote } from "./useStartQuote";

const STORE = "spp.projectBuilder";
const STEPS = [
  { key: "what", q: "What are you building?" },
  { key: "goal", q: "What is the goal?" },
  { key: "audience", q: "Who is it for?" },
  { key: "scale", q: "How many people or pieces?" },
  { key: "when", q: "When do you need it?" },
  { key: "materials", q: "What do you already have?" },
  { key: "design", q: "Do you need design help?" },
  { key: "interests", q: "Which products interest you?" },
  { key: "summary", q: "Your project, summarised" },
] as const;
const LAST = STEPS.length - 1;

type Saved = { step: number; answers: Answers; qty: Record<string, number> };

function load(preset: string): Saved {
  let saved: Saved = { step: 0, answers: EMPTY_ANSWERS, qty: {} };
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Saved>;
      if (v.answers && typeof v.step === "number") saved = { step: Math.min(Math.max(0, v.step), LAST), answers: { ...EMPTY_ANSWERS, ...v.answers }, qty: v.qty ?? {} };
    }
  } catch {}
  return preset ? { ...saved, answers: { ...saved.answers, goalSlug: preset } } : saved;
}

type Props = { products: ProductLite[]; categories: Category[]; solutions: Solution[]; bundles: BundleLite[]; services: { slug: string; name: string; products: string[] }[]; presetGoal: string };

export function ProjectBuilder({ products, categories, solutions, bundles, services, presetGoal }: Props) {
  const startQuote = useStartQuote();
  const [init] = useState(() => load(presetGoal));
  const [step, setStep] = useState(init.step);
  const [a, setA] = useState<Answers>(() => {
    const sol = solutions.find((s) => s.slug === init.answers.goalSlug);
    return sol && !init.answers.productsTouched && init.answers.products.length === 0 ? { ...init.answers, products: recommendedProducts(sol) } : init.answers;
  });
  const [qty, setQty] = useState(init.qty);
  const [error, setError] = useState<string | null>(null);
  const [seenPreset, setSeenPreset] = useState(presetGoal);
  const headRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(init.step > 0);

  const chooseGoal = (slug: string) => setA((p) => ({ ...p, goalSlug: slug, products: p.productsTouched ? p.products : recommendedProducts(solutions.find((s) => s.slug === slug)) }));
  // A goal picked in the explorer above flows into the builder, even mid-way.
  if (presetGoal !== seenPreset) {
    setSeenPreset(presetGoal);
    if (presetGoal) chooseGoal(presetGoal);
  }

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ step, answers: a, qty } satisfies Saved)); } catch {}
  }, [step, a, qty]);

  const plan = buildPlan(a, { products, solutions, bundles, services });
  const items = plan.items.map((i) => ({ ...i, qty: qty[i.product] ?? i.qty }));
  const current = STEPS[step]!;

  function check(): string | null {
    switch (current.key) {
      case "what": return a.name.trim().length >= 2 ? null : "Give the project a name — anything that helps us talk about it.";
      case "goal": return a.goalSlug && (a.goalSlug !== OTHER_GOAL || a.goalText.trim().length >= 3) ? null : a.goalSlug ? "Tell us the goal in a few words." : "Choose the closest goal.";
      case "scale": return a.headcount >= 1 ? null : "Enter a number of at least 1.";
      case "when": return a.noDate || (isIsoDate(a.neededBy) && a.neededBy >= todayIso()) ? null : "Choose a date — or tell us there is no fixed date.";
      case "design": return a.designHelp ? null : "Choose one — 'not sure' is a fine answer.";
      case "interests": return a.products.length > 0 ? null : "Choose at least one product to include.";
      default: return null;
    }
  }

  function go(to: number) {
    setError(null);
    setStep(to);
    recordIntent("project_builder", STEPS[to]!.key);
    if (to === LAST) track("project_builder_completed", { step: a.goalSlug || undefined });
    requestAnimationFrame(() => headRef.current?.focus());
  }
  function next() {
    const problem = check();
    if (problem) return setError(problem);
    if (!started.current) { started.current = true; track("project_builder_started"); }
    go(Math.min(step + 1, LAST));
  }
  const restart = () => { setA({ ...EMPTY_ANSWERS }); setQty({}); go(0); };

  const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));
  const solution = solutions.find((s) => s.slug === a.goalSlug);

  return (
    <div className="border border-gold/40 bg-ink-950">
      <div className="border-b border-gold/25 p-5 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="t-label text-fog-400">Step <span className="text-gold">{String(step + 1).padStart(2, "0")}</span> of {String(STEPS.length).padStart(2, "0")}</p>
          {step > 0 && <button type="button" onClick={restart} className="t-label min-h-11 text-fog-500 hover:text-fog-50">Start again</button>}
        </div>
        <ol aria-hidden className="mt-3 grid grid-cols-9 gap-1">
          {STEPS.map((s, i) => <li key={s.key} className={clsx("h-1 transition-colors duration-300", i < step ? "bg-gold/50" : i === step ? "bg-gold" : "bg-ink-700")} />)}
        </ol>
      </div>

      <div className="p-5 sm:p-8 lg:p-12">
        <h3 ref={headRef} tabIndex={-1} className="t-title text-fog-50 focus:outline-none">{current.q}</h3>
        <div className="mt-8 flex max-w-3xl flex-col gap-6">
          {current.key === "what" && (
            <Input label="Project name" required maxLength={160} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="e.g. Café opening, 2027 staff uniforms, school sports day" hint="A working title is enough." />
          )}

          {current.key === "goal" && (
            <>
              <ul className="rule-t">
                {[...solutions.map((s) => ({ slug: s.slug, goal: s.goal, prompt: s.prompt })), { slug: OTHER_GOAL, goal: "Something else", prompt: "None of these quite fit." }].map((s) => (
                  <li key={s.slug} className="rule-b">
                    <label className="flex min-h-14 cursor-pointer items-center gap-4 py-2">
                      <input type="radio" name="pb-goal" className="peer sr-only" checked={a.goalSlug === s.slug} onChange={() => chooseGoal(s.slug)} />
                      <span aria-hidden className="h-3 w-3 flex-none border border-ink-500 peer-checked:border-yellow peer-checked:bg-yellow" />
                      <span className="flex-1 text-lg text-fog-100 peer-checked:text-yellow peer-focus-visible:underline">{s.goal}</span>
                      <span className="hidden text-sm text-fog-500 sm:block">{s.prompt}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {a.goalSlug === OTHER_GOAL && <Input label="In your words" required maxLength={300} value={a.goalText} onChange={(e) => setA({ ...a, goalText: e.target.value })} placeholder="What should this project achieve?" />}
            </>
          )}

          {current.key === "audience" && (
            <fieldset>
              <legend className="mb-4 text-fog-300">Choose any that apply — it shapes fabric, sizing and finish. Optional.</legend>
              <div className="flex flex-wrap gap-2">{AUDIENCES.map((v) => <Chip key={v} checked={a.audience.includes(v)} onChange={(on) => setA({ ...a, audience: toggle(a.audience, v, on) })}>{v}</Chip>)}</div>
            </fieldset>
          )}

          {current.key === "scale" && (
            <>
              <QtyStepper label="People or pieces" value={a.headcount} onChange={(headcount) => setA({ ...a, headcount })} max={1_000_000} />
              <div className="flex flex-wrap gap-2">
                {[10, 25, 50, 100, 250, 500, 1000].map((n) => (
                  <button key={n} type="button" aria-pressed={a.headcount === n} onClick={() => setA({ ...a, headcount: n })} className={clsx("t-data min-h-11 border px-4 text-sm transition-colors", a.headcount === n ? "border-yellow text-yellow" : "border-ink-600 text-fog-300 hover:border-ink-500 hover:text-fog-50")}>{formatNumber(n)}</button>
                ))}
              </div>
              <p className="text-fog-400">A rough number is fine. It sets the starting quantities; you can change every line later.</p>
            </>
          )}

          {current.key === "when" && (
            <>
              <Input label="Needed by" type="date" min={todayIso()} disabled={a.noDate} value={a.noDate ? "" : a.neededBy} onChange={(e) => setA({ ...a, neededBy: e.target.value })} />
              <Chip checked={a.noDate} onChange={(noDate) => setA({ ...a, noDate })}>No fixed date yet</Chip>
            </>
          )}

          {current.key === "materials" && (
            <fieldset>
              <legend className="mb-4 text-fog-300">Tell us what exists today. Optional.</legend>
              <div className="flex flex-wrap gap-2">
                {MATERIALS.map((m) => (
                  <Chip key={m.key} checked={a.materials.includes(m.key)} onChange={(on) => setA({ ...a, materials: m.key === "nothing" ? (on ? ["nothing"] : []) : toggle(a.materials.filter((x) => x !== "nothing"), m.key, on) })}>{m.label}</Chip>
                ))}
              </div>
            </fieldset>
          )}

          {current.key === "design" && (
            <Segmented label="Should SPP design or adapt the artwork?" value={a.designHelp || null} onChange={(designHelp) => setA({ ...a, designHelp })} options={[{ value: "yes", label: "Yes please" }, { value: "no", label: "No, artwork is ready" }, { value: "unsure", label: "Not sure" }] as const} />
          )}

          {current.key === "interests" && (
            <>
              {solution && <p className="text-fog-300">We have ticked what usually goes with <span className="text-fog-50">{solution.goal}</span>. Add or remove anything.</p>}
              {categories.map((c) => {
                const list = products.filter((p) => p.category === c.slug);
                if (list.length === 0) return null;
                return (
                  <fieldset key={c.slug}>
                    <legend className="t-label mb-3 text-fog-500">{c.plate} · {c.name}</legend>
                    <div className="flex flex-wrap gap-2">
                      {list.map((p) => <Chip key={p.slug} checked={a.products.includes(p.slug)} onChange={(on) => setA({ ...a, productsTouched: true, products: toggle(a.products, p.slug, on) })}>{p.name}</Chip>)}
                    </div>
                  </fieldset>
                );
              })}
            </>
          )}
        </div>

        {current.key === "summary" && (
          <div className="mt-2 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <div>
              <p className="text-lg text-fog-300"><span className="text-fog-50">{plan.brief.name}</span> — {plan.brief.goal}{plan.brief.audience && `, for ${plan.brief.audience.toLowerCase()}`}, around {formatNumber(a.headcount)} {a.headcount === 1 ? "person or piece" : "people or pieces"}.</p>
              <h4 className="t-label mt-10 text-fog-400">Recommended products — edit the quantities</h4>
              <ul className="mt-3 rule-t">
                {items.map((i) => {
                  const p = plan.chosen.find((x) => x.slug === i.product);
                  return p ? <ItemQtyRow key={p.slug} product={p} qty={i.qty} note={leadLabel(p.leadTimeDays)} onQty={(n) => setQty({ ...qty, [p.slug]: n })} /> : null;
                })}
              </ul>
              {plan.brief.services.length > 0 && (
                <>
                  <h4 className="t-label mt-10 text-fog-400">Recommended services</h4>
                  <ul className="mt-3 flex flex-wrap gap-2">{plan.brief.services.map((s) => <li key={s}><Badge>{services.find((x) => x.slug === s)?.name ?? s}</Badge></li>)}</ul>
                </>
              )}
              {plan.bundle && (
                <p className="mt-10 border border-gold/40 bg-gold/5 p-4 text-fog-100">
                  <span className="t-label mb-1 block text-gold">Suggested bundle</span>
                  {plan.bundle.name} — {plan.bundle.discountPct}% bundle saving. {plan.bundleComplete ? "Your selection includes everything in it, so the saving is noted on your request." : `Add ${plan.bundle.items.filter((i) => !a.products.includes(i.product)).map((i) => products.find((p) => p.slug === i.product)?.name ?? i.product).join(", ")} to qualify.`}
                </p>
              )}
            </div>
            <dl className="rule-t self-start">
              <div className="rule-b py-5">
                <dt className="t-label text-fog-400">Estimated complexity</dt>
                <dd className="mt-2"><span className="t-heading uppercase text-yellow">{plan.brief.complexity}</span><ul className="mt-2 flex flex-col gap-1 text-sm text-fog-300">{plan.brief.complexityReasons.map((r) => <li key={r}>— {r}</li>)}</ul></dd>
              </div>
              <div className="rule-b py-5">
                <dt className="t-label text-fog-400">Potential timeline</dt>
                <dd className="mt-2 text-fog-100">
                  {plan.brief.timelineDays ? <>{plan.brief.timelineDays[0]}–{plan.brief.timelineDays[1]} working days of production after artwork approval, set by the slowest item.</> : "Scheduled with your quote."}
                  {!a.noDate && a.neededBy && <span className="mt-1 block text-sm text-fog-300">Needed by {formatDate(a.neededBy)}. {plan.deadlineNote}</span>}
                </dd>
              </div>
              <div className="rule-b py-5">
                <dt className="t-label text-fog-400">Artwork checklist</dt>
                <dd className="mt-2"><ul className="flex flex-col gap-1.5 text-fog-100">{plan.brief.artworkChecklist.map((r) => <li key={r} className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none border border-fog-400" />{r}</li>)}</ul></dd>
              </div>
              <div className="rule-b py-5">
                <dt className="t-label text-fog-400">What the quote will need</dt>
                <dd className="mt-2"><ul className="flex flex-col gap-1.5 text-fog-300">{plan.requirements.map((r) => <li key={r}>— {r}</li>)}</ul></dd>
              </div>
            </dl>
          </div>
        )}

        <div aria-live="polite" className="mt-8 max-w-3xl"><FormError message={error} /></div>
        <div className="mt-8 flex flex-wrap gap-3">
          {step > 0 && <Button variant="outline" onClick={() => go(step - 1)}>Back</Button>}
          {step < LAST && <Button arrow onClick={next}>{step === LAST - 1 ? "See my project summary" : "Continue"}</Button>}
          {step === LAST && (
            <Button size="lg" arrow disabled={items.length === 0} onClick={() => startQuote({
              v: 1, kind: "project", source: "project_builder", items, neededBy: a.noDate ? undefined : a.neededBy || undefined,
              needsDesignHelp: a.designHelp !== "no", project: plan.brief, bundle: plan.bundleComplete ? plan.bundle?.slug : undefined,
            })}>Request project quote</Button>
          )}
        </div>
        {step === LAST && <p className="mt-4 text-sm text-fog-500">Everything above travels with you to the quote form — you only add your contact details.</p>}
      </div>
    </div>
  );
}

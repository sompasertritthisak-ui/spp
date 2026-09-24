"use client";
import { clsx } from "clsx";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/backend/analytics";
import { useAuth } from "@/lib/backend/auth";
import { BackendError } from "@/lib/backend/client";
import { askJarvis, type JarvisAction, type JarvisContext, type JarvisMessage, type JarvisMode } from "@/lib/jarvis";

/**
 * JARVIS — SPP's production expert, as a chat. Used on the Request-a-quote page
 * and inside SPP Studio. Jarvis answers and SUGGESTS; every action is a button
 * the customer presses. He cannot order, price, approve, book or contact anyone.
 */
export type ActionLabel = (a: JarvisAction) => string | null;

const QUICK: Record<JarvisMode, string[]> = {
  quote: [
    "I need 50 staff polos with our logo — what should I choose?",
    "Screen print or DTF for a full-colour design?",
    "Which billboard suits a café launch in Vientiane?",
    "How do I prepare my logo file for printing?",
  ],
  studio: [
    "Which print method suits this design?",
    "How big should a left-chest logo be?",
    "Will white ink work on this colour?",
    "Lay this out for me: a bold festival shirt",
  ],
};

const HELLO: Record<JarvisMode, string> = {
  quote: "Hello, I'm Jarvis, SPP's production expert. Tell me what you're making, how many and by when, and I'll recommend the right product, print method and quantities — and add them to your request for you to review.",
  studio: "Hello, I'm Jarvis. Ask me anything about printing this design: methods, ink colours, sizes, artwork quality. If you like, I can brief the layout engine to draft something on the garment.",
};

export function JarvisPanel({ mode, context, onAction, actionLabel, className, compact = false }: { mode: JarvisMode; context: () => JarvisContext; onAction: (a: JarvisAction) => void; actionLabel: ActionLabel; className?: string; compact?: boolean }) {
  const auth = useAuth();
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [replies, setReplies] = useState<Record<number, { actions: JarvisAction[]; followUps: string[]; applied: Set<number> }>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages.length, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (content.length < 2 || busy) return;
    const next: JarvisMessage[] = [...messages, { role: "user", content }];
    setMessages(next); setDraft(""); setError(null); setBusy(true);
    try {
      await auth.ensureSession(); // guest sessions count; usage is rate-limited per person
      const r = await askJarvis(mode, next, context());
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
      setReplies((rs) => ({ ...rs, [next.length]: { actions: r.actions, followUps: r.followUps, applied: new Set() } }));
      track("jarvis_used", { source: mode });
    } catch (e) {
      setError(e instanceof BackendError ? e.message : "Jarvis is not available right now.");
      setMessages(next.slice(0, -1));
      setDraft(content);
    } finally { setBusy(false); }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } };

  if (!auth.configured)
    return (
      <div className={clsx("border border-gold/40 bg-ink-900 p-4", className)}>
        {!compact && <JarvisTitle />}
        <p className={clsx("text-sm text-fog-300", !compact && "mt-3")}>Jarvis is not switched on yet. Everything else on this page works without him.</p>
      </div>
    );

  const showIntro = messages.length === 0;
  return (
    <div className={clsx("flex min-h-0 flex-col", className)}>
      {!compact && <JarvisTitle />}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Conversation with Jarvis">
        <Bubble who="jarvis">{HELLO[mode]}</Bubble>
        {showIntro && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {QUICK[mode].map((q) => <button key={q} type="button" onClick={() => void send(q)} className="min-h-9 border border-gold/40 px-2.5 text-left text-xs text-fog-200 transition-colors hover:border-gold hover:bg-gold hover:text-ink-950">{q}</button>)}
          </div>
        )}
        {messages.map((m, i) => {
          const r = m.role === "assistant" ? replies[i] : undefined;
          return (
            <div key={i}>
              <Bubble who={m.role === "user" ? "you" : "jarvis"}>{m.content}</Bubble>
              {r && r.actions.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5 pl-8">
                  {r.actions.map((a, j) => {
                    const label = actionLabel(a);
                    if (!label) return null;
                    const done = r.applied.has(j);
                    return (
                      <button key={j} type="button" disabled={done} onClick={() => { onAction(a); setReplies((rs) => { const cur = rs[i]; if (!cur) return rs; const applied = new Set(cur.applied); applied.add(j); return { ...rs, [i]: { ...cur, applied } }; }); }}
                        className={clsx("t-label min-h-9 border px-3 text-[0.625rem] transition-colors", done ? "border-ok/50 text-ok" : "border-gold bg-gold text-ink-950 hover:bg-fog-50")}>
                        {done ? "✓ " : "+ "}{label}
                      </button>
                    );
                  })}
                </div>
              )}
              {r && r.followUps.length > 0 && i === messages.length - 1 && !busy && (
                <div className="mb-3 flex flex-wrap gap-1.5 pl-8">
                  {r.followUps.map((f) => <button key={f} type="button" onClick={() => void send(f)} className="min-h-8 border border-ink-600 px-2.5 text-left text-xs text-fog-300 hover:border-gold hover:text-gold">{f}</button>)}
                </div>
              )}
            </div>
          );
        })}
        {busy && <Bubble who="jarvis"><span className="inline-flex gap-1" aria-label="Jarvis is thinking"><Dot /><Dot d="150ms" /><Dot d="300ms" /></span></Bubble>}
        {error && <p role="alert" className="mb-3 border border-danger/40 bg-danger/10 p-3 text-sm text-fog-50">{error}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(draft); }} className="mt-2 flex items-end gap-2 border-t border-gold/25 pt-3">
        <label htmlFor={`jarvis-${mode}`} className="sr-only">Ask Jarvis</label>
        <textarea id={`jarvis-${mode}`} rows={2} maxLength={1500} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={mode === "quote" ? "e.g. 120 event shirts for Pi Mai, 2 colours, needed in 3 weeks" : "Ask about printing this design…"}
          className="min-h-11 w-full resize-none border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-50 placeholder:text-fog-500 focus:border-gold focus:outline-none" />
        <Button type="submit" size="sm" loading={busy} disabled={draft.trim().length < 2}>Send</Button>
      </form>
      <p className="mt-2 text-[0.6875rem] leading-snug text-fog-500">Jarvis suggests; you decide. Prices he mentions are estimates — SPP&rsquo;s written quote is the firm one. He never orders, books or contacts anyone.</p>
    </div>
  );
}

export function JarvisTitle({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <JarvisMark />
      <div>
        <p className="t-label text-fog-50">Jarvis</p>
        <p className="text-xs text-fog-400">SPP&rsquo;s production expert · AI</p>
      </div>
    </div>
  );
}

export function JarvisMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={clsx("flex h-9 w-9 flex-none items-center justify-center bg-gold font-display text-base font-extrabold text-ink-950", className)}>J</span>
  );
}

function Bubble({ who, children }: { who: "you" | "jarvis"; children: React.ReactNode }) {
  return (
    <div className={clsx("mb-3 flex gap-2", who === "you" ? "justify-end" : "items-start")}>
      {who === "jarvis" && <span aria-hidden className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center bg-gold font-display text-xs font-extrabold text-ink-950">J</span>}
      <div className={clsx("max-w-[88%] whitespace-pre-line px-3 py-2 text-sm leading-relaxed", who === "you" ? "border border-ink-600 bg-ink-800 text-fog-50" : "border border-gold/30 bg-ink-900 text-fog-100")}>
        <span className="sr-only">{who === "you" ? "You: " : "Jarvis: "}</span>{children}
      </div>
    </div>
  );
}

function Dot({ d = "0ms" }: { d?: string }) {
  return <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gold" style={{ animationDelay: d }} />;
}

"use client";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

export const MIN_PASSWORD = 10;

/** Guidance, not a gate: length is the only hard rule (Supabase enforces its own minimum too). */
export function passwordStrength(pw: string, avoid: string[] = []): { score: 0 | 1 | 2 | 3 | 4; label: string; tip: string } {
  if (!pw) return { score: 0, label: "Not set", tip: `Use at least ${MIN_PASSWORD} characters. A short sentence works well.` };
  if (pw.length < MIN_PASSWORD) return { score: 1, label: "Too short", tip: `${MIN_PASSWORD - pw.length} more character${MIN_PASSWORD - pw.length === 1 ? "" : "s"} needed.` };
  const lower = pw.toLowerCase();
  if (avoid.some((a) => a.length >= 4 && lower.includes(a.toLowerCase()))) return { score: 1, label: "Guessable", tip: "Avoid using your name or email address in the password." };
  if (/^(.)\1+$/.test(pw) || /^(0123456789|1234567890|abcdefghij|qwertyuiop)/i.test(pw)) return { score: 1, label: "Guessable", tip: "Avoid repeated characters and keyboard runs." };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const points = (pw.length >= 14 ? 2 : 1) + (kinds >= 3 ? 1 : 0) + (pw.length >= 18 || kinds === 4 ? 1 : 0);
  if (points >= 4) return { score: 4, label: "Strong", tip: "Good. Keep it unique to SPP." };
  if (points === 3) return { score: 3, label: "Good", tip: "Good. A few more characters would make it stronger." };
  return { score: 2, label: "Fair", tip: "Meets the minimum. Add length, or mix in numbers and symbols." };
}

type Props = {
  label: string; value: string; onChange: (v: string) => void; autoComplete: "current-password" | "new-password";
  error?: string; name?: string; strength?: boolean; avoid?: string[]; hint?: string;
};

/** Password input with a show/hide toggle and optional strength guidance. Matches the Field look. */
export function PasswordField({ label, value, onChange, autoComplete, error, name = "password", strength = false, avoid, hint }: Props) {
  const id = useId();
  const [show, setShow] = useState(false);
  const s = strength ? passwordStrength(value, avoid) : null;
  const describedBy = [error ? `${id}-err` : null, s ? `${id}-str` : hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="t-label text-fog-400">{label}<span aria-hidden className="ml-1 text-yellow">*</span></label>
      <div className="relative">
        <input
          id={id} name={name} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} required
          autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={128}
          aria-invalid={Boolean(error)} aria-describedby={describedBy}
          className="min-h-12 w-full border border-ink-600 bg-ink-900 pl-4 pr-14 text-base text-fog-50 placeholder:text-fog-500 transition-colors duration-150 hover:border-ink-500 focus:border-yellow focus:outline-none aria-[invalid=true]:border-danger"
        />
        <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-fog-400 transition-colors hover:text-fog-50">
          {show ? <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.5} /> : <Eye aria-hidden className="h-4 w-4" strokeWidth={1.5} />}
        </button>
      </div>
      {s && (
        <div id={`${id}-str`} className="flex flex-col gap-2">
          <div aria-hidden className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((n) => <span key={n} className={`h-0.5 ${n <= s.score ? (s.score <= 1 ? "bg-danger" : s.score === 2 ? "bg-warn" : "bg-ok") : "bg-ink-600"}`} />)}
          </div>
          <p className="text-sm text-fog-500"><span className="t-label mr-2 text-fog-300">{s.label}</span>{s.tip}</p>
        </div>
      )}
      {!s && hint && !error && <p id={`${id}-hint`} className="text-sm text-fog-500">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="flex items-start gap-2 text-sm text-danger"><span aria-hidden>▲</span>{error}</p>}
    </div>
  );
}

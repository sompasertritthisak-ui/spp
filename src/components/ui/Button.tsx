import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "paper" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-3 whitespace-nowrap font-mono uppercase tracking-[0.12em] transition-[background,color,border-color,transform] duration-200 ease-[var(--ease-press)] active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-yellow text-ink-950 hover:bg-fog-50",
  outline: "border border-ink-500 text-fog-50 hover:border-yellow hover:text-yellow",
  ghost: "text-fog-300 hover:text-fog-50 hover:bg-ink-800",
  paper: "bg-paper-ink text-paper hover:bg-ultra",
  danger: "border border-danger/60 text-danger hover:bg-danger hover:text-ink-950",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-[0.6875rem]",
  md: "min-h-11 px-5 text-xs",
  lg: "min-h-14 px-7 text-[0.8125rem]",
};

export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 10" aria-hidden className={clsx("h-2.5 w-5 flex-none transition-transform duration-300 ease-[var(--ease-press)] group-hover/btn:translate-x-1", className)} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M0 5h18M14 1l4 4-4 4" />
    </svg>
  );
}

type Common = { variant?: Variant; size?: Size; arrow?: boolean; loading?: boolean; children: ReactNode; className?: string };
type AsLink = Common & { href: string; external?: boolean } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
type AsButton = Common & { href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">;

export function Button(props: AsLink | AsButton) {
  const { variant = "primary", size = "md", arrow = false, loading = false, children, className, ...rest } = props;
  const cls = clsx(base, variants[variant], sizes[size], className);
  const inner = (
    <>
      {loading && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />}
      <span>{children}</span>
      {arrow && !loading && <Arrow />}
    </>
  );
  if ("href" in rest && rest.href !== undefined) {
    const { href, external, ...linkRest } = rest as AsLink;
    if (external || /^(https?:|mailto:|tel:)/.test(href))
      return (
        <a href={href} className={cls} onClick={linkRest.onClick} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>
          {inner}
        </a>
      );
    return (
      <Link href={href} className={cls} {...linkRest}>
        {inner}
      </Link>
    );
  }
  const { type = "button", disabled, ...btnRest } = rest as AsButton;
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...btnRest}>
      {inner}
    </button>
  );
}

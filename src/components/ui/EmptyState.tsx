import type { ReactNode } from "react";

export function EmptyState({ title = "Nothing here yet.", body = "Your next project could start here.", action }: { title?: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-gold/40 p-8 sm:p-12">
      <span aria-hidden className="reg h-6 w-6 text-gold" />
      <p className="t-heading uppercase text-fog-50">{title}</p>
      <p className="max-w-md text-fog-400">{body}</p>
      {action}
    </div>
  );
}

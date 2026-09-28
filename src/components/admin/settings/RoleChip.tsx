import { clsx } from "clsx";

/** A role as the super admin named it. Colour is decoration: the name is always shown. */
export function RoleChip({ name, colour, rank, className }: { name: string; colour?: string | null; rank?: number | null; className?: string }) {
  return (
    <span className={clsx("t-label inline-flex max-w-full items-center gap-1.5 border border-ink-500 px-2 py-1 text-[0.625rem] whitespace-nowrap text-fog-100", className)}>
      <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-fog-500" style={colour ? { backgroundColor: colour } : undefined} />
      <span className="truncate">{name}</span>
      {rank != null && <span className="t-data text-fog-500">{rank}</span>}
    </span>
  );
}

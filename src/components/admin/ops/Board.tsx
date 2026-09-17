"use client";
import { clsx } from "clsx";
import { useState, type ReactNode } from "react";

export type BoardColumn<S extends string> = { key: S; label: string };

/**
 * Kanban board. Two equivalent ways to move a card: HTML5 drag-and-drop, and a
 * "Move to…" select on every card (keyboard, touch, screen readers).
 * Scrolls horizontally inside its own container; the page never does.
 */
export function Board<T extends { id: string }, S extends string>({ columns, items, statusOf, onMove, renderCard, columnMeta, canMove = true, loading = false, label, emptyHint = "Nothing here." }: {
  columns: readonly BoardColumn<S>[]; items: T[] | null; statusOf: (item: T) => S; onMove: (item: T, to: S) => void; renderCard: (item: T) => ReactNode;
  columnMeta?: (key: S, items: T[]) => ReactNode; canMove?: boolean; loading?: boolean; label: string; emptyHint?: string;
}) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<S | null>(null);

  return (
    <div role="group" aria-label={label} className="thin-scroll -mx-4 overflow-x-auto px-4 pb-3 lg:-mx-6 lg:px-6">
      <div className="flex min-w-max gap-3">
        {columns.map((col) => {
          const mine = items?.filter((i) => statusOf(i) === col.key) ?? [];
          return (
            <section
              key={col.key} aria-label={`${col.label}, ${mine.length}`}
              onDragOver={canMove ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col.key) setOver(col.key); } : undefined}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
              onDrop={(e) => {
                e.preventDefault(); setOver(null); setDrag(null);
                const item = items?.find((i) => i.id === e.dataTransfer.getData("text/plain"));
                if (item && statusOf(item) !== col.key) onMove(item, col.key);
              }}
              className={clsx("flex w-[17.5rem] flex-none flex-col border bg-ink-900 transition-colors", over === col.key ? "border-yellow" : "border-ink-700")}
            >
              <header className="border-b border-ink-700 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2"><h2 className="t-label text-fog-100">{col.label}</h2><span className="t-data text-sm text-fog-400">{mine.length}</span></div>
                {columnMeta && <div className="t-data mt-1 text-xs text-fog-500">{columnMeta(col.key, mine)}</div>}
              </header>
              <ul className="thin-scroll flex max-h-[68vh] min-h-24 flex-col gap-2 overflow-y-auto p-2">
                {loading && !items && [0, 1, 2].map((i) => <li key={i} className="skeleton h-20" />)}
                {mine.map((item) => (
                  <li
                    key={item.id} draggable={canMove}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; setDrag(item.id); }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    className={clsx("border border-ink-700 bg-ink-850 transition-opacity", canMove && "cursor-grab active:cursor-grabbing", drag === item.id && "opacity-40")}
                  >
                    {renderCard(item)}
                    {canMove && (
                      <label className="flex items-center gap-2 border-t border-ink-700 px-3 py-1.5">
                        <span className="t-label text-[0.5625rem] text-fog-500">Move to</span>
                        <select value={col.key} onChange={(e) => onMove(item, e.target.value as S)} className="min-h-8 flex-1 border border-ink-600 bg-ink-950 px-1.5 text-xs text-fog-100 focus:border-yellow focus:outline-none">
                          {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </label>
                    )}
                  </li>
                ))}
                {items && mine.length === 0 && <li className="px-2 py-6 text-center text-xs text-fog-500">{emptyHint}</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

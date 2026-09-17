import type { GarmentKey } from "@/content/types";
import { newLayerId, type DesignDoc, type Layer, type Sides } from "./schema";

/**
 * Editor state as a pure reducer, so every change is replayable and undoable.
 * History stores {colour, sides} snapshots. Continuous gestures (drag, resize,
 * rotate, slider scrubs) call `checkpoint` once at the start and then send
 * `transient` updates, so one gesture = one undo step.
 */
export type Snapshot = { colour: string; sides: Sides };
export type Remote = { id: string; ref: string; version: number; status: string };

export type StudioState = {
  doc: DesignDoc;
  name: string;
  side: string;
  selectedId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  remote: Remote | null;
  templateSlug: string | null;
};

export type Action =
  | { type: "load"; doc: DesignDoc; name?: string; remote?: Remote | null; side?: string; templateSlug?: string | null }
  | { type: "setProduct"; productSlug: string; garment: GarmentKey; sideKeys: string[]; colour?: string }
  | { type: "setColour"; colour: string; transient?: boolean }
  | { type: "setSize"; size: string | undefined }
  | { type: "setSide"; side: string }
  | { type: "select"; id: string | null }
  | { type: "checkpoint" }
  | { type: "add"; layer: Layer; side?: string }
  | { type: "addMany"; layers: Layer[]; side?: string; replace?: boolean }
  | { type: "update"; id: string; patch: Partial<Layer>; transient?: boolean }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "reorder"; id: string; to: "up" | "down" | "top" | "bottom" }
  | { type: "applyTemplate"; sides: Sides; colour?: string; slug: string }
  | { type: "clearSide" }
  | { type: "rename"; name: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved"; remote: Remote; doc?: DesignDoc };

const HISTORY = 60;
const snap = (s: StudioState): Snapshot => ({ colour: s.doc.colour, sides: s.doc.sides });
const push = (s: StudioState): Pick<StudioState, "past" | "future"> => ({ past: [...s.past.slice(-(HISTORY - 1)), snap(s)], future: [] });
const layersOf = (s: StudioState, side = s.side) => s.doc.sides[side] ?? [];
const withLayers = (s: StudioState, side: string, layers: Layer[]): DesignDoc => ({ ...s.doc, sides: { ...s.doc.sides, [side]: layers } });

export function initialState(doc: DesignDoc, side: string): StudioState {
  return { doc, name: "Untitled design", side, selectedId: null, past: [], future: [], dirty: false, remote: null, templateSlug: null };
}

export function reducer(s: StudioState, a: Action): StudioState {
  switch (a.type) {
    case "load":
      return { ...initialState(a.doc, a.side ?? Object.keys(a.doc.sides)[0] ?? "front"), name: a.name ?? "Untitled design", remote: a.remote ?? null, templateSlug: a.templateSlug ?? null };

    case "setProduct": {
      // Keep artwork for sides the new garment also has; park the rest so switching back restores it.
      const first = a.sideKeys[0] ?? "front";
      return { ...s, ...push(s), doc: { ...s.doc, productSlug: a.productSlug, garment: a.garment, colour: a.colour ?? s.doc.colour, size: undefined }, side: a.sideKeys.includes(s.side) ? s.side : first, selectedId: null, dirty: true };
    }
    case "setColour":
      return { ...s, ...(a.transient ? {} : push(s)), doc: { ...s.doc, colour: a.colour }, dirty: true };
    case "setSize":
      return { ...s, doc: { ...s.doc, size: a.size }, dirty: true };
    case "setSide":
      return { ...s, side: a.side, selectedId: null };
    case "select":
      return s.selectedId === a.id ? s : { ...s, selectedId: a.id };
    case "checkpoint":
      return { ...s, ...push(s) };

    case "add": {
      const side = a.side ?? s.side;
      return { ...s, ...push(s), doc: withLayers(s, side, [...layersOf(s, side), a.layer]), side, selectedId: a.layer.id, dirty: true };
    }
    case "addMany": {
      const side = a.side ?? s.side;
      const next = a.replace ? a.layers : [...layersOf(s, side), ...a.layers];
      return { ...s, ...push(s), doc: withLayers(s, side, next.slice(0, 60)), side, selectedId: a.layers.at(-1)?.id ?? null, dirty: true };
    }
    case "update": {
      const layers = layersOf(s);
      if (!layers.some((l) => l.id === a.id)) return s;
      return { ...s, ...(a.transient ? {} : push(s)), doc: withLayers(s, s.side, layers.map((l) => (l.id === a.id ? ({ ...l, ...a.patch } as Layer) : l))), dirty: true };
    }
    case "remove": {
      const layers = layersOf(s);
      if (!layers.some((l) => l.id === a.id)) return s;
      return { ...s, ...push(s), doc: withLayers(s, s.side, layers.filter((l) => l.id !== a.id)), selectedId: s.selectedId === a.id ? null : s.selectedId, dirty: true };
    }
    case "duplicate": {
      const layers = layersOf(s);
      const src = layers.find((l) => l.id === a.id);
      if (!src || layers.length >= 60) return s;
      const copy = { ...src, id: newLayerId(), x: src.x + 30, y: src.y + 30, locked: false } as Layer;
      const i = layers.indexOf(src);
      return { ...s, ...push(s), doc: withLayers(s, s.side, [...layers.slice(0, i + 1), copy, ...layers.slice(i + 1)]), selectedId: copy.id, dirty: true };
    }
    case "reorder": {
      const layers = [...layersOf(s)];
      const i = layers.findIndex((l) => l.id === a.id);
      if (i < 0) return s;
      const j = a.to === "top" ? layers.length - 1 : a.to === "bottom" ? 0 : a.to === "up" ? Math.min(i + 1, layers.length - 1) : Math.max(i - 1, 0);
      if (i === j) return s;
      const [l] = layers.splice(i, 1);
      layers.splice(j, 0, l!);
      return { ...s, ...push(s), doc: withLayers(s, s.side, layers), dirty: true };
    }
    case "applyTemplate":
      return { ...s, ...push(s), doc: { ...s.doc, colour: a.colour ?? s.doc.colour, sides: { ...s.doc.sides, ...a.sides } }, selectedId: null, templateSlug: a.slug, dirty: true };
    case "clearSide":
      return layersOf(s).length ? { ...s, ...push(s), doc: withLayers(s, s.side, []), selectedId: null, dirty: true } : s;
    case "rename":
      return { ...s, name: a.name.slice(0, 80), dirty: true };

    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return { ...s, past: s.past.slice(0, -1), future: [snap(s), ...s.future].slice(0, HISTORY), doc: { ...s.doc, ...prev }, selectedId: null, dirty: true };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return { ...s, past: [...s.past, snap(s)].slice(-HISTORY), future: s.future.slice(1), doc: { ...s.doc, ...next }, selectedId: null, dirty: true };
    }
    case "saved":
      // keep undo history; only swap in the doc whose image layers now carry their storage asset ids
      return { ...s, doc: a.doc ?? s.doc, remote: a.remote, dirty: false };
  }
}

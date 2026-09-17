import type { ShapeKey } from "./schema";

/** SVG path for a shape of w × h centred on the origin. `ring` and `line` are drawn specially by renderers via `shapeMeta`. */
export function shapePath(shape: ShapeKey, w: number, h: number): string {
  const x = w / 2, y = h / 2;
  switch (shape) {
    case "rect":
    case "line":
      return `M${-x} ${-y}H${x}V${y}H${-x}Z`;
    case "circle":
      return `M${-x} 0A${x} ${y} 0 1 0 ${x} 0A${x} ${y} 0 1 0 ${-x} 0Z`;
    case "ring": {
      const t = Math.max(Math.min(w, h) * 0.07, 2), ix = x - t, iy = y - t;
      return `M${-x} 0A${x} ${y} 0 1 0 ${x} 0A${x} ${y} 0 1 0 ${-x} 0ZM${-ix} 0A${ix} ${iy} 0 1 1 ${ix} 0A${ix} ${iy} 0 1 1 ${-ix} 0Z`;
    }
    case "triangle":
      return `M0 ${-y}L${x} ${y}L${-x} ${y}Z`;
    case "star":
      return polar(10, (i) => (i % 2 ? 0.42 : 1), x, y);
    case "burst":
      return polar(32, (i) => (i % 2 ? 0.86 : 1), x, y);
    case "shield":
      return `M${-x} ${-y}H${x}V${y * 0.15}C${x} ${y * 0.7} ${x * 0.35} ${y * 0.92} 0 ${y}C${-x * 0.35} ${y * 0.92} ${-x} ${y * 0.7} ${-x} ${y * 0.15}Z`;
    case "badge":
      return `M${-x} ${-y * 0.6}L${-x * 0.72} ${-y}H${x * 0.72}L${x} ${-y * 0.6}V${y * 0.6}L${x * 0.72} ${y}H${-x * 0.72}L${-x} ${y * 0.6}Z`;
  }
}

function polar(points: number, radius: (i: number) => number, rx: number, ry: number) {
  let d = "";
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2, r = radius(i);
    d += `${i ? "L" : "M"}${(Math.cos(a) * rx * r).toFixed(2)} ${(Math.sin(a) * ry * r).toFixed(2)}`;
  }
  return `${d}Z`;
}

export const SHAPE_LABEL: Record<ShapeKey, string> = { rect: "Rectangle", circle: "Circle", ring: "Ring", triangle: "Triangle", star: "Star", burst: "Burst", shield: "Shield", badge: "Badge", line: "Line" };

/**
 * Studio element library — original single-colour marks drawn on a 100 × 100
 * box centred at the origin (−50…50). Recolourable, scalable, print-safe.
 */
export const GRAPHICS: Record<string, { label: string; group: "Marks" | "Food & Drink" | "Sport" | "Nature" | "Laos"; d: string }> = {
  reg: { label: "Registration", group: "Marks", d: "M-4 -50h8v18a32 32 0 0 1 28 28h18v8h-18a32 32 0 0 1 -28 28v18h-8v-18a32 32 0 0 1 -28 -28h-18v-8h18a32 32 0 0 1 28 -28zM-4 -24a24 24 0 0 0 -20 20h20zM4 -24v20h20a24 24 0 0 0 -20 -20zM-24 4a24 24 0 0 0 20 20v-20zM4 4v20a24 24 0 0 0 20 -20z" },
  arrow: { label: "Arrow", group: "Marks", d: "M-50 -8H18V-34L50 0L18 34V8H-50Z" },
  bolt: { label: "Bolt", group: "Marks", d: "M10 -50L-30 8H-4L-14 50L30 -10H4Z" },
  heart: { label: "Heart", group: "Marks", d: "M0 44C-60 4 -48 -44 -22 -44C-8 -44 0 -32 0 -24C0 -32 8 -44 22 -44C48 -44 60 4 0 44Z" },
  crown: { label: "Crown", group: "Marks", d: "M-46 34L-50 -26L-22 0L0 -40L22 0L50 -26L46 34Z" },
  check: { label: "Tick", group: "Marks", d: "M-46 2L-32 -12L-12 8L32 -38L46 -24L-12 36Z" },
  cup: { label: "Coffee cup", group: "Food & Drink", d: "M-38 -18H26V-8H36A14 14 0 0 1 36 20H24A30 30 0 0 1 -4 40H-8A30 30 0 0 1 -38 10ZM26 2V10H36A4 4 0 0 0 36 2ZM-44 44H32V50H-44ZM-24 -50H-17V-28H-24ZM-4 -50H3V-28H-4Z" },
  bowl: { label: "Noodle bowl", group: "Food & Drink", d: "M-48 -4H48A48 40 0 0 1 22 40H-22A48 40 0 0 1 -48 -4ZM-30 -12L-10 -50H-2L-20 -12ZM-10 -12L14 -50H22L0 -12Z" },
  leaf: { label: "Leaf", group: "Nature", d: "M-40 44C-44 -10 -6 -46 44 -46C46 4 10 44 -30 40L-10 8L-16 4Z" },
  sun: { label: "Sun", group: "Nature", d: "M0 -24A24 24 0 1 0 0 24A24 24 0 1 0 0 -24ZM-4 -50H4V-32H-4ZM-4 32H4V50H-4ZM-50 -4H-32V4H-50ZM32 -4H50V4H32ZM-38 -32L-32 -38L-20 -26L-26 -20ZM20 26L26 20L38 32L32 38ZM32 -38L38 -32L26 -20L20 -26ZM-26 20L-20 26L-32 38L-38 32Z" },
  mountain: { label: "Mountains", group: "Nature", d: "M-50 36L-14 -30L4 2L18 -16L50 36Z" },
  wave: { label: "Mekong wave", group: "Laos", d: "M-50 -6C-34 -26 -18 -26 0 -6C18 14 34 14 50 -6V8C34 28 18 28 0 8C-18 -12 -34 -12 -50 8ZM-50 22C-34 2 -18 2 0 22C18 42 34 42 50 22V36C34 56 18 56 0 36C-18 16 -34 16 -50 36Z" },
  stupa: { label: "Stupa", group: "Laos", d: "M-3 -50H3V-36L10 -20C10 -8 18 -4 20 6H26V16H34V28H42V40H50V50H-50V40H-42V28H-34V16H-26V6H-20C-18 -4 -10 -8 -10 -20L-3 -36Z" },
  frangipani: { label: "Dok Champa", group: "Laos", d: "M0 -6C-16 -22 -14 -46 0 -50C14 -46 16 -22 0 -6ZM6 -2C12 -24 34 -34 46 -24C46 -10 28 6 6 -2ZM4 6C26 2 44 18 40 32C28 40 6 28 4 6ZM-4 6C-6 28 -28 40 -40 32C-44 18 -26 2 -4 6ZM-6 -2C-28 6 -46 -10 -46 -24C-34 -34 -12 -24 -6 -2Z" },
  ball: { label: "Football", group: "Sport", d: "M0 -48A48 48 0 1 0 0 48A48 48 0 1 0 0 -48ZM0 -40A40 40 0 1 1 0 40A40 40 0 1 1 0 -40ZM0 -19L18 -6L11 15H-11L-18 -6ZM-3 -40H3V-19H-3ZM17 -9L37 -16L39 -10L19 -3ZM9 14L14 11L27 29L22 33ZM-9 14L-14 11L-27 29L-22 33ZM-17 -9L-37 -16L-39 -10L-19 -3Z" },
  trophy: { label: "Trophy", group: "Sport", d: "M-24 -46H24V-36H42V-22A18 18 0 0 1 22 -4A24 24 0 0 1 6 12V28H20V38H28V48H-28V38H-20V28H-6V12A24 24 0 0 1 -22 -4A18 18 0 0 1 -42 -22V-36H-24ZM-34 -28V-22A10 10 0 0 0 -24 -12V-28ZM24 -28V-12A10 10 0 0 0 34 -22V-28Z" },
};

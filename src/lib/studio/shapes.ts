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

export type GraphicGroup = "Marks" | "Food & Drink" | "Sport" | "Nature" | "Laos" | "Frames & banners" | "Business" | "Celebration" | "Transport" | "School";

/**
 * Studio element library — original single-colour marks drawn on a 100 × 100
 * box centred at the origin (−50…50). Recolourable, scalable, print-safe.
 */
export const GRAPHICS: Record<string, { label: string; group: GraphicGroup; d: string }> = {
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
  hexagon: { label: "Hexagon", group: "Frames & banners", d: "M0 -46L40 -23V23L0 46L-40 23V-23Z" },
  diamond: { label: "Diamond", group: "Frames & banners", d: "M0 -46L46 0L0 46L-46 0Z" },
  frame: { label: "Frame", group: "Frames & banners", d: "M-36 -46H36A10 10 0 0 1 46 -36V36A10 10 0 0 1 36 46H-36A10 10 0 0 1 -46 36V-36A10 10 0 0 1 -36 -46ZM-36 -32V32A4 4 0 0 0 -32 36H32A4 4 0 0 0 36 32V-32A4 4 0 0 0 32 -36H-32A4 4 0 0 0 -36 -32Z" },
  ring: { label: "Circle frame", group: "Frames & banners", d: "M0 -46A46 46 0 1 0 0 46A46 46 0 1 0 0 -46ZM0 -32A32 32 0 1 1 0 32A32 32 0 1 1 0 -32Z" },
  ribbon: { label: "Ribbon banner", group: "Frames & banners", d: "M-32 -26H32V-16H48L40 5L48 26H32V10H-32V26H-48L-40 5L-48 -16H-32Z" },
  bubble: { label: "Speech bubble", group: "Frames & banners", d: "M-34 -40H34A12 12 0 0 1 46 -28V12A12 12 0 0 1 34 24H-10L-30 44V24H-34A12 12 0 0 1 -46 12V-28A12 12 0 0 1 -34 -40Z" },
  chevron: { label: "Chevron", group: "Frames & banners", d: "M-34 -46H-2L34 0L-2 46H-34L2 0Z" },
  chevron2: { label: "Double chevron", group: "Frames & banners", d: "M-46 -46H-22L4 0L-22 46H-46L-20 0ZM-4 -46H20L46 0L20 46H-4L22 0Z" },
  laurel: { label: "Laurel wreath", group: "Frames & banners", d: "M-4 46C-30 36 -44 8 -38 -32L-32 -30C-38 6 -24 32 -2 40ZM-17 36C-23 30 -30 31 -35 38C-29 44 -22 43 -17 36ZM-13 33C-6 29 -5 22 -10 15C-18 20 -19 27 -13 33ZM-33 13C-35 5 -42 2 -50 6C-47 14 -40 17 -33 13ZM-28 12C-20 11 -16 5 -18 -3C-26 -2 -30 3 -28 12ZM-37 -16C-36 -25 -41 -30 -49 -29C-50 -21 -45 -16 -37 -16ZM-32 -15C-24 -12 -18 -16 -17 -24C-25 -27 -31 -24 -32 -15ZM4 46C30 36 44 8 38 -32L32 -30C38 6 24 32 2 40ZM17 36C22 43 29 44 35 38C30 31 23 30 17 36ZM14 33C19 27 18 20 10 15C5 22 6 29 14 33ZM33 13C40 17 47 14 50 6C42 2 36 5 33 13ZM28 12C31 3 26 -2 18 -3C16 5 20 11 28 12ZM37 -16C46 -16 50 -21 49 -29C41 -30 36 -25 37 -16ZM32 -15C31 -24 25 -27 17 -24C18 -16 25 -12 32 -15Z" },
  sunburst: { label: "Sunburst", group: "Frames & banners", d: "M-20 0A20 20 0 1 0 20 0A20 20 0 1 0 -20 0ZM27 -4.5L46 0L27 4.5ZM25.6 9.6L39.8 23L21.1 17.4ZM17.4 21.1L23 39.8L9.6 25.6ZM4.5 27L0 46L-4.5 27ZM-9.6 25.6L-23 39.8L-17.4 21.1ZM-21.1 17.4L-39.8 23L-25.6 9.6ZM-27 4.5L-46 0L-27 -4.5ZM-25.6 -9.6L-39.8 -23L-21.1 -17.4ZM-17.4 -21.1L-23 -39.8L-9.6 -25.6ZM-4.5 -27L0 -46L4.5 -27ZM9.6 -25.6L23 -39.8L17.4 -21.1ZM21.1 -17.4L39.8 -23L25.6 -9.6Z" },
  pin: { label: "Location pin", group: "Marks", d: "M0 -48C-20 -48 -34 -34 -34 -14C-34 10 0 48 0 48C0 48 34 10 34 -14C34 -34 20 -48 0 -48ZM0 -28A14 14 0 1 1 0 0A14 14 0 1 1 0 -28Z" },
  phone: { label: "Phone", group: "Marks", d: "M-46 -40C-46 -44 -43 -46 -40 -46H-18C-15 -46 -12 -44 -12 -40C-12 -33 -11 -26 -8 -20C-7 -17 -8 -14 -10 -12L-20 -2A56 56 0 0 1 18 36L28 26C31 23 34 22 37 23C43 25 46 29 46 34V40C46 43 43 46 40 46C-7 46 -46 -1 -46 -40Z" },
  envelope: { label: "Envelope", group: "Marks", d: "M-46 -32H46V32H-46ZM-46 -32L0 6L46 -32V-22L0 16L-46 -22Z" },
  globe: { label: "Globe", group: "Marks", d: "M-46 0A46 46 0 1 0 46 0A46 46 0 1 0 -46 0ZM-38 0A38 38 0 1 0 38 0A38 38 0 1 0 -38 0ZM-38 -4H38V4H-38ZM-4 -38H4V-4H-4ZM-4 4H4V38H-4ZM4 -37.4A23 38 0 0 1 22.9 -4L16.9 -4A17 32 0 0 0 4 -31.1ZM4 37.4A23 38 0 0 0 22.9 4L16.9 4A17 32 0 0 1 4 31.1ZM-4 -37.4A23 38 0 0 0 -22.9 -4L-16.9 -4A17 32 0 0 1 -4 -31.1ZM-4 37.4A23 38 0 0 1 -22.9 4L-16.9 4A17 32 0 0 0 -4 31.1Z" },
  sparkle: { label: "Sparkle", group: "Marks", d: "M0 -46C4 -20 20 -4 46 0C20 4 4 20 0 46C-4 20 -20 4 -46 0C-20 -4 -4 -20 0 -46Z" },
  flame: { label: "Flame", group: "Marks", d: "M4 -48C20 -30 34 -10 34 12C34 32 20 46 0 46C-20 46 -34 32 -34 12C-34 0 -28 -8 -20 -16C-20 -4 -14 2 -8 4C-12 -12 -6 -34 4 -48ZM0 8C8 16 14 22 14 28C14 36 8 40 0 40C-8 40 -14 36 -14 28C-14 22 -10 18 -6 14C-6 18 -2 20 2 20C0 16 -2 12 0 8Z" },
  note: { label: "Music note", group: "Marks", d: "M-7 -46H1C15 -36 31 -24 25 4C23 -12 13 -18 1 -20V34A16 12 0 1 1 -7 23.6Z" },
  camera: { label: "Camera", group: "Marks", d: "M-16 -36H12L18 -26H38A8 8 0 0 1 46 -18V28A8 8 0 0 1 38 36H-38A8 8 0 0 1 -46 28V-18A8 8 0 0 1 -38 -26H-22ZM0 -12A18 18 0 1 0 0 24A18 18 0 1 0 0 -12ZM0 -4A10 10 0 1 1 0 16A10 10 0 1 1 0 -4Z" },
  cog: { label: "Cog", group: "Marks", d: "M35.1 -8.1L45.4 -7.2L45.4 7.2L35.1 8.1L30.5 19.1L37.2 27L27 37.2L19.1 30.5L8.1 35.1L7.2 45.4L-7.2 45.4L-8.1 35.1L-19.1 30.5L-27 37.2L-37.2 27L-30.5 19.1L-35.1 8.1L-45.4 7.2L-45.4 -7.2L-35.1 -8.1L-30.5 -19.1L-37.2 -27L-27 -37.2L-19.1 -30.5L-8.1 -35.1L-7.2 -45.4L7.2 -45.4L8.1 -35.1L19.1 -30.5L27 -37.2L37.2 -27L30.5 -19.1ZM-14 0A14 14 0 1 0 14 0A14 14 0 1 0 -14 0Z" },
  shieldcheck: { label: "Shield tick", group: "Marks", d: "M-42 -40H42V6C42 28 20 42 0 48C-20 42 -42 28 -42 6ZM-24 0L-16 -8L-6 2L16 -22L24 -14L-6 16Z" },
  boltcircle: { label: "Power circle", group: "Marks", d: "M0 -46A46 46 0 1 0 0 46A46 46 0 1 0 0 -46ZM6 -30L-18 5H-2L-8 30L18 -6H2Z" },
  plus: { label: "Plus", group: "Marks", d: "M-10 -46H10V-10H46V10H10V46H-10V10H-46V-10H-10Z" },
  quote: { label: "Quote marks", group: "Marks", d: "M-26.9 5.9A14 14 0 1 1 -7.1 5.9C-7 18 -17 32 -35 40L-37 33C-25 28 -19 20 -19 12ZM13.1 5.9A14 14 0 1 1 32.9 5.9C33 18 23 32 5 40L3 33C15 28 21 20 21 12Z" },
  infinity: { label: "Infinity", group: "Marks", d: "M-24 -26C-40 -26 -46 -14 -46 0C-46 14 -40 26 -24 26C-10 26 -4 12 0 0C4 12 10 26 24 26C40 26 46 14 46 0C46 -14 40 -26 24 -26C10 -26 4 -12 0 0C-4 -12 -10 -26 -24 -26ZM-26 -8C-32 -8 -36 -4 -36 0C-36 4 -32 8 -26 8C-20 8 -16 4 -14 0C-16 -4 -20 -8 -26 -8ZM26 -8C20 -8 16 -4 14 0C16 4 20 8 26 8C32 8 36 4 36 0C36 -4 32 -8 26 -8Z" },
  beer: { label: "Beer mug", group: "Food & Drink", d: "M-34 40V-22C-40 -24 -40 -38 -28 -38C-24 -46 -6 -48 0 -40C10 -46 24 -36 18 -22V40A4 4 0 0 1 14 44H-30A4 4 0 0 1 -34 40ZM18 -10H28A16 16 0 0 1 28 22H18V14H26A8 8 0 0 0 26 -2H18Z" },
  wine: { label: "Wine glass", group: "Food & Drink", d: "M-28 -42H28C28 -16 20 0 4 2V34H20V42H-20V34H-4V2C-20 0 -28 -16 -28 -42Z" },
  bottle: { label: "Bottle", group: "Food & Drink", d: "M-10 -48H10V-30C10 -26 24 -20 24 -6V40A6 6 0 0 1 18 46H-18A6 6 0 0 1 -24 40V-6C-24 -20 -10 -26 -10 -30ZM-16 6H16V22H-16Z" },
  cocktail: { label: "Cocktail", group: "Food & Drink", d: "M-46 -46H46L6 -2V32H24V40H-24V32H-6V-2ZM-24 -34L0 -8L24 -34Z" },
  chilli: { label: "Chilli", group: "Food & Drink", d: "M-30 -24C-4 -36 28 -10 32 44C12 26 -14 6 -34 -6A10 10 0 0 1 -30 -24ZM-32 -26C-38 -36 -30 -46 -18 -46C-20 -40 -22 -32 -22 -26Z" },
  rice: { label: "Rice bowl", group: "Food & Drink", d: "M-46 -2H46C46 18 34 32 18 38V44H-18V38C-34 32 -46 18 -46 -2ZM-30 -6C-30 -22 -14 -30 0 -30C14 -30 30 -22 30 -6ZM-14 -50C-22 -44 -6 -40 -14 -34H-8C0 -40 -16 -44 -8 -50ZM8 -50C0 -44 16 -40 8 -34H14C22 -40 6 -44 14 -50Z" },
  tipkhao: { label: "Tip khao", group: "Food & Drink", d: "M-4 -50H4V-44H-4ZM-32 -30C-32 -40 -20 -44 0 -44C20 -44 32 -40 32 -30ZM-30 -26H30L28 30H-28ZM-24 -4H24V2H-24ZM-22 12H22V18H-22ZM-26 32H-16L-8 48H-18ZM26 32H16L8 48H18Z" },
  skewer: { label: "Grill skewer", group: "Food & Drink", d: "M-44 40L-40 44L-26 30L-30 26ZM28 -30L32 -26L46 -46ZM-14 -5L3 12L-14 29L-31 12ZM0 -19L17 -2L0 15L-17 -2ZM14 -33L31 -16L14 1L-3 -16Z" },
  tree: { label: "Tree", group: "Nature", d: "M0 -46C24 -46 40 -30 40 -8C40 12 26 26 6 28V46H-6V28C-26 26 -40 12 -40 -8C-40 -30 -24 -46 0 -46Z" },
  palm: { label: "Palm tree", group: "Nature", d: "M-2 46C-2 24 2 4 10 -12L18 -8C10 6 8 24 8 46ZM14 -12C-3.4 -18.6 -25.8 -17 -42 -8C-24.6 -1.4 -2.2 -3 14 -12ZM14 -12C2.8 -25.7 -16.4 -34.5 -34 -34C-22.8 -20.3 -3.6 -11.5 14 -12ZM14 -12C15.5 -25.8 8.3 -39.4 -4 -46C-5.5 -32.2 1.7 -18.6 14 -12ZM14 -12C25.8 -15.4 33 -25.8 32 -38C20.2 -34.6 13 -24.2 14 -12ZM14 -12C23.1 -3.6 35.9 -2.8 46 -10C36.9 -18.4 24.1 -19.2 14 -12Z" },
  lotus: { label: "Lotus", group: "Nature", d: "M0 24C10.4 3 10.4 -25 0 -46C-10.4 -25 -10.4 3 0 24ZM0 24C-0.2 2.2 -11.4 -21.8 -28 -36C-27.8 -14.2 -16.6 9.8 0 24ZM0 24C16.6 9.8 27.8 -14.2 28 -36C11.4 -21.8 0.2 2.2 0 24ZM-2 26C-10.4 9.6 -28 -4 -46 -8C-37.6 8.4 -20 22 -2 26ZM2 26C20 22 37.6 8.4 46 -8C28 -4 10.4 9.6 2 26ZM-46 22C-30 44 30 44 46 22C30 30 -30 30 -46 22Z" },
  drop: { label: "Water drop", group: "Nature", d: "M0 -46C16 -22 30 -6 30 12C30 30 16 44 0 44C-16 44 -30 30 -30 12C-30 -6 -16 -22 0 -46Z" },
  cloud: { label: "Cloud", group: "Nature", d: "M-22 34C-38 34 -46 24 -46 14C-46 2 -36 -4 -28 -4C-26 -20 -14 -32 0 -32C14 -32 26 -22 28 -10C40 -10 46 0 46 12C46 24 38 34 24 34Z" },
  moon: { label: "Moon", group: "Nature", d: "M30.3 -40A44 44 0 1 0 30.3 40A40 40 0 0 1 30.3 -40Z" },
  elephant: { label: "Elephant", group: "Nature", d: "M-26 -32C-8 -38 26 -38 40 -20C46 -12 46 4 44 16V44H30V28H-2V44H-16V26C-22 26 -28 20 -30 12C-36 20 -38 32 -36 46H-46C-48 30 -46 14 -40 4C-44 -6 -46 -16 -40 -24C-36 -30 -30 -32 -26 -32ZM-22 -22C-12 -26 -6 -16 -10 -6C-14 0 -24 -2 -24 -12ZM-34 -19A3 3 0 1 0 -34 -13A3 3 0 1 0 -34 -19Z" },
  bird: { label: "Bird", group: "Nature", d: "M20 -30C30 -30 38 -24 36 -14L46 -10L36 -6C34 8 20 20 0 22C-14 24 -30 22 -46 18L-34 10C-24 12 -14 12 -6 6C-20 -6 -30 -24 -34 -44C-18 -36 -6 -22 6 -12C8 -22 12 -30 20 -30Z" },
  naga: { label: "Naga", group: "Laos", d: "M-46 -14C-30 -24 -16 -30 -6 -32C-2 -44 6 -50 16 -48L10 -36C20 -40 30 -40 38 -34L28 -26C36 -22 42 -14 44 -6L34 -2C36 10 34 30 34 46H12C12 28 10 12 2 2C-2 -2 -6 -2 -12 0L-36 12L-40 6L-22 -6L-44 -4ZM-19.5 -22A3.5 3.5 0 1 0 -12.5 -22A3.5 3.5 0 1 0 -19.5 -22Z" },
  temple: { label: "Temple roof", group: "Laos", d: "M0 -48L12 -30L20 -40L18 -28H12L26 -8L34 -18L32 -6H24L42 14L46 6L44 16H34V46H-34V16H-44L-46 6L-42 14L-24 -6H-32L-34 -18L-26 -8L-12 -28H-18L-20 -40L-12 -30ZM-7 24H7V46H-7Z" },
  khaen: { label: "Khaen", group: "Laos", d: "M-46 -6H46V10H-46ZM-38.5 -20H-31.5V-8H-38.5ZM-38.5 12H-31.5V20H-38.5ZM-28.5 -30H-21.5V-8H-28.5ZM-28.5 12H-21.5V28H-28.5ZM-18.5 -40H-11.5V-8H-18.5ZM-18.5 12H-11.5V36H-18.5ZM-8.5 -48H-1.5V-8H-8.5ZM-8.5 12H-1.5V46H-8.5ZM1.5 -48H8.5V-8H1.5ZM1.5 12H8.5V46H1.5ZM11.5 -40H18.5V-8H11.5ZM11.5 12H18.5V36H11.5ZM21.5 -30H28.5V-8H21.5ZM21.5 12H28.5V28H21.5ZM31.5 -20H38.5V-8H31.5ZM31.5 12H38.5V20H31.5Z" },
  drum: { label: "Lao drum", group: "Laos", d: "M-34 -46H34V-38H-34ZM-30 -38H30C36 -20 36 20 30 38H-30C-36 20 -36 -20 -30 -38ZM-34 38H34V46H-34ZM-28 -3H28V3H-28Z" },
  lantern: { label: "Lantern", group: "Laos", d: "M-14 -46H14V-34H-14ZM0 -34A34 30 0 1 0 0 26A34 30 0 1 0 -0.1 -34ZM-15.5 -26V18H-12.5V-26ZM12.5 -26V18H15.5V-26ZM-14 26H14V34H-14ZM-3 34H3V48H-3Z" },
  ricestalk: { label: "Rice stalk", group: "Laos", d: "M-6 46C-6 20 -4 -6 4 -30L10 -28C2 -6 0 20 0 46ZM2 -22C-6.9 -24.8 -14.9 -20.8 -18 -12C-9.1 -9.2 -1.1 -13.2 2 -22ZM4 -32C-2.1 -37.9 -9.3 -37.1 -14 -30C-7.9 -24.1 -0.7 -24.9 4 -32ZM8 -40C5.5 -47.9 -0.9 -50.3 -8 -46C-5.5 -38.1 0.9 -35.7 8 -40ZM8 -22C8.5 -12.9 14.9 -7.3 24 -8C23.5 -17.1 17.1 -22.7 8 -22ZM10 -32C14.1 -24 22.1 -21.6 30 -26C25.9 -34 17.9 -36.4 10 -32ZM12 -42C17.6 -36.2 24 -37 28 -44C22.4 -49.8 16 -49 12 -42Z" },
  jersey: { label: "Jersey", group: "Sport", d: "M-20 -44C-12 -30 12 -30 20 -44L46 -30L38 -6L26 -10V44H-26V-10L-38 -6L-46 -30Z" },
  medal: { label: "Medal", group: "Sport", d: "M-24 -48L-8 -48L0 -30L8 -48L24 -48L0 -8ZM-28 20A28 28 0 1 0 28 20A28 28 0 1 0 -28 20ZM0 6L3.5 15.1L13.3 15.7L5.7 21.9L8.2 31.3L0 26L-8.2 31.3L-5.7 21.9L-13.3 15.7L-3.5 15.1Z" },
  whistle: { label: "Whistle", group: "Sport", d: "M-46 -20H10A32 32 0 1 1 -22 14V-6H-46ZM6 6A8 8 0 1 0 6 22A8 8 0 1 0 6 6Z" },
  bicycle: { label: "Bicycle", group: "Sport", d: "M-47 14A20 20 0 1 0 -7 14A20 20 0 1 0 -47 14ZM-40 14A13 13 0 1 0 -14 14A13 13 0 1 0 -40 14ZM7 14A20 20 0 1 0 47 14A20 20 0 1 0 7 14ZM14 14A13 13 0 1 0 40 14A13 13 0 1 0 14 14ZM-12 -28L24 -28L2 22L-2 22L-12 -28ZM-6 -20L16 -20L1 14ZM-8 15L-8 19L2 20L2 14ZM19 -24L25 -22L26 -6L22 -6ZM-18 -33H-2V-29H-18ZM16 -36H32V-32H16Z" },
  basketball: { label: "Basketball", group: "Sport", d: "M-46 0A46 46 0 1 0 46 0A46 46 0 1 0 -46 0ZM-45 -3H45V3H-45ZM-3 -45H3V-5H-3ZM-3 5H3V45H-3ZM-27.1 -5A37 37 0 0 0 -37.1 -25.4L-33.4 -30.2A43 43 0 0 1 -21.1 -5ZM-27.1 5A37 37 0 0 1 -37.1 25.4L-33.4 30.2A43 43 0 0 0 -21.1 5ZM27.1 -5A37 37 0 0 1 37.1 -25.4L33.4 -30.2A43 43 0 0 0 21.1 -5ZM27.1 5A37 37 0 0 0 37.1 25.4L33.4 30.2A43 43 0 0 1 21.1 5Z" },
  volleyball: { label: "Volleyball", group: "Sport", d: "M-46 0A46 46 0 1 0 46 0A46 46 0 1 0 -46 0ZM7.1 -3.7A37 37 0 0 0 35.1 -28.2L39.1 -22.2A43 43 0 0 1 7.7 2.3ZM-0.3 8A37 37 0 0 0 6.9 44.5L-0.3 45A43 43 0 0 1 -5.8 5.5ZM-6.8 -4.3A37 37 0 0 0 -42 -16.3L-38.8 -22.8A43 43 0 0 1 -1.9 -7.8Z" },
  runner: { label: "Runner", group: "Sport", d: "M14 -46A9 9 0 1 0 14 -28A9 9 0 1 0 14 -46ZM4 -22C12 -20 18 -14 22 -6L38 -2L46 -12L44 4L20 6L14 0L10 10L24 22L20 46H10L12 26L-4 18L-24 40L-46 36L-44 28L-26 30L-8 8L-6 -8L-22 -2L-34 -20L-28 -24L-18 -10L-2 -20Z" },
  shuttle: { label: "Shuttlecock", group: "Sport", d: "M-12 24L-42 -44H42L12 24ZM-12 24A12 12 0 0 0 12 24ZM0 14L-32 -40H-26ZM0 14L-12 -40H-6ZM0 14L6 -40H12ZM0 14L26 -40H32Z" },
  glove: { label: "Boxing glove", group: "Sport", d: "M-14 -46H16C34 -46 46 -32 46 -12V6C46 22 34 32 18 32H-2V46H-38V32C-44 28 -46 18 -42 10C-46 4 -46 -6 -42 -12C-46 -24 -34 -46 -14 -46ZM-34 -8C-38 -2 -36 4 -30 6H-2C-2 0 -6 -6 -12 -8Z" },
  briefcase: { label: "Briefcase", group: "Business", d: "M-16 -46H16A6 6 0 0 1 22 -40V-30H40A6 6 0 0 1 46 -24V40A6 6 0 0 1 40 46H-40A6 6 0 0 1 -46 40V-24A6 6 0 0 1 -40 -30H-22V-40A6 6 0 0 1 -16 -46ZM-14 -38V-30H14V-38ZM-40 -2H-6V4H-40ZM6 -2H40V4H6Z" },
  bulb: { label: "Light bulb", group: "Business", d: "M0 -48C-20 -48 -34 -34 -34 -14C-34 0 -26 6 -20 14C-16 20 -14 24 -14 28H14C14 24 16 20 20 14C26 6 34 0 34 -14C34 -34 20 -48 0 -48ZM-14 32H14V38H-14ZM-12 42H12V48H-12Z" },
  rocket: { label: "Rocket", group: "Business", d: "M0 -48C14 -36 22 -14 22 12L30 22V40L14 30H-14L-30 40V22L-22 12C-22 -14 -14 -36 0 -48ZM0 -22A8 8 0 1 0 0 -6A8 8 0 1 0 0 -22ZM-8 34H8L0 48Z" },
  chart: { label: "Bar chart", group: "Business", d: "M-46 8H-24V46H-46ZM-12 -14H10V46H-12ZM22 -36H44V46H22Z" },
  megaphone: { label: "Megaphone", group: "Business", d: "M-46 -12H-28L20 -40V40L-28 12H-36V32H-46ZM28 -16C38 -8 38 8 28 16V8C32 4 32 -4 28 -8Z" },
  laptop: { label: "Laptop", group: "Business", d: "M-38 -36H38A4 4 0 0 1 42 -32V22H-42V-32A4 4 0 0 1 -38 -36ZM-34 -28V14H34V-28ZM-48 28H48V32A6 6 0 0 1 42 38H-42A6 6 0 0 1 -48 32Z" },
  tag: { label: "Tag", group: "Business", d: "M-46 -44H-8L46 10L10 46L-46 -10ZM-32 -36A6 6 0 1 0 -32 -24A6 6 0 1 0 -32 -36Z" },
  bag: { label: "Shopping bag", group: "Business", d: "M-40 -18H40L46 46H-46ZM-18 -18V-28A18 18 0 0 1 18 -28V-18H10V-28A10 10 0 0 0 -10 -28V-18Z" },
  building: { label: "Building", group: "Business", d: "M-30 -46H30V46H-30ZM-22 -38H-14V-30H-22ZM-22 -24H-14V-16H-22ZM-22 -10H-14V-2H-22ZM-22 4H-14V12H-22ZM-4 -38H4V-30H-4ZM-4 -24H4V-16H-4ZM-4 -10H4V-2H-4ZM-4 4H4V12H-4ZM14 -38H22V-30H14ZM14 -24H22V-16H14ZM14 -10H22V-2H14ZM14 4H22V12H14ZM-6 28H6V46H-6Z" },
  balloon: { label: "Balloon", group: "Celebration", d: "M0 -48C22 -48 34 -30 34 -12C34 8 18 24 6 30L10 36H-10L-6 30C-18 24 -34 8 -34 -12C-34 -30 -22 -48 0 -48ZM-1 36H1V48H-1Z" },
  partyhat: { label: "Party hat", group: "Celebration", d: "M0 -32L42 44H-42ZM0 -48A8 8 0 1 0 0 -32A8 8 0 1 0 0 -48ZM-11 -4H11L19 10H-19Z" },
  cake: { label: "Cake", group: "Celebration", d: "M-46 8H46V40A6 6 0 0 1 40 46H-40A6 6 0 0 1 -46 40ZM-38 -14H38V4H-38ZM-22 -36H-16V-14H-22ZM-3 -40H3V-14H-3ZM16 -36H22V-14H16ZM-19 -48C-15 -44 -15 -40 -19 -38C-23 -40 -23 -44 -19 -48ZM0 -50C4 -46 4 -42 0 -40C-4 -42 -4 -46 0 -50ZM19 -48C23 -44 23 -40 19 -38C15 -40 15 -44 19 -48Z" },
  gift: { label: "Gift box", group: "Celebration", d: "M-46 -12H46V6H-46ZM-40 12H40V46H-40ZM-3 -12H3V6H-3ZM-3 12H3V46H-3ZM0 -12C-28 -10 -40 -34 -26 -44C-16 -48 -4 -34 0 -12ZM0 -12C28 -10 40 -34 26 -44C16 -48 4 -34 0 -12Z" },
  starburst: { label: "Starburst", group: "Celebration", d: "M0 -46L7.7 -18.5L32.5 -32.5L18.5 -7.7L46 0L18.5 7.7L32.5 32.5L7.7 18.5L0 46L-7.7 18.5L-32.5 32.5L-18.5 7.7L-46 0L-18.5 -7.7L-32.5 -32.5L-7.7 -18.5Z" },
  confetti: { label: "Confetti", group: "Celebration", d: "M-43 -30A7 7 0 1 0 -29 -30A7 7 0 1 0 -43 -30ZM23 34A7 7 0 1 0 37 34A7 7 0 1 0 23 34ZM33 -10A5 5 0 1 0 43 -10A5 5 0 1 0 33 -10ZM-15 40A5 5 0 1 0 -5 40A5 5 0 1 0 -15 40ZM-13.7 -48.2L3.7 -38.2L-2.3 -27.8L-19.7 -37.8ZM11.8 -26.9L26.5 -37.3L32.2 -29.1L17.5 -18.7ZM-40.7 12.2L-23.8 18.4L-27.3 27.8L-44.2 21.6ZM3.8 -7.3L15.3 -4.2L12.2 7.3L0.7 4.2ZM-16 -14L-4 -20L-8 -6ZM26 6L40 12L30 20ZM0.7 40.2L10.7 22.8L19.3 27.8L9.3 45.2ZM-23.2 30.9L-18.6 34.8L-28.8 47.1L-33.4 43.2Z" },
  hearts: { label: "Two hearts", group: "Celebration", d: "M-14 43.7C-57.2 14.9 -48.6 -19.7 -29.8 -19.7C-19.8 -19.7 -14 -11 -14 -5.3C-14 -11 -8.2 -19.7 1.8 -19.7C20.6 -19.7 29.2 14.9 -14 43.7ZM26 -3.5C0.8 -20.3 5.8 -40.5 16.8 -40.5C22.6 -40.5 26 -35.4 26 -32.1C26 -35.4 29.4 -40.5 35.2 -40.5C46.2 -40.5 51.2 -20.3 26 -3.5Z" },
  gradcap: { label: "Graduation cap", group: "School", d: "M0 -40L46 -18L0 4L-46 -18ZM-23 -7V12C-23 20 23 20 23 12V-7L0 4ZM42 -16H46V6H42ZM44 6A5 5 0 1 0 44 16A5 5 0 1 0 44 6Z" },
  book: { label: "Open book", group: "School", d: "M-46 -30C-30 -36 -14 -34 -2 -26V38C-14 30 -30 28 -46 34ZM2 -26C14 -34 30 -36 46 -30V34C30 28 14 30 2 38Z" },
  pencil: { label: "Pencil", group: "School", d: "M-23.3 10.6L17.7 -30.4L30.4 -17.7L-10.6 23.3ZM-23.3 10.6L-32.5 32.5L-10.6 23.3ZM19.8 -32.5L21.9 -34.6L34.6 -21.9L32.5 -19.8ZM24 -36.8L26.2 -38.9L38.9 -26.2L36.8 -24Z" },
  ruler: { label: "Ruler", group: "School", d: "M-41 24L24 -41L41 -24L-24 41ZM-37.6 20.6L-35.9 19L-31.7 23.2L-33.4 24.9ZM-32 15L-30.3 13.3L-23.2 20.4L-24.9 22.1ZM-26.3 9.3L-24.6 7.6L-20.4 11.9L-22.1 13.6ZM-20.6 3.7L-19 2L-11.9 9.1L-13.6 10.7ZM-15 -2L-13.3 -3.7L-9.1 0.6L-10.7 2.3ZM-9.3 -7.6L-7.6 -9.3L-0.6 -2.3L-2.3 -0.6ZM-3.7 -13.3L-2 -15L2.3 -10.7L0.6 -9.1ZM2 -19L3.7 -20.6L10.7 -13.6L9.1 -11.9ZM7.6 -24.6L9.3 -26.3L13.6 -22.1L11.9 -20.4ZM13.3 -30.3L15 -32L22.1 -24.9L20.4 -23.2ZM19 -35.9L20.6 -37.6L24.9 -33.4L23.2 -31.7Z" },
  apple: { label: "Apple", group: "School", d: "M0 -22C10 -34 26 -30 36 -18C46 -4 42 26 28 40C20 48 10 44 0 42C-10 44 -20 48 -28 40C-42 26 -46 -4 -36 -18C-26 -30 -10 -34 0 -22ZM-2 -24C-2 -34 2 -42 8 -46L12 -42C6 -38 4 -30 4 -24ZM6 -34C10 -46 26 -46 32 -40C26 -30 12 -30 6 -34Z" },
  backpack: { label: "Backpack", group: "School", d: "M-30 -30H30A10 10 0 0 1 40 -20V40A6 6 0 0 1 34 46H-34A6 6 0 0 1 -40 40V-20A10 10 0 0 1 -30 -30ZM-10 -46H10A6 6 0 0 1 16 -40V-30H10V-38H-10V-30H-16V-40A6 6 0 0 1 -10 -46ZM-22 8H22V36H-22ZM-16 14H16V30H-16Z" },
  bell: { label: "Bell", group: "School", d: "M-6 -46H6V-40C22 -36 30 -22 30 -4V18L40 30H-40L-30 18V-4C-30 -22 -22 -36 -6 -40ZM-10 34A10 10 0 0 0 10 34Z" },
  tuktuk: { label: "Tuk-tuk", group: "Transport", d: "M-46 -42H36C42 -42 46 -36 46 -30V-26H-46ZM-44 -26H-38V8H-44ZM-8 -26H-2V8H-8ZM30 -26H36L46 8H40ZM-38 -6H-8V8H-38ZM8 -4H26V8H8ZM-46 8H46V20H-46ZM-24 18A14 14 0 1 0 -24 46A14 14 0 1 0 -24 18ZM-24 27A5 5 0 1 1 -24 37A5 5 0 1 1 -24 27ZM30 22A12 12 0 1 0 30 46A12 12 0 1 0 30 22ZM30 30A4 4 0 1 1 30 38A4 4 0 1 1 30 30Z" },
  truck: { label: "Truck", group: "Transport", d: "M-46 -36H6V22H-46ZM6 -18H30L46 2V22H6ZM12 -12H28L38 0H12ZM-28 22A10 10 0 1 0 -28 42A10 10 0 1 0 -28 22ZM-28 28A4 4 0 1 1 -28 36A4 4 0 1 1 -28 28ZM28 22A10 10 0 1 0 28 42A10 10 0 1 0 28 22ZM28 28A4 4 0 1 1 28 36A4 4 0 1 1 28 28Z" },
  motorbike: { label: "Motorbike", group: "Transport", d: "M-28 6A16 16 0 1 0 -28 38A16 16 0 1 0 -28 6ZM-28 14A8 8 0 1 1 -28 30A8 8 0 1 1 -28 14ZM28 6A16 16 0 1 0 28 38A16 16 0 1 0 28 6ZM28 14A8 8 0 1 1 28 30A8 8 0 1 1 28 14ZM-30 -6C-22 -22 -8 -30 8 -28L14 -40H34L28 -34H20L30 -14C38 -12 42 -4 42 4L26 6L18 -12L4 -4H-8L-4 8L-14 16L-20 6L-30 4Z" },
  boat: { label: "Long-tail boat", group: "Transport", d: "M-46 -8C-36 4 -30 8 -26 8H44L40 24C20 30 -20 30 -34 22C-42 16 -46 6 -46 -8ZM-20 -22H18V-16H-20ZM-18 -16H-14V8H-18ZM12 -16H16V8H12ZM40 10L46 40L42 42L37 12Z" },
  plane: { label: "Plane", group: "Transport", d: "M0 -46C6 -46 8 -38 8 -26V-8L46 14V22L8 12V28L20 38V44L0 38L-20 44V38L-8 28V12L-46 22V14L-8 -8V-26C-8 -38 -6 -46 0 -46Z" },
};

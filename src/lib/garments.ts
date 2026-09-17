import type { GarmentKey } from "@/content/types";

/**
 * Garment geometry — one source for the 3D hero (extruded) and SPP Studio (2D).
 * All coordinates live in a 1000 × 1120 box. Outlines are command lists rather
 * than SVG strings so they can become an SVG path, a Path2D or a THREE.Shape.
 * (The T-shirt/polo proportions descend from the previous site's canvas
 * customizer, redrawn with set-in sleeves and a curved hem.)
 */
export const GARMENT_BOX = { w: 1000, h: 1120 } as const;

export type Cmd = ["M", number, number] | ["L", number, number] | ["C", number, number, number, number, number, number] | ["Z"];
export type Rect = { x: number; y: number; w: number; h: number };
export type SideKey = "front" | "back" | "left-sleeve" | "right-sleeve" | "panel";

export type GarmentSide = {
  key: SideKey;
  label: string;
  body: Cmd[];
  /** seams, collars, plackets — stroked, never filled */
  seams: string[];
  /** filled trim pieces drawn over the body in a darker tone (collar, brim…) */
  trims: string[];
  /** printable region inside the box, matching the product's physical print area */
  area: Rect;
};

export type Garment = { key: GarmentKey; name: string; sides: GarmentSide[] };

const teeBody = (neckDepth: number): Cmd[] => [
  ["M", 318, 72],
  ["C", 370, 72 + neckDepth, 630, 72 + neckDepth, 682, 72],
  ["L", 900, 150],
  ["L", 996, 398],
  ["L", 852, 458],
  ["L", 814, 362],
  ["C", 812, 600, 818, 900, 824, 1058],
  ["C", 700, 1086, 300, 1086, 176, 1058],
  ["C", 182, 900, 188, 600, 186, 362],
  ["L", 148, 458],
  ["L", 4, 398],
  ["L", 100, 150],
  ["Z"],
];

const teeSeams = (neckDepth: number) => [
  `M300 66 C356 ${84 + neckDepth * 1.18} 644 ${84 + neckDepth * 1.18} 700 66`, // neck rib outer
  "M186 362 C196 300 176 210 100 150", // left armhole
  "M814 362 C804 300 824 210 900 150", // right armhole
  "M22 380 L160 436", // left cuff
  "M978 380 L840 436", // right cuff
  "M180 1034 C300 1062 700 1062 820 1034", // hem stitch
];

const sleeveBody: Cmd[] = [["M", 250, 300], ["L", 750, 250], ["L", 820, 760], ["L", 200, 820], ["Z"]];

const tee: Garment = {
  key: "tee",
  name: "T-Shirt",
  sides: [
    { key: "front", label: "Front", body: teeBody(96), seams: teeSeams(96), trims: [], area: { x: 300, y: 250, w: 400, h: 533 } },
    { key: "back", label: "Back", body: teeBody(30), seams: teeSeams(30), trims: [], area: { x: 290, y: 200, w: 420, h: 551 } },
    { key: "left-sleeve", label: "Left sleeve", body: sleeveBody, seams: ["M212 770 L812 712"], trims: [], area: { x: 380, y: 400, w: 240, h: 240 } },
    { key: "right-sleeve", label: "Right sleeve", body: sleeveBody, seams: ["M212 770 L812 712"], trims: [], area: { x: 380, y: 400, w: 240, h: 240 } },
  ],
};

const polo: Garment = {
  key: "polo",
  name: "Polo Shirt",
  sides: [
    {
      key: "front", label: "Front", body: teeBody(60),
      seams: [...teeSeams(60).slice(1), "M460 150 L460 330 L540 330 L540 150", "M500 196 l0 .1 M500 250 l0 .1 M500 304 l0 .1"],
      trims: ["M318 72 L268 96 L352 232 L500 150 L648 232 L732 96 L682 72 C630 138 370 138 318 72 Z"],
      area: { x: 320, y: 360, w: 360, h: 415 },
    },
    {
      key: "back", label: "Back", body: teeBody(24), seams: teeSeams(24).slice(1),
      trims: ["M318 72 L276 92 C380 150 620 150 724 92 L682 72 C630 100 370 100 318 72 Z"],
      area: { x: 290, y: 210, w: 420, h: 551 },
    },
    { key: "left-sleeve", label: "Left sleeve", body: sleeveBody, seams: ["M212 770 L812 712"], trims: [], area: { x: 380, y: 400, w: 240, h: 240 } },
    { key: "right-sleeve", label: "Right sleeve", body: sleeveBody, seams: ["M212 770 L812 712"], trims: [], area: { x: 380, y: 400, w: 240, h: 240 } },
  ],
};

const singletBody = (neck: number): Cmd[] => [
  ["M", 330, 40],
  ["L", 410, 40],
  ["C", 420, 40 + neck, 580, 40 + neck, 590, 40],
  ["L", 670, 40],
  ["C", 680, 240, 730, 330, 812, 380],
  ["C", 812, 620, 818, 900, 824, 1058],
  ["C", 700, 1086, 300, 1086, 176, 1058],
  ["C", 182, 900, 188, 620, 188, 380],
  ["C", 270, 330, 320, 240, 330, 40],
  ["Z"],
];
const sleeveless: Garment = {
  key: "sleeveless",
  name: "Sleeveless Jersey",
  sides: [
    { key: "front", label: "Front", body: singletBody(190), seams: ["M180 1034 C300 1062 700 1062 820 1034", "M352 40 C344 250 286 350 206 398", "M648 40 C656 250 714 350 794 398"], trims: [], area: { x: 310, y: 300, w: 380, h: 507 } },
    { key: "back", label: "Back", body: singletBody(70), seams: ["M180 1034 C300 1062 700 1062 820 1034", "M352 40 C344 250 286 350 206 398", "M648 40 C656 250 714 350 794 398"], trims: [], area: { x: 310, y: 190, w: 380, h: 570 } },
  ],
};

const cap: Garment = {
  key: "cap",
  name: "Cap",
  sides: [
    {
      key: "panel", label: "Front panel",
      body: [["M", 130, 690], ["C", 110, 300, 340, 150, 500, 150], ["C", 660, 150, 890, 300, 870, 690], ["C", 700, 640, 300, 640, 130, 690], ["Z"]],
      seams: ["M500 150 L500 648", "M300 214 C270 380 262 520 272 662", "M700 214 C730 380 738 520 728 662"],
      trims: ["M130 690 C300 640 700 640 870 690 C960 760 940 900 880 930 C700 850 300 850 120 930 C60 900 40 760 130 690 Z", "M470 150 a30 16 0 1 0 60 0 a30 16 0 1 0 -60 0 Z"],
      area: { x: 310, y: 330, w: 380, h: 190 },
    },
  ],
};

const toteBody: Cmd[] = [["M", 170, 380], ["L", 830, 380], ["L", 860, 1070], ["L", 140, 1070], ["Z"]];
const tote: Garment = {
  key: "tote",
  name: "Tote Bag",
  sides: (["front", "back"] as const).map((k) => ({
    key: k, label: k === "front" ? "Front" : "Back", body: toteBody,
    seams: ["M174 420 L826 420", "M330 380 C330 40 670 40 670 380", "M380 380 C380 100 620 100 620 380"],
    trims: [],
    area: { x: 270, y: 480, w: 460, h: 493 },
  })),
};

export const GARMENTS: Record<GarmentKey, Garment> = { tee, polo, sleeveless, cap, tote };

export const toSvgPath = (cmds: Cmd[]) => cmds.map((c) => (c[0] === "Z" ? "Z" : `${c[0]}${c.slice(1).join(" ")}`)).join(" ");

export const getSide = (g: GarmentKey, side: string): GarmentSide => GARMENTS[g].sides.find((s) => s.key === side) ?? GARMENTS[g].sides[0]!;

/** Relative luminance → should ink/seams on this fabric be light or dark? */
export function isDark(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const v = parseInt(m[1]!, 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.32;
}

export function shade(hex: string, amt: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1]!, 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return `#${[f((v >> 16) & 255), f((v >> 8) & 255), f(v & 255)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

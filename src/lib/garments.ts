import type { GarmentKey } from "@/content/types";

/**
 * Garment geometry — one source for the 3D hero (extruded) and SPP Studio (2D).
 * All coordinates live in a 1000 × 1120 box. Outlines are command lists rather
 * than SVG strings so they can become an SVG path, a Path2D or a THREE.Shape.
 * (The T-shirt/polo proportions descend from the previous site's canvas
 * customizer, redrawn with set-in sleeves and a curved hem.)
 *
 * Scale: shirts are drawn at roughly 0.75 mm per unit (a size-L body is about
 * 47 cm across), so the print regions below are sized from the real rules —
 * an 8 × 8 cm chest logo is a 107-unit square, a 10 × 25 cm back print a
 * 133 × 333 strip.
 */
export const GARMENT_BOX = { w: 1000, h: 1120 } as const;

export type Cmd = ["M", number, number] | ["L", number, number] | ["C", number, number, number, number, number, number] | ["Z"];
export type Rect = { x: number; y: number; w: number; h: number };
export type SideKey = "front" | "back" | "left-chest" | "right-chest" | "left-sleeve" | "right-sleeve" | "panel";

export type GarmentSide = {
  key: SideKey;
  label: string;
  body: Cmd[];
  /** seams, collars, plackets — stroked, never filled */
  seams: string[];
  /** filled trim pieces drawn over the body in a darker tone (collar, brim…) */
  trims: string[];
  /** filled pieces drawn BEHIND the body in the customer's trim colour (tote straps) */
  handles?: string[];
  /** printable region inside the box, matching the product's physical print area */
  area: Rect;
  /**
   * The physical face this region sits on when it is a small placement (a chest
   * logo lives on the front). Regions that share a face are drawn together.
   * Absent = the side is a face of its own.
   */
  view?: SideKey;
  /** all-over print: artwork is clipped to the body outline, not to `area` */
  freeFlow?: boolean;
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

/* ── Cotton print regions (the client's rule, relative to the real garment) ── */
/** 8 × 8 cm chest logo. "Left chest" is the wearer's left, which sits on the viewer's right in a front view. */
const LEFT_CHEST: Rect = { x: 566, y: 300, w: 107, h: 107 };
const RIGHT_CHEST: Rect = { x: 327, y: 300, w: 107, h: 107 };
/** 10 × 25 cm (width × height) centred down the back. */
const BACK_STRIP: Rect = { x: 433, y: 200, w: 133, h: 333 };
/** Whole-garment canvas for sublimated sports fabric: the body's bounding box. */
const TEE_ALL: Rect = { x: 4, y: 72, w: 992, h: 1008 };

const sleeves = (): GarmentSide[] => [
  { key: "left-sleeve", label: "Left sleeve", body: sleeveBody, seams: ["M212 770 L812 712"], trims: [], area: { x: 380, y: 400, w: 240, h: 240 } },
  { key: "right-sleeve", label: "Right sleeve", body: sleeveBody, seams: ["M212 770 L812 712"], trims: [], area: { x: 380, y: 400, w: 240, h: 240 } },
];

const tee: Garment = {
  key: "tee",
  name: "T-Shirt",
  sides: [
    // "front" stays first: the hero, the home plates and older saved designs address the full front by this key
    { key: "front", label: "Front", body: teeBody(96), seams: teeSeams(96), trims: [], area: { x: 300, y: 250, w: 400, h: 533 } },
    { key: "back", label: "Back", body: teeBody(30), seams: teeSeams(30), trims: [], area: BACK_STRIP },
    ...sleeves(),
    { key: "left-chest", label: "Left chest", body: teeBody(96), seams: teeSeams(96), trims: [], area: LEFT_CHEST, view: "front" },
    { key: "right-chest", label: "Right chest", body: teeBody(96), seams: teeSeams(96), trims: [], area: RIGHT_CHEST, view: "front" },
  ],
};

/** Polyester sports tee: same cut as the cotton tee, sublimated edge to edge. */
const sportsTee: Garment = {
  key: "sports-tee",
  name: "Sports T-Shirt",
  sides: [
    { key: "front", label: "Front", body: teeBody(96), seams: teeSeams(96), trims: [], area: TEE_ALL, freeFlow: true },
    { key: "back", label: "Back", body: teeBody(30), seams: teeSeams(30), trims: [], area: TEE_ALL, freeFlow: true },
  ],
};

const poloSeams = (neck: number) => teeSeams(neck).slice(1);
const poloFrontTrim = "M318 72 L268 96 L352 232 L500 150 L648 232 L732 96 L682 72 C630 138 370 138 318 72 Z";
const poloFront = (): Pick<GarmentSide, "body" | "seams" | "trims"> => ({
  body: teeBody(60),
  seams: [...poloSeams(60), "M460 150 L460 330 L540 330 L540 150", "M500 196 l0 .1 M500 250 l0 .1 M500 304 l0 .1"],
  trims: [poloFrontTrim],
});

const polo: Garment = {
  key: "polo",
  name: "Polo Shirt",
  sides: [
    { key: "front", label: "Front", ...poloFront(), area: { x: 320, y: 360, w: 360, h: 415 } },
    {
      key: "back", label: "Back", body: teeBody(24), seams: poloSeams(24),
      trims: ["M318 72 L276 92 C380 150 620 150 724 92 L682 72 C630 100 370 100 318 72 Z"],
      area: { ...BACK_STRIP, y: 210 },
    },
    ...sleeves(),
    { key: "left-chest", label: "Left chest", ...poloFront(), area: { ...LEFT_CHEST, y: 320 }, view: "front" },
    { key: "right-chest", label: "Right chest", ...poloFront(), area: { ...RIGHT_CHEST, y: 320 }, view: "front" },
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
const singletSeams = ["M180 1034 C300 1062 700 1062 820 1034", "M352 40 C344 250 286 350 206 398", "M648 40 C656 250 714 350 794 398"];
const SINGLET_ALL: Rect = { x: 176, y: 40, w: 648, h: 1040 };
const sleeveless: Garment = {
  key: "sleeveless",
  name: "Sleeveless Jersey",
  sides: [
    { key: "front", label: "Front", body: singletBody(190), seams: singletSeams, trims: [], area: SINGLET_ALL, freeFlow: true },
    { key: "back", label: "Back", body: singletBody(70), seams: singletSeams, trims: [], area: SINGLET_ALL, freeFlow: true },
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
/** One closed strap (outer curve out, inner curve back) so it can be filled in the handle colour. */
const TOTE_HANDLE = "M330 380 C330 40 670 40 670 380 L620 380 C620 100 380 100 380 380 Z";
const tote: Garment = {
  key: "tote",
  name: "Tote Bag",
  sides: (["front", "back"] as const).map((k) => ({
    key: k, label: k === "front" ? "Front" : "Back", body: toteBody,
    seams: ["M174 420 L826 420"],
    trims: [],
    handles: [TOTE_HANDLE],
    // the whole face, to within about a centimetre of the seams
    area: { x: 178, y: 396, w: 644, h: 660 },
  })),
};

export const GARMENTS: Record<GarmentKey, Garment> = { tee, "sports-tee": sportsTee, polo, sleeveless, cap, tote };

export const toSvgPath = (cmds: Cmd[]) => cmds.map((c) => (c[0] === "Z" ? "Z" : `${c[0]}${c.slice(1).join(" ")}`)).join(" ");

export const getSide = (g: GarmentKey, side: string): GarmentSide => GARMENTS[g].sides.find((s) => s.key === side) ?? GARMENTS[g].sides[0]!;

/** The face a side is drawn on: itself, or the side it is placed on (left chest → front). */
export const viewOf = (g: GarmentKey, side: string): SideKey => getSide(g, side).view ?? getSide(g, side).key;

/** Every print region that appears on one face, so a front view shows both chest logos. */
export const regionsOf = (g: GarmentKey, view: string): GarmentSide[] => GARMENTS[g].sides.filter((s) => (s.view ?? s.key) === view);

/** The physical faces of a garment (front, back, panel) — what a mockup or 3D model shows. */
export const facesOf = (g: GarmentKey): GarmentSide[] => GARMENTS[g].sides.filter((s) => !s.view && !s.key.includes("sleeve"));

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

/** Strap/rope colour for bags: the customer's choice, else a tone of the bag fabric so it reads as one piece. */
export const handleColour = (fabric: string, trim?: string | null) => trim ?? (isDark(fabric) ? shade(fabric, 0.16) : shade(fabric, -0.12));

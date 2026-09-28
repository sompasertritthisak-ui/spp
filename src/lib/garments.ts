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
 * an 8 × 8 cm chest logo is a 107-unit square, a 30 × 40 cm full front a
 * 400 × 533 panel. Caps are drawn larger (about 0.29 mm per unit).
 *
 * A sleeve is drawn as the shirt seen from the side, with the sleeve hanging in
 * front of the body, so a customer recognises what they are decorating.
 */
export const GARMENT_BOX = { w: 1000, h: 1120 } as const;

export type Cmd = ["M", number, number] | ["L", number, number] | ["C", number, number, number, number, number, number] | ["Z"];
export type Rect = { x: number; y: number; w: number; h: number };
export type SideKey = "front" | "back" | "left-chest" | "right-chest" | "upper-back" | "left-sleeve" | "right-sleeve" | "panel" | "left-side" | "right-side";

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
  /** the rest of the garment, drawn BEHIND the body a tone darker (the torso behind a sleeve) */
  backdrop?: string[];
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

export function toSvgPath(cmds: Cmd[]) {
  return cmds.map((c) => (c[0] === "Z" ? "Z" : `${c[0]}${c.slice(1).join(" ")}`)).join(" ");
}

/** Mirror left ↔ right inside the box: a right sleeve is a left sleeve seen from the other side. */
export const flip = (cmds: Cmd[]): Cmd[] => cmds.map((c) => {
  if (c[0] === "Z") return c;
  const n = c.slice(1) as number[];
  return [c[0], ...n.map((v, i) => (i % 2 === 0 ? GARMENT_BOX.w - v : v))] as Cmd;
});
const flipRect = (r: Rect): Rect => ({ ...r, x: GARMENT_BOX.w - r.x - r.w });

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

/* ── Sleeve view ─────────────────────────────────────────────────────────────
   The shirt seen from the wearer's LEFT (chest towards the viewer's left, back
   towards the right) at the same scale as the front view. The sleeve is the
   printable piece; the torso, collar and hem are there for context. */
const SLEEVE: Cmd[] = [
  ["M", 372, 452],
  ["C", 360, 380, 356, 290, 372, 226], // front edge
  ["C", 392, 160, 450, 128, 510, 128], // over the shoulder
  ["C", 572, 128, 630, 164, 646, 232],
  ["C", 658, 296, 650, 384, 634, 448], // back edge
  ["C", 590, 476, 420, 480, 372, 452], // cuff opening
  ["Z"],
];
const SIDE_TORSO: Cmd[] = [
  ["M", 418, 104],
  ["C", 376, 140, 330, 200, 306, 290], // front of the shoulder
  ["C", 288, 370, 284, 470, 290, 580], // chest
  ["C", 292, 760, 290, 920, 286, 1052],
  ["C", 380, 1084, 620, 1084, 714, 1052], // hem
  ["C", 712, 900, 714, 720, 712, 560],
  ["C", 712, 400, 700, 260, 664, 170], // upper back
  ["C", 644, 124, 616, 84, 586, 62],
  ["C", 530, 50, 458, 66, 418, 104], // neck opening, lower at the front
  ["Z"],
];
const SIDE_RIB: Cmd[] = [["M", 418, 104], ["C", 458, 66, 530, 50, 586, 62], ["L", 593, 83], ["C", 540, 72, 470, 85, 433, 123], ["Z"]];
const SIDE_NECK: Cmd[] = [["M", 433, 123], ["C", 470, 85, 540, 72, 593, 83], ["C", 566, 104, 486, 118, 433, 123], ["Z"]];
const SIDE_COLLAR: Cmd[] = [["M", 410, 108], ["C", 452, 62, 532, 40, 594, 52], ["L", 614, 102], ["C", 574, 88, 528, 90, 490, 104], ["L", 410, 152], ["Z"]];
const SIDE_SEAMS: Cmd[][] = [
  [["M", 376, 424], ["C", 424, 452, 590, 448, 638, 420]], // cuff hem
  [["M", 500, 486], ["L", 500, 1074]], // side seam
  [["M", 288, 1028], ["C", 380, 1060, 620, 1060, 712, 1028]], // hem stitch
  [["M", 506, 58], ["L", 510, 128]], // shoulder seam
];
const SIDE_CUFF_RIB: Cmd[] = [["M", 374, 396], ["C", 424, 424, 590, 420, 642, 392]];
/** 10 × 10 cm on the outside of the sleeve. */
const SLEEVE_AREA: Rect = { x: 438, y: 238, w: 134, h: 134 };
/** Sublimated sleeves are printed edge to edge: the sleeve's own bounding box. */
const SLEEVE_ALL: Rect = { x: 354, y: 126, w: 306, h: 356 };

type SleeveOpts = { collar?: boolean; freeFlow?: boolean };
const sleeve = (which: "left" | "right", { collar = false, freeFlow = false }: SleeveOpts = {}): GarmentSide => {
  const m = which === "left" ? (c: Cmd[]) => c : flip;
  const area = freeFlow ? SLEEVE_ALL : SLEEVE_AREA;
  return {
    key: `${which}-sleeve`,
    label: which === "left" ? "Left sleeve" : "Right sleeve",
    body: m(SLEEVE),
    backdrop: [toSvgPath(m(SIDE_TORSO))],
    // the inside of the neck shows behind the rib or collar, so the opening reads as an opening
    trims: [toSvgPath(m(SIDE_NECK)), toSvgPath(m(collar ? SIDE_COLLAR : SIDE_RIB))],
    seams: [...SIDE_SEAMS, ...(collar ? [SIDE_CUFF_RIB] : [])].map((c) => toSvgPath(m(c))),
    area: which === "left" ? area : flipRect(area),
    ...(freeFlow ? { freeFlow: true } : {}),
  };
};
const sleeves = (o?: SleeveOpts): GarmentSide[] => [sleeve("left", o), sleeve("right", o)];

/* ── Cotton print regions (the client's rule, relative to the real garment) ── */
/** 8 × 8 cm chest logo. "Left chest" is the wearer's left, which sits on the viewer's right in a front view. */
const LEFT_CHEST: Rect = { x: 566, y: 300, w: 107, h: 107 };
const RIGHT_CHEST: Rect = { x: 327, y: 300, w: 107, h: 107 };
/** 30 × 40 cm: the full front or back panel of a shirt. */
const FULL_FRONT: Rect = { x: 300, y: 250, w: 400, h: 533 };
const FULL_BACK: Rect = { x: 300, y: 215, w: 400, h: 533 };
/** 25 × 10 cm across the shoulders, under the collar: a name, a team, a slogan. */
const UPPER_BACK: Rect = { x: 333, y: 128, w: 334, h: 134 };
/** Whole-garment canvas for sublimated sports fabric: the body's bounding box. */
const TEE_ALL: Rect = { x: 4, y: 72, w: 992, h: 1008 };

const tee: Garment = {
  key: "tee",
  name: "T-Shirt",
  sides: [
    // "front" stays first: the hero, the home plates and older saved designs address the full front by this key
    { key: "front", label: "Front", body: teeBody(96), seams: teeSeams(96), trims: [], area: FULL_FRONT },
    { key: "back", label: "Back", body: teeBody(30), seams: teeSeams(30), trims: [], area: FULL_BACK },
    ...sleeves(),
    { key: "left-chest", label: "Left chest", body: teeBody(96), seams: teeSeams(96), trims: [], area: LEFT_CHEST, view: "front" },
    { key: "right-chest", label: "Right chest", body: teeBody(96), seams: teeSeams(96), trims: [], area: RIGHT_CHEST, view: "front" },
    { key: "upper-back", label: "Upper back", body: teeBody(30), seams: teeSeams(30), trims: [], area: UPPER_BACK, view: "back" },
  ],
};

/** Polyester sports tee: same cut as the cotton tee, sublimated edge to edge. */
const sportsTee: Garment = {
  key: "sports-tee",
  name: "Sports T-Shirt",
  sides: [
    { key: "front", label: "Front", body: teeBody(96), seams: teeSeams(96), trims: [], area: TEE_ALL, freeFlow: true },
    { key: "back", label: "Back", body: teeBody(30), seams: teeSeams(30), trims: [], area: TEE_ALL, freeFlow: true },
    ...sleeves({ freeFlow: true }),
  ],
};

const poloSeams = (neck: number) => teeSeams(neck).slice(1);
const poloFrontTrim = "M318 72 L268 96 L352 232 L500 150 L648 232 L732 96 L682 72 C630 138 370 138 318 72 Z";
const poloFront = (): Pick<GarmentSide, "body" | "seams" | "trims"> => ({
  body: teeBody(60),
  seams: [...poloSeams(60), "M460 150 L460 330 L540 330 L540 150", "M500 196 l0 .1 M500 250 l0 .1 M500 304 l0 .1"],
  trims: [poloFrontTrim],
});

const poloBack = (): Pick<GarmentSide, "body" | "seams" | "trims"> => ({
  body: teeBody(24),
  seams: poloSeams(24),
  trims: ["M318 72 L276 92 C380 150 620 150 724 92 L682 72 C630 100 370 100 318 72 Z"],
});

const polo: Garment = {
  key: "polo",
  name: "Polo Shirt",
  sides: [
    // below the placket: 27 × 30 cm
    { key: "front", label: "Front", ...poloFront(), area: { x: 320, y: 365, w: 360, h: 400 } },
    { key: "back", label: "Back", ...poloBack(), area: { ...FULL_BACK, y: 240 } },
    ...sleeves({ collar: true }),
    { key: "left-chest", label: "Left chest", ...poloFront(), area: { ...LEFT_CHEST, y: 320 }, view: "front" },
    { key: "right-chest", label: "Right chest", ...poloFront(), area: { ...RIGHT_CHEST, y: 320 }, view: "front" },
    { key: "upper-back", label: "Upper back", ...poloBack(), area: { ...UPPER_BACK, y: 160 }, view: "back" },
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

/* ── Cap ─────────────────────────────────────────────────────────────────────
   Front panel, both side panels and the back above the strap. The side view is
   the cap seen from the wearer's LEFT, brim pointing to the viewer's left. */
const CAP_DOME: Cmd[] = [["M", 130, 690], ["C", 110, 300, 340, 150, 500, 150], ["C", 660, 150, 890, 300, 870, 690], ["C", 700, 640, 300, 640, 130, 690], ["Z"]];
const CAP_BUTTON = "M470 150 a30 16 0 1 0 60 0 a30 16 0 1 0 -60 0 Z";
const CAP_SIDE: Cmd[] = [["M", 236, 706], ["C", 222, 430, 372, 236, 560, 236], ["C", 748, 236, 872, 420, 868, 724], ["C", 700, 700, 420, 692, 236, 706], ["Z"]];
const CAP_SIDE_BRIM: Cmd[] = [["M", 240, 700], ["C", 170, 700, 70, 736, 22, 806], ["C", 12, 824, 30, 838, 52, 830], ["C", 130, 798, 200, 776, 262, 766], ["C", 250, 746, 244, 724, 240, 700], ["Z"]];
const CAP_SIDE_BUTTON: Cmd[] = [["M", 530, 236], ["C", 530, 216, 590, 216, 590, 236], ["C", 590, 250, 530, 250, 530, 236], ["Z"]];
const CAP_SIDE_SEAMS: Cmd[][] = [
  [["M", 560, 240], ["C", 470, 330, 420, 510, 414, 694]], // front panel seam
  [["M", 560, 240], ["C", 660, 340, 720, 530, 728, 706]], // back panel seam
  [["M", 240, 676], ["C", 420, 662, 700, 670, 866, 694]], // sweatband stitch
];
const CAP_SIDE_AREA: Rect = { x: 468, y: 470, w: 207, h: 138 }; // 6 × 4 cm
const capSide = (which: "left" | "right"): GarmentSide => {
  const m = which === "left" ? (c: Cmd[]) => c : flip;
  return {
    key: `${which}-side`,
    label: which === "left" ? "Left side" : "Right side",
    body: m(CAP_SIDE),
    trims: [toSvgPath(m(CAP_SIDE_BRIM)), toSvgPath(m(CAP_SIDE_BUTTON))],
    seams: CAP_SIDE_SEAMS.map((c) => toSvgPath(m(c))),
    area: which === "left" ? CAP_SIDE_AREA : flipRect(CAP_SIDE_AREA),
  };
};

const cap: Garment = {
  key: "cap",
  name: "Cap",
  sides: [
    {
      key: "panel", label: "Front panel",
      body: CAP_DOME,
      seams: ["M500 150 L500 648", "M300 214 C270 380 262 520 272 662", "M700 214 C730 380 738 520 728 662"],
      trims: ["M130 690 C300 640 700 640 870 690 C960 760 940 900 880 930 C700 850 300 850 120 930 C60 900 40 760 130 690 Z", CAP_BUTTON],
      area: { x: 310, y: 330, w: 380, h: 190 },
    },
    {
      key: "back", label: "Back",
      body: CAP_DOME,
      // the strap opening and the strap across it
      seams: ["M500 150 L500 520", "M300 214 C270 380 262 520 272 662", "M700 214 C730 380 738 520 728 662", "M392 622 L608 622", "M392 642 L608 642"],
      trims: ["M392 652 C392 486 608 486 608 652 C540 642 460 642 392 652 Z", CAP_BUTTON],
      area: { x: 380, y: 352, w: 241, h: 103 }, // 7 × 3 cm, above the opening
    },
    capSide("left"),
    capSide("right"),
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

export const getSide = (g: GarmentKey, side: string): GarmentSide => GARMENTS[g].sides.find((s) => s.key === side) ?? GARMENTS[g].sides[0]!;

/** The face a side is drawn on: itself, or the side it is placed on (left chest → front). */
export const viewOf = (g: GarmentKey, side: string): SideKey => getSide(g, side).view ?? getSide(g, side).key;

/** Every print region that appears on one face, so a front view shows both chest logos. */
export const regionsOf = (g: GarmentKey, view: string): GarmentSide[] => GARMENTS[g].sides.filter((s) => (s.view ?? s.key) === view);

/**
 * How a sleeve print sits on the flat front / back outline, for the 3D model.
 * The outside of the arm is the sleeve's upper fold, so a sleeve print is
 * centred on that fold and wraps onto the front and the back of the sleeve.
 * Coordinates are the wearer's LEFT sleeve as drawn in the FRONT view (the
 * viewer's right); mirror them for the other sleeve and for the back view.
 */
export type SleeveWrap = {
  /** the fold, from the shoulder point down to the cuff */
  shoulder: [number, number]; cuff: [number, number];
  /** the underarm seam: where it meets the body, and where it ends at the cuff */
  armpit: [number, number]; underarm: [number, number];
  /** the armhole seam, from the armpit up to the shoulder point */
  armhole: Cmd[];
  /** across the flat sleeve, from the fold to the underarm seam */
  width: number;
  /** the sleeve alone: artwork must never spill onto the body */
  clip: Cmd[];
  /** the same sleeve in its side view: the line the fold follows and where it starts and ends */
  view: { centre: number; top: number; bottom: number; reach: number };
};
const TEE_SLEEVE_WRAP: SleeveWrap = {
  shoulder: [900, 150], cuff: [996, 398], armpit: [814, 362], underarm: [852, 458], width: 156,
  armhole: [["M", 814, 362], ["C", 804, 300, 824, 210, 900, 150]],
  clip: [["M", 900, 150], ["L", 996, 398], ["L", 852, 458], ["L", 814, 362], ["C", 804, 300, 824, 210, 900, 150], ["Z"]],
  view: { centre: 505, top: 128, bottom: 466, reach: 160 },
};
export const sleeveWrapOf = (g: GarmentKey): SleeveWrap | null => (g === "tee" || g === "polo" || g === "sports-tee" ? TEE_SLEEVE_WRAP : null);

/** A profile view: a sleeve or the side of a cap. Shown beside the main faces, never as one of them. */
export const isProfile = (key: string) => key.endsWith("-sleeve") || key.endsWith("-side");

/** The physical faces of a garment (front, back, panel) — what a mockup or 3D model shows. */
export const facesOf = (g: GarmentKey): GarmentSide[] => GARMENTS[g].sides.filter((s) => !s.view && !isProfile(s.key));

/** Every view a customer can open in the Studio, in the garment's own order: front, back, sleeves… */
export const viewsOf = (g: GarmentKey): GarmentSide[] => GARMENTS[g].sides.filter((s) => !s.view);

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

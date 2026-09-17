import type { PrintMethod } from "@/content/types";

/** Customers do not know printing terms. Every method gets a plain-language line: what it is, what it suits. */
export const METHODS: Record<PrintMethod, { label: string; short: string; plain: string; bestFor: string }> = {
  screen: { label: "Screen printing", short: "Screen", plain: "Ink is pushed through a fine mesh stencil, one colour at a time. Bold, opaque and very durable.", bestFor: "Logos and artwork with a few solid colours, in larger quantities." },
  dtf: { label: "DTF transfer", short: "DTF", plain: "Your artwork is printed in full colour onto a film, then heat-pressed onto the fabric.", bestFor: "Photos, gradients and many colours — and smaller runs." },
  sublimation: { label: "Sublimation", short: "Sublimation", plain: "Heat turns the ink into gas that dyes the fibre itself, so there is nothing on the surface to crack or peel.", bestFor: "All-over prints on polyester sportswear, flags and soft goods." },
  embroidery: { label: "Embroidery", short: "Embroidery", plain: "Your logo is stitched into the fabric with thread. Textured, premium and long-lasting.", bestFor: "Chest logos on polos, caps and uniforms." },
  uv: { label: "UV printing", short: "UV", plain: "Ink is cured instantly by ultraviolet light, so it bonds to rigid materials like acrylic, metal and board.", bestFor: "Signs, panels and hard surfaces." },
  offset: { label: "Offset printing", short: "Offset", plain: "The traditional press: plates transfer ink to paper with very consistent colour across long runs.", bestFor: "Flyers, menus and stationery in volume." },
  "large-format": { label: "Large-format printing", short: "Large format", plain: "Wide roll printers with weather-resistant inks, for anything measured in metres.", bestFor: "Banners, billboards, wraps and wall graphics." },
  "vinyl-cut": { label: "Cut vinyl", short: "Cut vinyl", plain: "Coloured adhesive film is cut to the exact shape of your lettering or logo and applied by hand.", bestFor: "Shop windows, vehicle lettering and sign faces." },
};

import type { FeatureFlags, SiteSettings } from "../types";

/**
 * Carried over from the previous site: legal name, founding year, email and
 * Facebook handle. The previous site had a placeholder phone number, so phone
 * and WhatsApp are intentionally EMPTY here — the UI hides those channels
 * until SPP enters real numbers in Command Center → Settings.
 */
export const settings: SiteSettings = {
  companyName: "SPP",
  legalName: "SPP Sole Co., Ltd",
  tagline: "Design it. Visualise it. Make it real.",
  description:
    "SPP is a Laos-based creative production company. From custom clothing and printed materials to signage, billboards and complete brand campaigns, we turn ideas into physical experiences.",
  foundedYear: 2014,
  address: {
    line1: "Vientiane Capital",
    city: "Vientiane",
    country: "Lao PDR",
    lat: 17.9757,
    lng: 102.6331,
  },
  phone: "",
  whatsapp: "",
  email: "info@sppsole.la",
  hours: [
    { days: "Monday – Friday", time: "08:30 – 17:30" },
    { days: "Saturday", time: "08:30 – 12:00" },
  ],
  social: [{ platform: "facebook", url: "https://facebook.com/SPPSoleLao", handle: "SPPSoleLao" }],
  seo: {
    titleTemplate: "%s — SPP",
    defaultTitle: "SPP — Custom Apparel, Printing & Billboard Advertising in Laos",
    defaultDescription:
      "Design, visualise and produce custom T-shirts, uniforms, printed materials, signage and billboard campaigns across Laos. Open SPP Studio and see your idea before it is made.",
    keywords: [
      "custom t-shirt Laos",
      "printing services Laos",
      "clothing printing Vientiane",
      "billboard advertising Vientiane",
      "billboard rental Laos",
      "promotional products Laos",
      "custom uniforms Laos",
      "signage Vientiane",
    ],
  },
};

export const flags: FeatureFlags = {
  AI_DESIGN: true,
  MOCKUP_STUDIO: true,
  BILLBOARD_BOOKING: true,
  ONLINE_PRICING: true,
  PREORDERS: false,
  CUSTOMER_PORTAL: true,
  PAYMENTS: false,
  PRODUCTION_WORKFLOW: true,
};

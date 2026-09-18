import type { FeatureFlags, SiteSettings } from "../types";

/**
 * Company facts as printed on SPP's own product brochure (2026): legal name in
 * Lao and English, the Nakham Village address, office and mobile numbers, the
 * Yahoo address and the Facebook page name. Anything SPP changes later is
 * edited in Command Center → Settings → Company & contact, not here.
 *
 * Two items to confirm with SPP (they are real, not placeholders):
 *  · WhatsApp is assumed to be on the mobile number printed on the brochure.
 *  · The Facebook page is printed by name only; the link below opens a
 *    Facebook search for that name until SPP supplies the page URL.
 * The map pin is the centre of Nakham Village (OpenStreetMap), not the exact
 * gate — adjust the coordinates in Settings.
 */
const FACEBOOK_PAGE = "ບໍລິສັດ SPP ການພິມແລະສື່ໂຄສະນາ";

export const settings: SiteSettings = {
  companyName: "SPP",
  legalName: "SPP Sole Co., Ltd",
  legalNameLo: "ບໍລິສັດ ເອັສພີພີ ຈຳກັດຜູ້ດຽວ",
  tagline: "Design it. Visualise it. Make it real.",
  description:
    "SPP is a Laos-based creative production company. From custom clothing and printed materials to signage, billboards and complete brand campaigns, we turn ideas into physical experiences.",
  foundedYear: 2014,
  address: {
    line1: "Asian Road (T2), Nakham Village, Sikhottabong District",
    city: "Vientiane Capital",
    country: "Lao PDR",
    lat: 17.9732,
    lng: 102.5886,
  },
  phone: "+8562055518882",
  landline: "+85621550226",
  whatsapp: "+8562055518882",
  email: "spp_sole@yahoo.com",
  hours: [
    { days: "Monday – Friday", time: "08:30 – 17:30" },
    { days: "Saturday", time: "08:30 – 12:00" },
  ],
  social: [{ platform: "facebook", url: `https://www.facebook.com/search/pages/?q=${encodeURIComponent(FACEBOOK_PAGE)}`, handle: FACEBOOK_PAGE }],
  logo: { wordmark: null, wordmarkOnPaper: null, icon: null },
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

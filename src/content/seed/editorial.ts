import type { BlogPost, Bundle, DesignTemplate, Faq, PortfolioProject, Solution, Testimonial } from "../types";

export const solutions: Solution[] = [
  {
    slug: "launch-a-business",
    goal: "Launch a Business",
    prompt: "I'm opening something new.",
    summary: "Everything a new brand needs to look established on day one.",
    order: 1,
    bundle: "starter-brand-package",
    recommend: [
      { group: "Apparel", items: [{ label: "Staff polo shirts", product: "polo-shirt" }, { label: "Launch-day T-shirts", product: "custom-t-shirt" }] },
      { group: "Print", items: [{ label: "Flyers & posters", product: "poster" }, { label: "Business cards & stationery", note: "Quoted with your print run" }] },
      { group: "Display", items: [{ label: "A-board for the entrance", product: "a-board" }, { label: "Opening J-flags", product: "j-flag" }] },
      { group: "Outdoor", items: [{ label: "Shopfront signage", product: "led-signage" }] },
    ],
  },
  {
    slug: "open-a-restaurant",
    goal: "Open a Restaurant",
    prompt: "I'm opening a restaurant or café.",
    summary: "From the uniform to the cup in a customer's hand to the sign they found you by.",
    order: 2,
    bundle: "restaurant-launch-package",
    recommend: [
      { group: "Apparel", items: [{ label: "Staff polos", product: "polo-shirt" }, { label: "Kitchen tees & aprons", product: "custom-t-shirt", note: "Aprons quoted on request" }, { label: "Caps", product: "sports-cap" }] },
      { group: "Promotional", items: [{ label: "Printed cups & sleeves", product: "cup-print" }, { label: "Takeaway totes", product: "tote-bag" }, { label: "Terrace parasols", product: "umbrella" }] },
      { group: "Print", items: [{ label: "Menus, posters & flyers", product: "poster" }] },
      { group: "Outdoor", items: [{ label: "Illuminated shopfront sign", product: "led-signage" }, { label: "Neighbourhood billboard", product: "billboard-rental" }, { label: "Delivery vehicle branding", product: "vehicle-wrap" }] },
      { group: "Digital", items: [{ label: "QR menu & campaign tracking", note: "Included with outdoor bookings" }] },
    ],
  },
  {
    slug: "staff-uniforms",
    goal: "Create Staff Uniforms",
    prompt: "My team needs to look like a team.",
    summary: "Consistent, comfortable, re-orderable uniforms with your sizes kept on file.",
    order: 3,
    bundle: "corporate-uniform-package",
    recommend: [
      { group: "Apparel", items: [{ label: "Embroidered polos", product: "polo-shirt" }, { label: "Casual-day tees", product: "custom-t-shirt" }, { label: "Caps", product: "sports-cap" }, { label: "UV arm sleeves for field staff", product: "uv-arm-sleeve" }] },
      { group: "Promotional", items: [{ label: "Branded masks", product: "fabric-face-mask" }] },
    ],
  },
  {
    slug: "promote-an-event",
    goal: "Promote an Event",
    prompt: "I have an event coming up.",
    summary: "Be impossible to miss before the day, and unforgettable on it.",
    order: 4,
    bundle: "event-package",
    recommend: [
      { group: "Apparel", items: [{ label: "Event & crew T-shirts", product: "custom-t-shirt" }] },
      { group: "Display", items: [{ label: "J-flags", product: "j-flag" }, { label: "Registration counter", product: "promo-counter" }, { label: "Roll-ups & backdrops", product: "vinyl-banner" }] },
      { group: "Print", items: [{ label: "Posters & programmes", product: "poster" }] },
      { group: "Promotional", items: [{ label: "Delegate tote bags", product: "tote-bag" }] },
      { group: "Outdoor", items: [{ label: "Countdown billboard", product: "billboard-rental" }] },
    ],
  },
  {
    slug: "advertise-outdoors",
    goal: "Advertise Outdoors",
    prompt: "I want to be seen across the city.",
    summary: "Pick sites on the map, preview your artwork in place, and measure the response.",
    order: 5,
    bundle: "billboard-campaign-package",
    recommend: [
      { group: "Outdoor", items: [{ label: "Billboard sites", product: "billboard-rental" }, { label: "Fleet & vehicle branding", product: "vehicle-wrap" }, { label: "Shopfront & LED signage", product: "led-signage" }] },
      { group: "Digital", items: [{ label: "QR campaign tracking", note: "Scans → visits → leads, per site" }] },
    ],
  },
  {
    slug: "sports-team",
    goal: "Create Sports Team Apparel",
    prompt: "We need a kit.",
    summary: "Sublimated kits with names and numbers, re-orderable when the squad grows.",
    order: 6,
    bundle: "sports-team-package",
    recommend: [
      { group: "Apparel", items: [{ label: "Match jerseys", product: "sleeveless-jersey" }, { label: "Training tees", product: "custom-t-shirt" }, { label: "Caps", product: "sports-cap" }, { label: "Arm sleeves", product: "uv-arm-sleeve" }] },
      { group: "Display", items: [{ label: "Pitch-side J-flags & banners", product: "j-flag" }] },
    ],
  },
  {
    slug: "promote-a-school",
    goal: "Promote a School",
    prompt: "I represent a school or university.",
    summary: "Uniforms, open-day materials and the outdoor presence that fills a classroom.",
    order: 7,
    recommend: [
      { group: "Apparel", items: [{ label: "PE kit & house shirts", product: "custom-t-shirt" }, { label: "Staff polos", product: "polo-shirt" }] },
      { group: "Print", items: [{ label: "Prospectus, posters & flyers", product: "poster" }] },
      { group: "Display", items: [{ label: "Open-day flags, roll-ups & counters", product: "vinyl-banner" }] },
      { group: "Outdoor", items: [{ label: "Admissions-season billboard", product: "billboard-rental" }, { label: "School bus branding", product: "vehicle-wrap" }] },
    ],
  },
  {
    slug: "promotional-merchandise",
    goal: "Create Promotional Merchandise",
    prompt: "I need giveaways people keep.",
    summary: "Useful objects, well made, that carry your brand for years.",
    order: 8,
    recommend: [
      { group: "Promotional", items: [{ label: "Tote bags", product: "tote-bag" }, { label: "Umbrellas", product: "umbrella" }, { label: "Pillows & blankets", product: "fleece-blanket" }, { label: "Printed cups", product: "cup-print" }] },
      { group: "Apparel", items: [{ label: "Caps", product: "sports-cap" }, { label: "T-shirts", product: "custom-t-shirt" }] },
    ],
  },
  {
    slug: "brand-a-vehicle",
    goal: "Brand a Vehicle",
    prompt: "I want my vehicles working for me.",
    summary: "From a single delivery bike to a full fleet roll-out.",
    order: 9,
    recommend: [{ group: "Outdoor", items: [{ label: "Full & partial wraps", product: "vehicle-wrap" }, { label: "Matching depot signage", product: "led-signage" }] }],
  },
];

export const bundles: Bundle[] = [
  { slug: "starter-brand-package", name: "Starter Brand Package", summary: "Look established from the first day of trading.", discountPct: 8, featured: true, items: [{ product: "polo-shirt", qty: 24 }, { product: "custom-t-shirt", qty: 24 }, { product: "poster", qty: 200, note: "A4 flyers" }, { product: "a-board", qty: 1 }] },
  { slug: "restaurant-launch-package", name: "Restaurant Launch Package", summary: "Uniforms, cups, totes and the sign over the door.", discountPct: 10, featured: true, items: [{ product: "polo-shirt", qty: 20 }, { product: "sports-cap", qty: 20 }, { product: "cup-print", qty: 5000 }, { product: "tote-bag", qty: 200 }, { product: "a-board", qty: 1 }, { product: "led-signage", qty: 1 }] },
  { slug: "corporate-uniform-package", name: "Corporate Uniform Package", summary: "Embroidered polos and caps with sizes kept on file for re-orders.", discountPct: 7, featured: false, items: [{ product: "polo-shirt", qty: 100 }, { product: "sports-cap", qty: 50 }, { product: "custom-t-shirt", qty: 50 }] },
  { slug: "event-package", name: "Event Package", summary: "Crew shirts, flags, counter and backdrop — delivered together.", discountPct: 8, featured: true, items: [{ product: "custom-t-shirt", qty: 100 }, { product: "j-flag", qty: 4 }, { product: "promo-counter", qty: 1 }, { product: "vinyl-banner", qty: 2, note: "Roll-up stands" }, { product: "tote-bag", qty: 200 }] },
  { slug: "billboard-campaign-package", name: "Billboard Campaign Package", summary: "Three sites, one artwork system, QR tracking on every face.", discountPct: 12, featured: true, items: [{ product: "billboard-rental", qty: 3, note: "3 sites × 3 months" }, { product: "vinyl-banner", qty: 3, note: "Print & install per site" }] },
  { slug: "sports-team-package", name: "Sports Team Package", summary: "Match kit, training tees and caps for a full squad.", discountPct: 8, featured: false, items: [{ product: "sleeveless-jersey", qty: 25 }, { product: "custom-t-shirt", qty: 25 }, { product: "sports-cap", qty: 25 }] },
];

/**
 * SAMPLE case studies. These are illustrative projects with fictional clients,
 * flagged `isSample` and labelled as such in the UI, so the portfolio section
 * has real structure for SPP to replace with genuine work in the CMS. No real
 * company is named and no testimonials are seeded.
 */
export const portfolio: PortfolioProject[] = [
  {
    slug: "sample-riverside-cafe-launch",
    title: "A café that looked ten years old on day one",
    client: "Riverside Café (sample)",
    sector: "Food & Beverage",
    year: 2026,
    services: ["Graphic Design", "Apparel", "Cup Printing", "Signage", "Billboard"],
    summary: "Uniforms, cups, a lit shopfront and one well-placed billboard — planned as a single launch.",
    isSample: true,
    featured: true,
    palette: ["#1f5a3d", "#e6dcc5", "#ffd60a"],
    study: [
      { heading: "The Client", body: "An independent café opening on a competitive riverside strip, with six staff and a four-week runway." },
      { heading: "The Challenge", body: "New venues on the strip tend to look temporary for their first year: mismatched shirts, a vinyl banner for a sign, plain cups. The owner wanted to open looking permanent." },
      { heading: "The Idea", body: "Treat the launch as one campaign rather than five purchases. One green, one typeface, one mark — on everything a customer touches or sees." },
      { heading: "The Approach", body: "We started in SPP Studio with the owner in the room, building the polo front and back live. That approved mockup became the reference for every other item." },
      { heading: "The Design", body: "A deep forest polo with cream chest embroidery; cream cups with a single-colour green print; a halo-lit fascia sign drawn to the building's actual proportions." },
      { heading: "The Production", body: "Embroidery, cup screen-printing and sign fabrication ran in parallel under one job number, each passing the same QC checklist before delivery." },
      { heading: "The Result", body: "Everything arrived together, three days before opening. The billboard went live the same week with a QR code to the menu." },
      { heading: "The Impact", body: "A sample of how the platform reports a campaign: scans, visits and enquiries attributed to each physical touchpoint." },
    ],
    impact: [
      { value: "5", label: "product lines, one job number" },
      { value: "4 wks", label: "brief to opening day" },
      { value: "1", label: "approval round" },
    ],
  },
  {
    slug: "sample-provincial-football-league",
    title: "Twelve clubs, one kit system",
    client: "Provincial Football League (sample)",
    sector: "Sport",
    year: 2026,
    services: ["Apparel", "Sublimation", "Event Display"],
    summary: "A templated kit system so every club gets its own colours without starting from zero.",
    isSample: true,
    featured: true,
    palette: ["#2a35d6", "#f5f5f2", "#d4302b"],
    study: [
      { heading: "The Client", body: "A regional league organising kit for twelve clubs and around three hundred players." },
      { heading: "The Challenge", body: "Twelve separate design conversations, three hundred names and numbers, and one fixed kick-off date." },
      { heading: "The Idea", body: "One Studio template, twelve colourways. Clubs pick colours and upload a crest; the structure stays consistent and production stays predictable." },
      { heading: "The Approach", body: "Each club received a private design link. Approved designs flowed straight into quotes with player lists attached." },
      { heading: "The Production", body: "All-over sublimation with individual names and numbers, batched by club and checked against the roster at QC." },
      { heading: "The Result", body: "Kits delivered club by club ahead of the opening fixture, with re-order configurations saved for mid-season signings." },
    ],
    impact: [
      { value: "12", label: "clubs on one template" },
      { value: "300+", label: "personalised jerseys" },
      { value: "0", label: "roster errors at QC" },
    ],
  },
  {
    slug: "sample-telecom-highway-campaign",
    title: "Five provinces, one message, measured",
    client: "National Telecom Brand (sample)",
    sector: "Telecommunications",
    year: 2025,
    services: ["Billboard Network", "Large-Format Print", "QR Tracking"],
    summary: "A multi-site billboard campaign with a different QR code on every face.",
    isSample: true,
    featured: false,
    palette: ["#ffd60a", "#17171a", "#00aeef"],
    study: [
      { heading: "The Client", body: "A national brand launching a data package outside the capital." },
      { heading: "The Challenge", body: "Outdoor advertising is usually bought on faith. The marketing team needed to show which sites earned their cost." },
      { heading: "The Idea", body: "Give every billboard face its own tracked QR code, and report scans, visits and sign-ups per location." },
      { heading: "The Approach", body: "Sites were shortlisted on the SPP Outdoor Network map, with artwork previewed on each structure before booking." },
      { heading: "The Result", body: "A per-site performance table the client could use to renew the strongest locations and release the weakest." },
    ],
    impact: [
      { value: "5", label: "provinces covered" },
      { value: "8", label: "faces, individually tracked" },
      { value: "Per-site", label: "response reporting" },
    ],
  },
];

export const testimonials: Testimonial[] = [];

export const faqs: Faq[] = [
  { topic: "ordering", q: "What is the minimum order?", a: "It depends on the product and the print method. Most apparel starts at 12 pieces, caps at 12, totes at 50 and printed cups at 1,000. Signage, billboards and vehicle branding have no minimum. Each product page shows its own minimum." },
  { topic: "ordering", q: "How do I get a price?", a: "Where we can, the site shows an instant estimate that updates with your quantity and print choices. For everything else, send a quote request — it takes about a minute and arrives with your design attached. An estimate is a guide; your written quote from SPP is the price." },
  { topic: "ordering", q: "How long does production take?", a: "Typical lead times are shown on each product. Most apparel is 5–14 working days from artwork approval. Rush production is often possible — tell us your date in the quote request." },
  { topic: "artwork", q: "What artwork files do you need?", a: "Vector files (AI, PDF, SVG, EPS) are ideal. For images, send the largest PNG or JPG you have. SPP Studio checks your upload and tells you if it looks too small for the print size — that check is advisory, and our team reviews every file before production." },
  { topic: "artwork", q: "I don't have a logo or a design. Can you help?", a: "Yes. Choose 'I need design help' in any quote or project form, or book a consultation. Our designers work from a sketch, a reference, or just a conversation." },
  { topic: "studio", q: "Is the Studio mockup exactly what I will receive?", a: "It is a close visual guide to placement, scale and colour. Screens and fabric show colour differently, so we confirm final colours and send a production proof for approval before anything is printed." },
  { topic: "studio", q: "Why is there a watermark on my download?", a: "Downloads are preview-resolution mockups stamped with your Design ID so our team can find your exact design instantly. Your original uploaded artwork stays private to your account." },
  { topic: "billboards", q: "Does requesting a billboard confirm my booking?", a: "No. A request holds nothing automatically. Our team checks availability for your dates and replies with a confirmation and contract. You will receive a booking reference immediately so you can follow up." },
  { topic: "billboards", q: "What is included in the billboard price?", a: "The guide price is the monthly site rental. Artwork design, printing and installation are quoted alongside it, and multi-site or long-term bookings are discounted." },
  { topic: "delivery", q: "Do you deliver outside Vientiane?", a: "Yes, we ship to every province. Delivery is quoted with your order. Signage and billboard installation is carried out by our own crews nationwide." },
];

export const posts: BlogPost[] = [
  {
    slug: "screen-dtf-or-sublimation",
    title: "Screen, DTF or sublimation? Choosing the right print for your shirts",
    excerpt: "Three print methods, three different strengths. A plain-language guide to which one your design actually needs.",
    date: "2026-08-20",
    readMins: 5,
    tag: "Guides",
    body: `Most customers ask for "printing". There are really three different processes behind that word, and picking the right one is the difference between a shirt that lasts and one that cracks by the rainy season.

## Screen printing
Ink is pushed through a mesh stencil, one colour at a time. It gives the most vivid, durable result on cotton and the lowest unit cost at volume.

- Best for: bold logos and text in 1–4 solid colours, orders of 50 pieces and up
- Less suited to: photographs, gradients, or very small runs

## DTF (direct-to-film)
Your artwork is printed in full colour onto a transfer film and heat-pressed onto the garment. No per-colour setup, so small orders and complex artwork become practical.

- Best for: full-colour artwork, photos, small runs, names and numbers
- Less suited to: very large solid areas, which can feel heavy on the fabric

## Sublimation
Dye is turned to gas and bonded into polyester fibres. The print has no feel at all, never cracks, and can cover the entire garment.

- Best for: sports kits, all-over patterns, light-coloured polyester
- Less suited to: cotton, or dark garments

## Not sure?
Build your design in SPP Studio and send it over. We will recommend the method when we quote — it is part of the service, not an extra.`,
  },
  {
    slug: "billboard-artwork-that-works",
    title: "Seven words or fewer: designing a billboard people can actually read",
    excerpt: "A driver gives your billboard about three seconds. Here is how to spend them.",
    date: "2026-07-08",
    readMins: 4,
    tag: "Outdoor",
    body: `A billboard is not a big flyer. It is read at speed, from a distance, by someone who is doing something else. The rules are different.

## One idea
If your board says three things, it says nothing. Choose the single message you want remembered.

## Seven words
Count them. If the headline is longer than seven words, most of the audience will not finish it.

## Contrast over decoration
Dark on light or light on dark. Subtle tone-on-tone palettes that look refined on a laptop vanish at eighty metres.

## Make the brand unmissable
Your logo should occupy a confident share of the face. Nobody phones a billboard they cannot attribute.

## Give them one thing to do
A short URL, a QR code at pedestrian sites, or simply the name to search. With SPP's QR tracking, each face gets its own code so you can see which location is working.

## Preview it in place
In the SPP Outdoor Network you can upload artwork and see it on the structure before you book. Step back from the screen. If you can read it from across the room, you are close.`,
  },
  {
    slug: "preparing-artwork-for-print",
    title: "Preparing artwork for print: a five-minute checklist",
    excerpt: "Vector or pixel, RGB or CMYK, and why that logo from your website is probably too small.",
    date: "2026-06-12",
    readMins: 4,
    tag: "Artwork",
    body: `Most production delays come from artwork, and most artwork problems are easy to avoid.

## Send vector if you have it
AI, PDF, EPS or SVG files scale to any size without losing quality. If a designer made your logo, ask them for the vector original.

## If it is an image, send the biggest one
A logo saved from a website is usually a few hundred pixels wide. Printed 30 cm across a shirt, that is visibly blurred. As a guide, aim for 150 pixels per centimetre of print width.

## Keep text large and lines thick
Text under 6 pt and lines thinner than 0.5 pt can fill in or drop out, especially in screen print and embroidery.

## Leave a safe margin
Keep important content away from the edge of the print area. SPP Studio shows the safe zone as a dashed guide.

## Let the Studio check it
When you upload to SPP Studio, an automated preflight flags likely problems. It is advisory — our team reviews every file before production — but it catches the common issues before you are waiting on us.`,
  },
];

const Y = "#ffd60a";
const W = "#f5f5f2";
const K = "#17171a";

/** Layer coordinates are in print-area units: area width = 1000, origin top-left, x/y = layer centre. */
export const templates: DesignTemplate[] = [
  {
    slug: "corporate-chest-mark",
    name: "Chest Mark",
    category: "Corporate",
    garments: ["polo", "tee"],
    suggestedColour: "#1b2447",
    featured: true,
    sides: {
      front: [
        { type: "shape", shape: "rect", x: 760, y: 210, w: 150, h: 150, fill: W, angle: 0 },
        { type: "text", text: "CO", x: 760, y: 214, size: 78, font: "display", weight: 800, fill: "#1b2447", tracking: -20 },
      ],
      back: [
        { type: "text", text: "YOUR COMPANY", x: 500, y: 200, size: 84, font: "display", weight: 800, fill: W, tracking: 20 },
        { type: "shape", shape: "rect", x: 500, y: 268, w: 560, h: 6, fill: W, angle: 0 },
        { type: "text", text: "yourcompany.la", x: 500, y: 320, size: 40, font: "mono", weight: 500, fill: W, tracking: 60 },
      ],
    },
  },
  {
    slug: "restaurant-crew",
    name: "Kitchen Crew",
    category: "Restaurant",
    garments: ["tee", "polo"],
    suggestedColour: "#17171a",
    featured: true,
    sides: {
      front: [
        { type: "text", text: "Noodle", x: 500, y: 420, size: 190, font: "serif", weight: 400, fill: Y, italic: true },
        { type: "text", text: "HOUSE", x: 500, y: 560, size: 120, font: "display", weight: 800, fill: W, tracking: 140 },
      ],
      back: [
        { type: "text", text: "CREW", x: 500, y: 240, size: 210, font: "display", weight: 800, fill: W, tracking: 40 },
        { type: "text", text: "made fresh · every day", x: 500, y: 390, size: 46, font: "mono", weight: 500, fill: Y, tracking: 40 },
      ],
    },
  },
  {
    slug: "sports-number",
    name: "Match Day",
    category: "Sports",
    garments: ["sleeveless", "tee"],
    suggestedColour: "#2a35d6",
    featured: true,
    sides: {
      front: [
        { type: "shape", shape: "rect", x: 500, y: 330, w: 1000, h: 90, fill: W, angle: -8 },
        { type: "text", text: "VIENTIANE FC", x: 500, y: 332, size: 66, font: "display", weight: 800, fill: "#2a35d6", angle: -8, tracking: 60 },
        { type: "text", text: "10", x: 760, y: 560, size: 150, font: "display", weight: 800, fill: W },
      ],
      back: [
        { type: "text", text: "PLAYER", x: 500, y: 190, size: 84, font: "display", weight: 700, fill: W, tracking: 120 },
        { type: "text", text: "10", x: 500, y: 620, size: 620, font: "display", weight: 800, fill: W, tracking: -30 },
      ],
    },
  },
  {
    slug: "school-house",
    name: "House Shirt",
    category: "School",
    garments: ["tee", "polo"],
    suggestedColour: "#1f5a3d",
    featured: false,
    sides: {
      front: [
        { type: "shape", shape: "shield", x: 500, y: 440, w: 380, h: 440, fill: W },
        { type: "text", text: "EST", x: 500, y: 380, size: 44, font: "mono", weight: 500, fill: "#1f5a3d", tracking: 160 },
        { type: "text", text: "2014", x: 500, y: 470, size: 120, font: "display", weight: 800, fill: "#1f5a3d" },
      ],
      back: [{ type: "text", text: "GREEN HOUSE", x: 500, y: 220, size: 110, font: "display", weight: 800, fill: W, tracking: 60 }],
    },
  },
  {
    slug: "event-staff",
    name: "Event Crew",
    category: "Event",
    garments: ["tee"],
    suggestedColour: "#17171a",
    featured: false,
    sides: {
      front: [
        { type: "text", text: "EVENT NAME", x: 500, y: 300, size: 96, font: "display", weight: 800, fill: W, tracking: 20 },
        { type: "text", text: "15 · 11 · 2026", x: 500, y: 390, size: 46, font: "mono", weight: 500, fill: Y, tracking: 80 },
      ],
      back: [
        { type: "shape", shape: "rect", x: 500, y: 300, w: 760, h: 240, fill: Y, angle: 0 },
        { type: "text", text: "STAFF", x: 500, y: 306, size: 210, font: "display", weight: 800, fill: K, tracking: 60 },
      ],
    },
  },
  {
    slug: "streetwear-stack",
    name: "Stacked",
    category: "Streetwear",
    garments: ["tee", "tote"],
    suggestedColour: "#f5f5f2",
    featured: true,
    sides: {
      front: [
        { type: "text", text: "MAKE", x: 500, y: 300, size: 250, font: "display", weight: 800, fill: K, tracking: -30 },
        { type: "text", text: "it real", x: 520, y: 500, size: 250, font: "serif", weight: 400, fill: K, italic: true },
        { type: "shape", shape: "circle", x: 860, y: 640, w: 70, h: 70, fill: Y },
      ],
      back: [{ type: "text", text: "VTE — LAO PDR", x: 500, y: 140, size: 40, font: "mono", weight: 500, fill: K, tracking: 160 }],
    },
  },
  {
    slug: "festival-sun",
    name: "Pi Mai",
    category: "Festival",
    garments: ["tee", "sleeveless"],
    suggestedColour: "#4db4e8",
    featured: false,
    sides: {
      front: [
        { type: "shape", shape: "burst", x: 500, y: 430, w: 520, h: 520, fill: Y },
        { type: "text", text: "PI MAI", x: 500, y: 410, size: 130, font: "display", weight: 800, fill: K },
        { type: "text", text: "2027", x: 500, y: 520, size: 70, font: "mono", weight: 500, fill: K, tracking: 120 },
      ],
      back: [{ type: "text", text: "stay wet · stay happy", x: 500, y: 200, size: 60, font: "serif", weight: 400, fill: W, italic: true }],
    },
  },
  {
    slug: "minimal-line",
    name: "One Line",
    category: "Minimal",
    garments: ["tee", "polo", "tote", "cap"],
    suggestedColour: "#f5f5f2",
    featured: false,
    sides: {
      front: [{ type: "text", text: "brand name", x: 500, y: 300, size: 64, font: "sans", weight: 500, fill: K, tracking: 10 }],
      panel: [{ type: "text", text: "brand", x: 500, y: 250, size: 190, font: "sans", weight: 600, fill: K }],
    },
  },
  {
    slug: "premium-monogram",
    name: "Monogram",
    category: "Premium",
    garments: ["polo", "cap", "tote"],
    suggestedColour: "#17171a",
    featured: true,
    sides: {
      front: [
        { type: "shape", shape: "ring", x: 760, y: 220, w: 170, h: 170, fill: "#c9a227" },
        { type: "text", text: "H", x: 760, y: 226, size: 110, font: "serif", weight: 400, fill: "#c9a227", italic: true },
      ],
      panel: [
        { type: "shape", shape: "ring", x: 500, y: 250, w: 380, h: 380, fill: "#c9a227" },
        { type: "text", text: "H", x: 500, y: 262, size: 250, font: "serif", weight: 400, fill: "#c9a227", italic: true },
      ],
      back: [{ type: "text", text: "HOTEL & RESIDENCES", x: 500, y: 160, size: 40, font: "mono", weight: 500, fill: "#c9a227", tracking: 200 }],
    },
  },
  {
    slug: "campaign-bold",
    name: "Big Message",
    category: "Campaign",
    garments: ["tee", "tote"],
    suggestedColour: "#ffd60a",
    featured: false,
    sides: {
      front: [
        { type: "text", text: "SAY", x: 500, y: 260, size: 230, font: "display", weight: 800, fill: K, tracking: -20 },
        { type: "text", text: "IT", x: 500, y: 470, size: 230, font: "display", weight: 800, fill: K, tracking: -20 },
        { type: "text", text: "LOUD", x: 500, y: 680, size: 230, font: "display", weight: 800, fill: K, tracking: -20 },
      ],
      back: [{ type: "text", text: "#yourcampaign", x: 500, y: 180, size: 70, font: "mono", weight: 500, fill: K }],
    },
  },
  {
    slug: "promo-badge",
    name: "Grand Opening",
    category: "Promotional",
    garments: ["tee", "tote", "cap"],
    suggestedColour: "#d4302b",
    featured: false,
    sides: {
      front: [
        { type: "shape", shape: "burst", x: 500, y: 420, w: 560, h: 560, fill: W },
        { type: "text", text: "GRAND", x: 500, y: 370, size: 110, font: "display", weight: 800, fill: "#d4302b" },
        { type: "text", text: "opening", x: 500, y: 480, size: 120, font: "serif", weight: 400, fill: "#d4302b", italic: true },
      ],
      panel: [{ type: "text", text: "OPEN", x: 500, y: 250, size: 220, font: "display", weight: 800, fill: W }],
    },
  },
];

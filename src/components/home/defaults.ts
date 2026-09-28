/**
 * The landing page's own wording — what each section says while the Home page
 * editor's field for it is empty. The sections render from here and the editor
 * shows the same text as the field's placeholder, so "default" means one thing.
 * In a title, *asterisks* mark the accent word.
 */
export const HOME_DEFAULTS = {
  manifesto: {
    eyebrow: "Position",
    title: "SPP does not *simply print* products.",
    lede: "A printed shirt is an output. The job is everything around it — the idea worth printing, artwork that survives the press, proof you can see before you pay, and a place in the street where it gets noticed.",
  },
  plates: {
    eyebrow: "How an idea becomes an object",
    title: "Five plates. One impression.",
    lede: "A full-colour print is several plates laid down in perfect register. A project is the same: five separate crafts that only work when they line up.",
  },
  goals: {
    eyebrow: "Start from the goal",
    title: "What are you trying to *achieve?*",
    lede: "You do not need to know the difference between DTF and sublimation. Tell us the outcome and we will put together the apparel, print, display and outdoor pieces that get you there.",
  },
  studio: {
    eyebrow: "SPP Studio",
    title: "See it *before* it exists.",
    lede: "A mockup designer that runs in your browser — nothing to install. What you approve on screen becomes the reference for everything we produce.",
  },
  outdoor: {
    eyebrow: "SPP Outdoor Network",
    title: "The biggest print we make is *the street.*",
    lede: "Billboard sites across Laos, browsable by province, size and availability. Preview your artwork on the structure, then request the location and dates you want.",
  },
  capabilities: { eyebrow: "Capability index", title: "Everything we make." },
  featured: { eyebrow: "Featured products", title: "Start with *these.*" },
  work: { eyebrow: "Selected work", title: "Projects, not purchases." },
  testimonials: { eyebrow: "In their words" },
  faq: {
    eyebrow: "Before you ask",
    title: "Straight answers.",
    lede: "The questions we hear most, answered the way we would answer them at the counter.",
  },
  cta: {
    title: "Have an idea? Let’s make it real.",
    body: "Tell us what you are trying to achieve. A person at SPP reads every request and replies with a plan and a written quote.",
    primary: "Start a project",
    secondary: "Let's talk",
  },
} as const;

/**
 * Whole-page Lao: the pure half.
 *
 * The site's pages are written in English and exported as static HTML. The
 * dictionary in en.ts / lo.ts covers the chrome; everything else — product
 * copy, articles, legal pages, the Studio's panels — is translated at the level
 * of a SEGMENT: the inline content of one block element (a paragraph, a
 * heading, a list item, a button). A segment is serialised to a key such as
 *
 *   Design your own <1>T-shirt</1> online in sizes XS to {#}XL.
 *
 * where <n>…</n> stands for the n-th inline element (a link, a <strong>…) and
 * {#} for a number, in order. The Lao text keeps the same tags and numbers, so
 * links keep their targets and figures their values. Nothing here touches the
 * DOM; see dom-translator.ts for the browser half and scripts/i18n-extract.ts
 * for how keys are gathered from the built site.
 */

/** Numbers become {#} so "8 × 8 cm" and "10 × 25 cm" share one translation. */
export const NUMBER = /\d+(?:[.,:]\d+)*/g;

export function normaliseText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The key of a serialised segment plus the numbers it carried, in order. */
export function keyOf(serialised: string): { key: string; nums: string[] } {
  const nums: string[] = [];
  // numbers in the text become slots; the numbers that name the element tags are left alone
  const key = normaliseText(serialised).split(/(<\/?\d+\/?>)/).map((part, i) => (i % 2 ? part : part.replace(NUMBER, (m) => { nums.push(m); return "{#}"; }))).join("");
  return { key, nums };
}

/** Puts the numbers back into a translation, in order; a translation with fewer slots drops the rest. */
export function fillNumbers(translated: string, nums: string[]): string {
  let i = 0;
  return translated.replace(/\{#\}/g, () => nums[i++] ?? "");
}

export type Token = { t: "text"; v: string } | { t: "open"; n: number } | { t: "close"; n: number } | { t: "void"; n: number };

/** Splits a (translated) segment into text runs and element tags. `&lt;` and `&amp;` are the only escapes. */
export function tokenize(s: string): Token[] {
  const out: Token[] = [];
  const re = /<(\d+)\/>|<(\d+)>|<\/(\d+)>|([^<]+|<)/g;
  for (const m of s.matchAll(re)) {
    if (m[1]) out.push({ t: "void", n: Number(m[1]) });
    else if (m[2]) out.push({ t: "open", n: Number(m[2]) });
    else if (m[3]) out.push({ t: "close", n: Number(m[3]) });
    else out.push({ t: "text", v: m[4]!.replace(/&lt;/g, "<").replace(/&amp;/g, "&") });
  }
  return out;
}

export const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Does a segment hold anything worth translating? Pure numbers, symbols and single letters do not. */
export function worthTranslating(key: string): boolean {
  const bare = key.replace(/<\/?\d+\/?>/g, "").replace(/\{#\}/g, "");
  return /[A-Za-z]{2,}/.test(bare);
}

/**
 * Checks a translation against its key: the same element tags, properly
 * nested, and the same number of {#} slots. Returns the problem, or null.
 */
export function validateTranslation(key: string, lo: string): string | null {
  const tags = (s: string) => tokenize(s).filter((t) => t.t !== "text").map((t) => `${t.t}${t.n}`).sort();
  const a = tags(key), b = tags(lo);
  if (a.join(",") !== b.join(",")) return `tags differ: key has [${a.join(" ")}], translation has [${b.join(" ")}]`;
  const stack: number[] = [];
  for (const t of tokenize(lo)) {
    if (t.t === "open") stack.push(t.n);
    else if (t.t === "close" && stack.pop() !== t.n) return `tag </${t.n}> is not nested properly`;
  }
  if (stack.length) return `tag <${stack[0]}> is never closed`;
  const slots = (s: string) => (s.match(/\{#\}/g) ?? []).length;
  if (slots(key) !== slots(lo)) return `number slots differ: key has ${slots(key)}, translation has ${slots(lo)}`;
  if (!/[຀-໿]/.test(lo) && worthTranslating(key)) return "translation holds no Lao script";
  return null;
}

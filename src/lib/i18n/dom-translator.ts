/**
 * Whole-page Lao: the browser half. See segments.ts for the idea.
 *
 * `collectSegments` reads a document the way the translator will, so the
 * extraction script and the live page agree on every key. `DomTranslator`
 * swaps a page into Lao and back without React noticing: it edits the text
 * of existing text nodes where it can, moves existing inline elements rather
 * than cloning them (their event handlers survive), and re-applies whatever
 * React re-renders through a MutationObserver.
 */
import { escapeText, fillNumbers, keyOf, normaliseText, tokenize, worthTranslating, type Token } from "./segments";

const INLINE = new Set(["A", "ABBR", "B", "BDI", "BDO", "BR", "CITE", "DEL", "DFN", "EM", "I", "INS", "KBD", "MARK", "Q", "S", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U", "WBR"]);
/** Inline things with no text of their own: an icon, a picture, a checkbox beside a label. Part of the segment, as a <n/> tag, never looked inside. */
const ATOMIC = new Set(["SVG", "IMG", "PICTURE", "INPUT", "BR", "WBR"]);
/** An element is atomic by tag, or when marked data-i18n-slot (a value, such as a customer's own text, that must stay as it is). */
const atomic = (el: Element) => ATOMIC.has(el.tagName.toUpperCase()) || el.hasAttribute("data-i18n-slot");
/** Never looked inside: code, controls, and SVG (a customer's own design text is drawn in SVG and must stay as typed). */
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "CODE", "PRE", "TEXTAREA", "SELECT", "IFRAME", "CANVAS", "VIDEO", "AUDIO", "MATH", "SVG"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt", "aria-placeholder", "aria-description"] as const;

export type Dictionary = Record<string, string>;

const isElement = (n: Node): n is Element => n.nodeType === 1;
const isText = (n: Node): n is Text => n.nodeType === 3;

/** An element the translator must leave alone, including everything inside it. */
function skipped(el: Element): boolean {
  if (SKIP.has(el.tagName.toUpperCase())) return true;
  const lang = el.getAttribute("lang");
  if (lang && !/^en\b/i.test(lang)) return true;
  if (el.getAttribute("translate") === "no" || el.hasAttribute("data-no-translate")) return true;
  return false;
}

/** Is this element's content one segment: text and inline elements only, with some text in it? */
function isSegmentRoot(el: Element): boolean {
  if (skipped(el)) return false;
  let text = false;
  const walk = (node: Element): boolean => {
    for (const c of node.childNodes) {
      if (isText(c)) { if (/\S/.test(c.data)) text = true; }
      else if (isElement(c)) {
        const tag = c.tagName.toUpperCase();
        if (atomic(c)) continue;
        if (!INLINE.has(tag) || skipped(c)) return false;
        if (!walk(c)) return false;
      }
    }
    return true;
  };
  return walk(el) && text;
}

/** Serialises a segment root's content: text as-is (escaped), inline elements as numbered tags. */
function serialise(el: Element): { raw: string; elements: Element[] } {
  const elements: Element[] = [];
  let raw = "";
  const walk = (node: Element) => {
    for (const c of node.childNodes) {
      if (isText(c)) raw += escapeText(c.data);
      else if (isElement(c)) {
        elements.push(c);
        const n = elements.length;
        if (atomic(c) || !c.childNodes.length) raw += `<${n}/>`;
        else { raw += `<${n}>`; walk(c); raw += `</${n}>`; }
      }
    }
  };
  walk(el);
  return { raw, elements };
}

/** Does a segment have words of its own at the top level, or is it only a wrapper of inline elements and icons? */
function hasOwnText(raw: string): boolean {
  let depth = 0;
  for (const t of tokenize(raw)) {
    if (t.t === "open") depth++;
    else if (t.t === "close") depth--;
    else if (t.t === "text" && depth === 0 && /\S/.test(t.v)) return true;
  }
  return false;
}

/**
 * Walks the tree calling `onRoot` for every segment root. When a root is only
 * a wrapper (a card made of spans and an icon) or `onRoot` declines it, the
 * inline elements inside it are offered as segments of their own, so a badge
 * or a label inside a card still translates on its own.
 */
function walkSegments(root: ParentNode, onRoot: (el: Element, raw: string, elements: Element[]) => boolean | null) {
  const visit = (el: Element) => {
    if (skipped(el) || atomic(el)) return;
    if (isSegmentRoot(el)) {
      const { raw, elements } = serialise(el);
      const own = hasOwnText(raw);
      const done = onRoot(el, raw, elements);
      // a sentence that was handled (or has no translation) stops here; a wrapper always offers its parts
      if (own && done !== null) return;
      for (const c of el.children) visit(c);
      return;
    }
    for (const c of el.children) visit(c);
  };
  if (isElement(root as Node)) visit(root as Element); else for (const c of root.children) visit(c);
}

/** Keys of every segment and translatable attribute under `root` — what the extraction script gathers. */
export function collectSegments(root: ParentNode): { segments: string[]; attrs: string[] } {
  const segments = new Set<string>(), attrs = new Set<string>();
  walkSegments(root, (_el, raw) => {
    const { key } = keyOf(raw);
    if (worthTranslating(key)) segments.add(key);
    return true; // a sentence is one key; a wrapper's parts are collected on their own
  });
  const all = isElement(root as Node) ? [root as Element, ...(root as Element).querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const el of all) {
    if (el.closest("[lang]:not([lang^='en']),[translate='no'],[data-no-translate]")) continue;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v) { const { key } = keyOf(v); if (worthTranslating(key)) attrs.add(key); }
    }
  }
  // the browser-tab title, without the site suffix the translator keeps
  if (typeof document !== "undefined" && document.title) {
    const { key } = keyOf(document.title.replace(/ — SPP$/, ""));
    if (worthTranslating(key)) segments.add(key);
  }
  return { segments: [...segments], attrs: [...attrs] };
}

type Saved = { children: Map<Element, Node[]>; texts: Map<Text, string> };

export class DomTranslator {
  private saved = new WeakMap<Element, Saved>();
  private savedAttrs = new WeakMap<Element, Map<string, string>>();
  private roots = new Set<Element>();
  private attrRoots = new Set<Element>();
  private observer: MutationObserver | null = null;
  private queued = false;
  private titleWas: string | null = null;

  constructor(private dict: Dictionary, private attrDict: Dictionary, private scope: ParentNode) {}

  /** Translate everything in scope now and keep it translated while the page changes. */
  start() {
    this.apply(this.scope);
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(this.scope as Node, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: [...ATTRS] });
    const title = document.querySelector("title");
    if (title) this.observer.observe(title, { childList: true, characterData: true, subtree: true });
  }

  /** Put every page element back exactly as it was and stop watching. */
  stop() {
    this.observer?.disconnect();
    this.observer = null;
    for (const el of this.roots) this.restore(el);
    for (const el of this.attrRoots) {
      const m = this.savedAttrs.get(el);
      if (m) for (const [a, v] of m) el.setAttribute(a, v);
      this.savedAttrs.delete(el);
    }
    this.roots.clear();
    this.attrRoots.clear();
    if (this.titleWas !== null) { document.title = this.titleWas; this.titleWas = null; }
  }

  private schedule() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.apply(this.scope); });
  }

  /** The browser tab's title follows too; the English is kept so EN restores it. */
  private translateTitle() {
    // "Page title — SPP": the site suffix is kept as it is and the page part looked up on its own
    const m = /^(.*?)( — SPP)$/.exec(document.title);
    const head = m ? m[1]! : document.title, tail = m ? m[2]! : "";
    const { key, nums } = keyOf(head);
    const lo = this.dict[key];
    if (!lo) return;
    const out = fillNumbers(lo, nums) + tail;
    if (out === document.title) return;
    if (this.titleWas === null) this.titleWas = document.title;
    document.title = out;
  }

  private apply(root: ParentNode) {
    this.translateTitle();
    // a sentence with no translation returns null, so its inline parts get their chance
    walkSegments(root, (el, raw, elements) => (this.translateSegment(el, raw, elements) ? true : null));
    const all = isElement(root as Node) ? [root as Element, ...(root as Element).querySelectorAll("*")] : [...root.querySelectorAll("*")];
    for (const el of all) this.translateAttrs(el);
    this.observer?.takeRecords(); // our own edits are not changes to react to
  }

  private translateAttrs(el: Element) {
    if (el.closest("[lang]:not([lang^='en']),[translate='no'],[data-no-translate]")) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const { key, nums } = keyOf(v);
      const lo = this.attrDict[key];
      if (!lo) continue;
      const out = fillNumbers(lo, nums);
      if (out === v) continue;
      let m = this.savedAttrs.get(el);
      if (!m) { m = new Map(); this.savedAttrs.set(el, m); }
      if (!m.has(a)) m.set(a, v);
      el.setAttribute(a, out);
      this.attrRoots.add(el);
    }
  }

  private translateSegment(el: Element, raw: string, elements: Element[]): boolean {
    const { key, nums } = keyOf(raw);
    const lo = this.dict[key];
    if (!lo) return false; // English with no translation, or already Lao
    const tokens = tokenize(fillNumbers(lo, nums));
    // remember the original once; a re-render that brings English back is translated again from the new nodes
    if (!this.saved.has(el)) {
      const children = new Map<Element, Node[]>(), texts = new Map<Text, string>();
      const collect = (n: Element) => { children.set(n, [...n.childNodes]); for (const c of n.childNodes) { if (isText(c)) texts.set(c, c.data); else if (isElement(c) && !atomic(c)) collect(c); } };
      collect(el);
      this.saved.set(el, { children, texts });
      this.roots.add(el);
    }
    // reuse the existing text nodes in order, so React's references stay live where they can
    const spareText: Text[] = [];
    const strip = (n: Element) => { for (const c of [...n.childNodes]) { if (isText(c)) spareText.push(c); else if (isElement(c) && !atomic(c)) strip(c); } };
    strip(el);
    const build = (parent: Element, toks: Token[], from: number, until: number | null): number => {
      let i = from;
      while (i < toks.length) {
        const t = toks[i]!;
        if (t.t === "close") { if (t.n === until) return i + 1; i++; continue; }
        if (t.t === "text") {
          const node = spareText.shift() ?? document.createTextNode("");
          if (node.data !== t.v) node.data = t.v;
          parent.append(node);
          i++;
        } else {
          const child = elements[t.n - 1];
          if (!child) { i++; continue; }
          parent.append(child);
          if (t.t === "open" && !atomic(child)) { while (child.firstChild) child.removeChild(child.firstChild); i = build(child, toks, i + 1, t.n); } else i++;
        }
      }
      return i;
    };
    while (el.firstChild) el.removeChild(el.firstChild);
    build(el, tokens, 0, null);
    return true;
  }

  private restore(el: Element) {
    const s = this.saved.get(el);
    if (!s) return;
    for (const [t, data] of s.texts) if (t.data !== data) t.data = data;
    for (const [parent, nodes] of s.children) {
      while (parent.firstChild) parent.removeChild(parent.firstChild);
      for (const n of nodes) parent.append(n);
    }
    this.saved.delete(el);
  }
}

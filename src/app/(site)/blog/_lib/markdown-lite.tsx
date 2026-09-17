import type { ReactNode } from "react";

/**
 * Journal bodies are "markdown-lite": paragraphs, `## ` headings and `- `
 * lists. Everything becomes React text nodes, so content can never inject
 * markup — there is no HTML path here at all.
 */
export type Block = { type: "h2"; text: string; id: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const used = new Set<string>();
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    if (list.length) blocks.push({ type: "ul", items: list });
    para = [];
    list = [];
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) flush();
    else if (line.startsWith("## ")) {
      flush();
      const text = line.slice(3).trim();
      let id = slugify(text) || "section";
      while (used.has(id)) id += "-2";
      used.add(id);
      blocks.push({ type: "h2", text, id });
    } else if (line.startsWith("- ")) {
      if (para.length) flush();
      list.push(line.slice(2).trim());
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** "Best for: bold logos" → the lead-in label is set in stronger ink. */
function withLeadIn(text: string): ReactNode {
  const m = /^([A-Z][^:]{2,28}):\s+(.+)$/.exec(text);
  return m ? <><strong className="font-semibold text-fog-50">{m[1]}:</strong> {m[2]}</> : text;
}

export function Prose({ blocks }: { blocks: Block[] }) {
  const leadIndex = blocks.findIndex((b) => b.type === "p");
  return (
    <div className="max-w-[68ch]">
      {blocks.map((b, i) => {
        if (b.type === "h2") return <h2 key={i} id={b.id} className="t-title mt-16 scroll-mt-[calc(var(--nav-h)+2rem)] text-fog-50 first:mt-0">{b.text}</h2>;
        if (b.type === "ul")
          return (
            <ul key={i} className="mt-6 border-b border-ink-700">
              {b.items.map((item) => (
                <li key={item} className="flex items-baseline gap-4 border-t border-ink-700 py-3.5 text-[1.0625rem] leading-relaxed text-fog-300">
                  <span aria-hidden className="h-1.5 w-1.5 flex-none -translate-y-0.5 bg-yellow" />
                  <span>{withLeadIn(item)}</span>
                </li>
              ))}
            </ul>
          );
        const first = i === leadIndex;
        return (
          <p key={i} className={first ? "text-xl leading-relaxed text-fog-100 lg:text-2xl lg:leading-[1.5]" : "mt-6 text-[1.125rem] leading-[1.75] text-fog-300"}>
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

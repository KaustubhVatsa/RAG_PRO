import type { ReactNode } from "react";

/**
 * A deliberately tiny, SAFE markdown renderer for model output.
 *
 * Safety: model text is never turned into HTML strings (no dangerouslySetInnerHTML). We parse it
 * into blocks and inline tokens and build React elements, so any "<script>" in the text is
 * rendered as literal characters by React.
 *
 * Supported: paragraphs, "-"/"*" and "1." lists, ``` code blocks, # headings, **bold**,
 * *italic* / _italic_, `code`, and citation markers like [1], [2][3] or [1, 2].
 */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "code"; text: string };

const UL = /^\s*[-*•]\s+/;
const OL = /^\s*\d+[.)]\s+/;
const H = /^\s*#{1,4}\s+/;

export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      flushPara();
      flushList();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const listKind = UL.test(line) ? "ul" : OL.test(line) ? "ol" : null;
    if (listKind) {
      flushPara();
      if (!list || list.kind !== listKind) {
        flushList();
        list = { kind: listKind, items: [] };
      }
      list.items.push(line.replace(listKind === "ul" ? UL : OL, ""));
      continue;
    }
    if (H.test(line)) {
      flushPara();
      flushList();
      blocks.push({ kind: "h", text: line.replace(H, "") });
      continue;
    }
    // A plain line right after a list item continues that item (soft wrap).
    if (list) {
      list.items[list.items.length - 1] += " " + line.trim();
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

export interface InlineHooks {
  /** Render one citation marker number (e.g. as an interactive chip). */
  citation?: (n: number, key: string) => ReactNode;
}

// One regex with a named alternative per inline token. Underscore italics require non-word
// characters around them so identifiers like d_model or d_k are left alone.
const INLINE =
  /(?<code>`[^`\n]+`)|(?<bold>\*\*[^*\n]+?\*\*)|(?<italic>\*[^*\s][^*\n]*?\*|(?<![\w])_[^_\s][^_\n]*?_(?![\w]))|(?<cite>\[\d+(?:\s*,\s*\d+)*\])/g;

export function renderInline(text: string, hooks: InlineHooks = {}, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${k++}`;
    const g = m.groups ?? {};
    if (g.code) out.push(<code key={key}>{g.code.slice(1, -1)}</code>);
    else if (g.bold) out.push(<strong key={key}>{renderInline(g.bold.slice(2, -2), hooks, key)}</strong>);
    else if (g.italic) out.push(<em key={key}>{renderInline(g.italic.slice(1, -1), hooks, key)}</em>);
    else if (g.cite) {
      const nums = g.cite.slice(1, -1).split(",").map((s) => Number(s.trim()));
      if (hooks.citation) nums.forEach((n, j) => out.push(hooks.citation!(n, `${key}-${j}`)));
      else out.push(g.cite);
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Render a whole markdown string with no claim highlighting (used for streaming + user text). */
export function Markdown({ text, hooks }: { text: string; hooks?: InlineHooks }) {
  return (
    <>
      {parseBlocks(text).map((b, i) => renderBlock(b, i, (t, key) => renderInline(t, hooks, key)))}
    </>
  );
}

/** Render one block, delegating inline content to `inline` (lets callers add claim spans). */
export function renderBlock(
  block: Block,
  index: number,
  inline: (text: string, key: string) => ReactNode,
): ReactNode {
  const key = `b${index}`;
  switch (block.kind) {
    case "p":
      return <p key={key}>{inline(block.text, key)}</p>;
    case "h":
      return (
        <h4 key={key} className="md-h">
          {inline(block.text, key)}
        </h4>
      );
    case "code":
      return (
        <pre key={key} className="md-code">
          <code>{block.text}</code>
        </pre>
      );
    case "ul":
    case "ol": {
      const List = block.kind;
      return (
        <List key={key}>
          {block.items.map((item, j) => (
            <li key={j}>{inline(item, `${key}-${j}`)}</li>
          ))}
        </List>
      );
    }
  }
}

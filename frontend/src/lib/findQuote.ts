/**
 * Locate a quote inside a longer text, forgiving the differences PDFs introduce: case, runs of
 * whitespace/line breaks, curly vs straight quotes, en/em dashes, ligatures. Mirrors the spirit of
 * the backend's `normalize()` in reasoning/citations.py.
 *
 * Returns [start, end) offsets into the ORIGINAL text, or null.
 */
function normChar(ch: string): string {
  const c = ch.normalize("NFKC");
  if (c === "“" || c === "”") return '"';
  if (c === "‘" || c === "’") return "'";
  if (c === "–" || c === "—") return "-";
  return c.toLowerCase();
}

/** Normalised string plus, for each normalised char, the index of its source char. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let lastWasSpace = true; // also trims leading whitespace
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!lastWasSpace) {
        norm += " ";
        map.push(i);
      }
      lastWasSpace = true;
      continue;
    }
    const n = normChar(ch);
    for (const piece of n) {
      norm += piece;
      map.push(i);
    }
    lastWasSpace = false;
  }
  return { norm, map };
}

export function findQuote(text: string, quote: string): [number, number] | null {
  const q = normalizeWithMap(quote).norm.trim();
  if (!q) return null;
  const { norm, map } = normalizeWithMap(text);
  let at = norm.indexOf(q);
  let len = q.length;
  // Fallback: the start of the quote (fallback quotes are truncated passage openings).
  if (at === -1 && q.length > 40) {
    const head = q.slice(0, 40);
    at = norm.indexOf(head);
    len = head.length;
  }
  if (at === -1) return null;
  return [map[at], map[at + len - 1] + 1];
}

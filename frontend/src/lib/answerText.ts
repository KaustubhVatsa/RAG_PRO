import type { Claim } from "../api/types";

/**
 * Helpers that deal with the raw answer text.
 *
 * The model is told to finish with an "Evidence:" line followed by `[n] "exact quote"` lines. The
 * backend strips that block from the final `done.answer.text`, but the *token stream* still
 * contains it. So while streaming we hide everything from "Evidence:" onward, and on `done` the UI
 * swaps in the clean final text.
 */
const EVIDENCE = "Evidence:";
const EVIDENCE_LINE = /(^|\n)[ \t>*_#]*Evidence:/;

export function visibleStreamText(raw: string): string {
  const m = EVIDENCE_LINE.exec(raw);
  if (m) return raw.slice(0, m.index).trimEnd();

  // The marker may be arriving token by token ("Evid", "ence:"). If the text ends with a line that
  // could still become "Evidence:", hold that partial line back for now.
  const lastBreak = raw.lastIndexOf("\n");
  if (lastBreak !== -1) {
    const tail = raw.slice(lastBreak + 1).replace(/^[ \t>*_#]*/, "");
    if (tail.length > 0 && EVIDENCE.startsWith(tail)) return raw.slice(0, lastBreak).trimEnd();
  }
  return raw;
}

/** Fact-check answers start with a verdict word; pull it out so it can be shown as a badge. */
export type Verdict = "supported" | "contradicted" | "nei";
export function factcheckVerdict(text: string): { verdict: Verdict; rest: string } | null {
  const m = /^\s*\**\s*(SUPPORTED|CONTRADICTED|NOT ENOUGH INFORMATION)\s*\**\s*[:.\-–—]?\s*/i.exec(
    text,
  );
  if (!m) return null;
  const word = m[1].toUpperCase();
  const verdict: Verdict =
    word === "SUPPORTED" ? "supported" : word === "CONTRADICTED" ? "contradicted" : "nei";
  return { verdict, rest: text.slice(m[0].length) };
}

/** A slice of text that is either plain or belongs to claim number `claim`. */
export interface Segment {
  text: string;
  claim: number | null;
}

/**
 * Split `text` into plain and claim segments by finding each claim's text inside it.
 * Claims are sentences cut from the answer by the backend, so an exact search usually works; a
 * claim that can't be found (e.g. it spans two list items) is simply not highlighted inline (it
 * still appears in the claim summary under the answer).
 */
export function segmentByClaims(text: string, claims: Claim[]): Segment[] {
  const ranges: { start: number; end: number; claim: number }[] = [];
  claims.forEach((c, i) => {
    // The backend splits sentences on the raw text, so a claim from a list item still carries its
    // "- " / "1. " marker, which the block parser already removed from `text`.
    const needle = c.text.trim().replace(/^([-*•]|\d+[.)])\s+/, "");
    if (!needle) return;
    const start = text.indexOf(needle);
    if (start === -1) return;
    const end = start + needle.length;
    if (ranges.some((r) => start < r.end && end > r.start)) return; // never overlap
    ranges.push({ start, end, claim: i });
  });
  ranges.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start), claim: null });
    out.push({ text: text.slice(r.start, r.end), claim: r.claim });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), claim: null });
  return out;
}

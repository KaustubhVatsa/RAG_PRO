import type { ReactNode } from "react";
import type { Citation, Claim, ScoredChunk } from "../../api/types";
import { segmentByClaims } from "../../lib/answerText";
import { parseBlocks, renderBlock, renderInline, type InlineHooks } from "../../lib/markdown";
import { CitationChip } from "../verify/CitationChip";
import { ClaimSpan } from "../verify/ClaimSpan";

interface Props {
  text: string;
  claims: Claim[];
  citations: Citation[];
  retrieved: ScoredChunk[] | null;
  /** Play the claim underline reveal. */
  revealed: boolean;
  onOpenCitation?: (c: Citation) => void;
  activeCitation?: number | null;
}

/**
 * The finished answer: markdown blocks, with every claim sentence wrapped in a ClaimSpan and every
 * [n] marker turned into an interactive CitationChip.
 */
export function AnswerBody({ text, claims, citations, retrieved, revealed, onOpenCitation, activeCitation }: Props) {
  const byN = new Map(citations.map((c) => [c.n, c]));
  const sectionOf = (c: Citation | undefined) =>
    c ? retrieved?.find((s) => s.chunk.id === c.chunk_id)?.chunk.section ?? null : null;

  const hooks: InlineHooks = {
    citation: (n, key) => (
      <CitationChip
        key={key}
        n={n}
        citation={byN.get(n)}
        section={sectionOf(byN.get(n))}
        onOpen={onOpenCitation}
        active={activeCitation === n}
      />
    ),
  };

  // Claim ordering for the stagger animation follows the claims array.
  const inline = (unit: string, key: string): ReactNode =>
    segmentByClaims(unit, claims).map((seg, i) =>
      seg.claim === null ? (
        <span key={`${key}-s${i}`}>{renderInline(seg.text, hooks, `${key}-s${i}`)}</span>
      ) : (
        <ClaimSpan key={`${key}-s${i}`} claim={claims[seg.claim]} index={seg.claim} revealed={revealed}>
          {renderInline(seg.text, hooks, `${key}-s${i}`)}
        </ClaimSpan>
      ),
    );

  return <div className="md answer-md">{parseBlocks(text).map((b, i) => renderBlock(b, i, inline))}</div>;
}

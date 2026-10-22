import { useState } from "react";
import type { Citation, ScoredChunk } from "../../api/types";
import { IconExternal } from "../icons";
import { Skeleton } from "../ui/Feedback";
import { quoteState } from "../verify/meta";
import type { SourceTarget } from "./types";

const SOURCE_LABEL: Record<ScoredChunk["source"], string> = {
  vector: "Vector",
  bm25: "BM25",
  hybrid: "Hybrid",
  rerank: "Rerank",
};

/**
 * Ranked passages from the `retrieval` event. Scores are only comparable within one source
 * (BM25 and cosine use different scales), so bars are relative to the best passage in this list.
 */
export function RetrievedList({
  chunks,
  citations,
  loading,
  onOpen,
  docTitle,
}: {
  chunks: ScoredChunk[] | null;
  citations: Citation[];
  loading: boolean;
  onOpen: (t: SourceTarget) => void;
  docTitle: (docId: string) => string | undefined;
}) {
  if (loading && !chunks) {
    return (
      <div className="retrieved-loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="passage passage-skeleton">
            <Skeleton lines={3} />
          </div>
        ))}
      </div>
    );
  }
  if (!chunks || chunks.length === 0) {
    return (
      <p className="evidence-empty-note">
        {chunks ? "No passages matched this question." : "Ask a question to see which passages Verity read."}
      </p>
    );
  }
  const max = Math.max(...chunks.map((c) => c.score), 1e-9);
  const multiDoc = new Set(chunks.map((c) => c.chunk.doc_id)).size > 1;

  return (
    <ol className="passages">
      {chunks.map((sc, i) => (
        <Passage
          key={sc.chunk.id}
          rank={i + 1}
          sc={sc}
          relative={sc.score / max}
          cites={citations.filter((c) => c.chunk_id === sc.chunk.id)}
          docTitle={multiDoc ? docTitle(sc.chunk.doc_id) : undefined}
          onOpen={onOpen}
        />
      ))}
    </ol>
  );
}

function Passage({
  rank,
  sc,
  relative,
  cites,
  docTitle,
  onOpen,
}: {
  rank: number;
  sc: ScoredChunk;
  relative: number;
  cites: Citation[];
  docTitle?: string;
  onOpen: (t: SourceTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { chunk } = sc;
  const cited = cites.length > 0;
  return (
    <li className={`passage ${cited ? "is-cited" : ""}`} style={{ ["--i" as string]: rank - 1 }}>
      <div className="passage-head">
        <span className="passage-rank" aria-label={`Rank ${rank}`}>
          {rank}
        </span>
        <span className="passage-where">
          <span className="passage-page">p. {chunk.page}</span>
          {chunk.section && <span className="passage-section">{chunk.section}</span>}
          {docTitle && <span className="passage-doc">{docTitle}</span>}
        </span>
        <span className={`source-badge source-${sc.source}`}>{SOURCE_LABEL[sc.source]}</span>
      </div>
      <div className="score" title={`score ${sc.score.toFixed(3)} (${sc.source})`}>
        <span className="score-track" aria-hidden="true">
          <span className="score-fill" style={{ transform: `scaleX(${Math.max(0.04, relative)})` }} />
        </span>
        <span className="score-value">{sc.score.toFixed(2)}</span>
      </div>
      <p className={`passage-text ${expanded ? "is-expanded" : ""}`}>{chunk.text}</p>
      <div className="passage-actions">
        <button type="button" className="link-btn" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : "Show more"}
        </button>
        {cited && (
          <span className="passage-cited">
            cited as
            {cites.map((c) => (
              <span key={c.n} className={`mini-cite cite-${quoteState(c.verified)}`}>
                {c.n}
              </span>
            ))}
          </span>
        )}
        <button
          type="button"
          className="link-btn passage-open"
          onClick={() =>
            onOpen({
              docId: chunk.doc_id,
              page: chunk.page,
              chunkId: chunk.id,
              quote: cites[0]?.quote ?? null,
              verified: cites[0]?.verified,
              n: cites[0]?.n,
            })
          }
        >
          View in source <IconExternal size={13} />
        </button>
      </div>
    </li>
  );
}

import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Chunk } from "../../api/types";
import { findQuote } from "../../lib/findQuote";
import { Skeleton } from "../ui/Feedback";

/**
 * Text fallback for the Source tab when there's no stored PDF (e.g. the built-in demo document):
 * show the page's passages from GET /api/documents/{id}/chunks?page=N, with the cited passage
 * emphasised and the quote highlighted inside it.
 */
export function ChunkSource({ docId, page, chunkId, quote }: { docId: string; page: number; chunkId: string | null; quote: string | null }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ok"; chunks: Chunk[] } | { status: "error"; message: string }>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api
      .chunks(docId, page)
      .then((chunks) => !cancelled && setState({ status: "ok", chunks }))
      .catch((e: unknown) => !cancelled && setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [docId, page]);

  // Bring the highlighted quote into view once rendered.
  useEffect(() => {
    if (state.status !== "ok") return;
    document.querySelector(".chunk-source mark")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [state, quote]);

  if (state.status === "loading") return <Skeleton lines={6} className="chunk-skeleton" />;
  if (state.status === "error") return <p className="evidence-empty-note">Couldn't load this page: {state.message}</p>;
  if (state.chunks.length === 0) return <p className="evidence-empty-note">No indexed text on page {page}.</p>;

  return <PaperPage page={page} chunks={state.chunks} chunkId={chunkId} quote={quote} />;
}

/** One "page" of indexed text, with the target passage emphasised and the quote marked. */
export function PaperPage({ page, chunks, chunkId, quote }: { page: number; chunks: Chunk[]; chunkId: string | null; quote: string | null }) {
  return (
    <div className="chunk-source">
      <div className="paper-page" aria-label={`Page ${page} text`}>
        <div className="paper-page-num">{page}</div>
        {chunks.map((c) => {
          const isTarget = c.id === chunkId;
          const range = quote && (isTarget || !chunkId) ? findQuote(c.text, quote) : null;
          return (
            <section key={c.id} className={`paper-chunk ${isTarget ? "is-target" : ""}`}>
              {c.section && <h4 className="paper-section">{c.section}</h4>}
              <p>
                {range ? (
                  <>
                    {c.text.slice(0, range[0])}
                    <mark className="quote-mark">{c.text.slice(range[0], range[1])}</mark>
                    {c.text.slice(range[1])}
                  </>
                ) : (
                  c.text
                )}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}

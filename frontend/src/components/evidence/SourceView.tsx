import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { fetchPdfBytes } from "../../api/client";
import { useDocuments } from "../../state/documents";
import { IconChevron, IconQuote } from "../icons";
import { IconButton } from "../ui/Button";
import { EmptyState, Skeleton } from "../ui/Feedback";
import { QuoteBadge } from "../verify/meta";
import { ChunkSource } from "./ChunkSource";
import type { SourceTarget } from "./types";

// pdf.js only loads when a document really has a stored PDF.
const PdfViewer = lazy(() => import("./PdfViewer"));

type FileState = { status: "loading" } | { status: "pdf"; data: ArrayBuffer } | { status: "none" } | { status: "error"; message: string };

/**
 * The Source tab: shows the cited page. Uses the real PDF when the backend has it, otherwise
 * falls back to the indexed passages of that page (the demo document has no stored PDF).
 */
export function SourceView({ target, onPage }: { target: SourceTarget | null; onPage: (page: number) => void }) {
  const { docs } = useDocuments();
  const [file, setFile] = useState<FileState>({ status: "loading" });
  const [pdfPages, setPdfPages] = useState<number | null>(null);
  const docId = target?.docId;

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    setFile({ status: "loading" });
    setPdfPages(null);
    fetchPdfBytes(docId)
      .then((data) => !cancelled && setFile(data ? { status: "pdf", data } : { status: "none" }))
      .catch((e: unknown) => !cancelled && setFile({ status: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const onPageCount = useCallback((n: number) => setPdfPages(n), []);

  if (!target) {
    return (
      <EmptyState art={<IconQuote size={26} />} title="No source open">
        Click a citation chip like <span className="cite-chip cite-verified demo-chip">1</span> in an answer to open the exact
        page and quote here.
      </EmptyState>
    );
  }

  const doc = docs.find((d) => d.id === target.docId);
  const pageCount = pdfPages ?? doc?.n_pages ?? target.page;

  return (
    <div className="source">
      <div className="source-head">
        <div className="source-title">
          <span className="source-doc">{doc?.title ?? target.docId}</span>
          <span className="source-mode">{file.status === "pdf" ? "PDF" : file.status === "none" ? "Indexed text" : ""}</span>
        </div>
        <div className="pager" aria-label="Page navigation">
          <IconButton label="Previous page" size="sm" disabled={target.page <= 1} onClick={() => onPage(target.page - 1)}>
            <IconChevron size={14} style={{ transform: "rotate(180deg)" }} />
          </IconButton>
          <span className="pager-label" aria-live="polite">
            Page {target.page}
            <span className="pager-of"> / {pageCount}</span>
          </span>
          <IconButton label="Next page" size="sm" disabled={target.page >= pageCount} onClick={() => onPage(target.page + 1)}>
            <IconChevron size={14} />
          </IconButton>
        </div>
      </div>

      {target.quote && (
        <figure className="source-quote">
          <blockquote>{target.quote}</blockquote>
          <figcaption>
            {target.n !== undefined && <span className="source-quote-n">[{target.n}]</span>}
            {target.verified !== undefined && <QuoteBadge verified={target.verified} />}
          </figcaption>
        </figure>
      )}

      <div className="source-body">
        {file.status === "loading" && <Skeleton lines={7} />}
        {file.status === "error" && <p className="evidence-empty-note">Couldn't load the file: {file.message}</p>}
        {file.status === "none" && (
          <>
            <p className="source-fallback-note">No PDF stored for this document, so here is the indexed text of the page.</p>
            <ChunkSource docId={target.docId} page={target.page} chunkId={target.chunkId} quote={target.quote} />
          </>
        )}
        {file.status === "pdf" && (
          <Suspense fallback={<Skeleton lines={8} />}>
            <PdfViewer data={file.data} page={target.page} quote={target.quote} onPageCount={onPageCount} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

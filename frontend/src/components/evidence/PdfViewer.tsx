import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, TextLayer, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
// Vite turns this into a URL to the bundled worker file (no CDN).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { findQuote } from "../../lib/findQuote";
import { Skeleton } from "../ui/Feedback";
import "./pdf.css";

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Renders ONE page of a PDF (canvas + invisible text layer) and highlights the cited quote by
 * marking the text-layer spans that overlap it. Lazy-loaded: pdf.js is ~300 KB and only needed
 * when a document actually has a stored PDF.
 *
 * Highlighting is best effort: pdf.js splits text into positioned runs, so we join the runs,
 * find the quote in the joined string (forgiving whitespace/case), and mark every run that
 * overlaps the match.
 */
export default function PdfViewer({
  data,
  page,
  quote,
  onPageCount,
}: {
  data: ArrayBuffer;
  page: number;
  quote: string | null;
  onPageCount?: (n: number) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [found, setFound] = useState<boolean | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Load the document once per byte buffer. pdf.js transfers the buffer to its worker, so give it
  // a copy and keep our cached original intact.
  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ data: data.slice(0) });
    task.promise
      .then((doc) => {
        if (cancelled) return;
        setPdf(doc);
        onPageCount?.(doc.numPages);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [data, onPageCount]);

  // Render the requested page whenever page / quote / container width changes.
  useEffect(() => {
    if (!pdf || !hostRef.current || !canvasRef.current || !textRef.current) return;
    let cancelled = false;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const textDiv = textRef.current;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

    const draw = async () => {
      setRendering(true);
      const p = await pdf.getPage(Math.min(Math.max(1, page), pdf.numPages));
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const scale = host.clientWidth / base.width;
      const viewport = p.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderTask = p.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      await renderTask.promise;
      if (cancelled) return;

      // Text layer: pdf.js positions spans using the --scale-factor CSS variable.
      textDiv.replaceChildren();
      textDiv.style.setProperty("--scale-factor", String(viewport.scale));
      const layer = new TextLayer({ textContentSource: await p.getTextContent(), container: textDiv, viewport });
      await layer.render();
      if (cancelled) return;

      setFound(quote ? highlight(layer.textDivs, layer.textContentItemsStr, quote) : null);
      setRendering(false);
      textDiv.querySelector(".pdf-hl")?.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    draw().catch((e: unknown) => {
      if (!cancelled && !(e instanceof Error && e.name === "RenderingCancelledException")) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, page, quote]);

  if (error) return <p className="evidence-empty-note">Couldn't render the PDF: {error}</p>;

  return (
    <div className="pdf-viewer">
      {quote && found === false && !rendering && (
        <p className="pdf-note">The exact quote couldn't be located on this page's text layer; it may be split across columns.</p>
      )}
      <div ref={hostRef} className="pdf-page">
        {rendering && <Skeleton lines={8} className="pdf-skeleton" />}
        <canvas ref={canvasRef} />
        <div ref={textRef} className="textLayer" />
      </div>
    </div>
  );
}

/** Mark text-layer spans overlapping the quote. Returns whether anything matched. */
function highlight(divs: HTMLElement[], strs: string[], quote: string): boolean {
  // Join runs with a space so words from adjacent runs don't fuse; remember each run's offset.
  const starts: number[] = [];
  let joined = "";
  strs.forEach((s) => {
    starts.push(joined.length);
    joined += s + " ";
  });
  const range = findQuote(joined, quote);
  if (!range) return false;
  const [from, to] = range;
  strs.forEach((s, i) => {
    const a = starts[i];
    const b = a + s.length;
    if (b > from && a < to) divs[i]?.classList.add("pdf-hl");
  });
  return true;
}

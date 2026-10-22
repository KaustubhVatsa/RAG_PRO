import type { Document } from "../../api/types";
import { IconAlert, IconCheck } from "../icons";

/** Ready / processing / failed, each with its own glyph (not colour alone). */
export function DocStatusChip({ doc }: { doc: Pick<Document, "status" | "n_chunks" | "n_pages" | "error"> }) {
  if (doc.status === "ready") {
    return (
      <span className="status-chip status-ready">
        <IconCheck size={11} strokeWidth={2.4} />
        Ready
        <span className="status-meta">
          {doc.n_pages} pages · {doc.n_chunks} passages
        </span>
      </span>
    );
  }
  if (doc.status === "processing") {
    return (
      <span className="status-chip status-processing">
        <span className="status-spinner" aria-hidden="true" />
        Indexing…
      </span>
    );
  }
  return (
    <span className="status-chip status-failed" title={doc.error ?? undefined}>
      <IconAlert size={11} strokeWidth={2.2} />
      Failed
    </span>
  );
}

import { useState } from "react";
import type { Document } from "../../api/types";
import { useDocuments } from "../../state/documents";
import { IconAlert, IconClose, IconFile, IconTrash } from "../icons";
import { Button, IconButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { PanelLabel, Skeleton } from "../ui/Feedback";
import { DocStatusChip } from "./DocStatusChip";
import { Dropzone } from "./Dropzone";

/**
 * The document library: upload, select (multi), delete. Selected documents are what the chat
 * asks about.
 */
export function Library() {
  const { docs, loaded, backend, selected, toggleSelected, setSelected, uploads, dismissUpload, remove } = useDocuments();
  const [confirm, setConfirm] = useState<Document | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const ready = docs.filter((d) => d.status === "ready");
  const allSelected = ready.length > 0 && ready.every((d) => selected.includes(d.id));

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await remove(confirm.id);
      setConfirm(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="library">
      <div className="library-head">
        <PanelLabel count={docs.length}>Library</PanelLabel>
        {ready.length > 1 && (
          <button
            type="button"
            className="link-btn"
            onClick={() => setSelected(allSelected ? [] : ready.map((d) => d.id))}
          >
            {allSelected ? "Clear" : "Select all"}
          </button>
        )}
      </div>

      <Dropzone variant="compact" />

      {uploads
        .filter((u) => u.error)
        .map((u) => (
          <div key={u.key} className="upload-error" role="alert">
            <IconAlert size={14} />
            <div>
              <strong>{u.name}</strong>
              <span>{u.error}</span>
            </div>
            <IconButton label="Dismiss" size="sm" onClick={() => dismissUpload(u.key)}>
              <IconClose size={14} />
            </IconButton>
          </div>
        ))}

      {!loaded && <Skeleton lines={4} className="library-skeleton" />}
      {loaded && backend === "offline" && (
        <p className="library-note">Can't reach the backend. Start it with <code>make api</code>.</p>
      )}
      {loaded && backend !== "offline" && docs.length === 0 && (
        <p className="library-note">No documents yet. Upload a PDF to begin.</p>
      )}

      <ul className="doc-list" aria-label="Documents">
        {docs.map((d) => {
          const isSel = selected.includes(d.id);
          return (
            <li key={d.id} className={`doc-row ${isSel ? "is-selected" : ""} status-${d.status}`}>
              <label className="doc-check">
                <input
                  type="checkbox"
                  checked={isSel}
                  disabled={d.status !== "ready"}
                  onChange={() => toggleSelected(d.id)}
                  aria-describedby={`doc-${d.id}-status`}
                />
                <span className="checkbox" aria-hidden="true" />
                <span className="doc-icon" aria-hidden="true">
                  <IconFile size={16} />
                </span>
                <span className="doc-text">
                  <span className="doc-title">{d.title}</span>
                  <span id={`doc-${d.id}-status`}>
                    <DocStatusChip doc={d} />
                  </span>
                  {d.status === "failed" && d.error && <span className="doc-error">{d.error}</span>}
                </span>
              </label>
              <IconButton label={`Delete ${d.title}`} size="sm" className="doc-delete" onClick={() => setConfirm(d)}>
                <IconTrash size={15} />
              </IconButton>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
          setDeleteError(null);
        }}
        title="Delete this document?"
        description={
          <>
            <strong>{confirm?.title}</strong> and its indexed passages will be removed. This can't be undone.
            {deleteError && <p className="dialog-error">{deleteError}</p>}
          </>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} data-autofocus>
              Cancel
            </Button>
            <Button variant="danger" icon={<IconTrash size={15} />} onClick={doDelete}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}

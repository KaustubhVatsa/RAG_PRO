import { useRef, useState, type DragEvent } from "react";
import type { Document } from "../../api/types";
import { useTilt } from "../../lib/media";
import { useDocuments } from "../../state/documents";
import { IconUpload } from "../icons";

interface Props {
  variant?: "hero" | "compact";
  /** Called after the server accepted the file (status "processing"). */
  onUploaded?: (doc: Document) => void;
}

/**
 * Drag-and-drop (or click / Enter) PDF upload. The whole zone is one <button> so it is keyboard
 * and screen-reader friendly; dragging a file over it lights it up. The hero variant tilts in 3D
 * toward the pointer.
 */
export function Dropzone({ variant = "compact", onUploaded }: Props) {
  const { upload, uploads } = useDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  const tiltRef = useTilt<HTMLDivElement>(variant === "hero" ? 5 : 0);
  const [dragging, setDragging] = useState(false);
  const active = uploads.filter((u) => !u.error);
  const uploading = active.length > 0;
  const progress = uploading ? active.reduce((s, u) => s + u.progress, 0) / active.length : 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const doc = await upload(f);
      if (doc) onUploaded?.(doc);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      ref={tiltRef}
      className={`dropzone dropzone-${variant} ${dragging ? "is-dragging" : ""} ${uploading ? "is-uploading" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="dropzone-btn"
        onClick={() => inputRef.current?.click()}
        aria-describedby={variant === "hero" ? "dropzone-help" : undefined}
        disabled={uploading}
      >
        <span className="dropzone-icon" aria-hidden="true">
          {uploading ? <ProgressRing value={progress} /> : <IconUpload size={variant === "hero" ? 22 : 16} />}
        </span>
        <span className="dropzone-text">
          {uploading ? (
            <>
              <strong>Uploading {active[0].name}</strong>
              <span className="dropzone-sub">{Math.round(progress * 100)}%</span>
            </>
          ) : dragging ? (
            <strong>Drop to upload</strong>
          ) : variant === "hero" ? (
            <>
              <strong>Drop a PDF here</strong>
              <span className="dropzone-sub" id="dropzone-help">
                or click to browse · up to 25 MB
              </span>
            </>
          ) : (
            <strong>Upload PDF</strong>
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      {uploading && <span className="dropzone-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />}
    </div>
  );
}

/** Circular progress (SVG). `value` 0..1. */
export function ProgressRing({ value, size = 22 }: { value: number; size?: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" className="progress-ring" aria-hidden="true">
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}

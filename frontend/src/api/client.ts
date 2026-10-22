import type { ChatEvent, ChatRequest, Chunk, Document, Health } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

/** An HTTP error with the backend's human-readable message (FastAPI puts it in `detail`). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Pull FastAPI's `{"detail": "..."}` out of an error body, falling back to the raw text. */
function detailFrom(body: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "detail" in parsed) {
      const detail = (parsed as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
    }
  } catch {
    /* not JSON: use the text as-is */
  }
  return body || `Request failed (${status})`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, detailFrom(await res.text(), res.status));
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch(`${BASE}/api/health`).then(json<Health>),
  documents: () => fetch(`${BASE}/api/documents`).then(json<Document[]>),
  document: (id: string) => fetch(`${BASE}/api/documents/${id}`).then(json<Document>),
  /** Simple upload without progress (kept for scripts/tests). The UI uses `uploadWithProgress`. */
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/api/documents`, { method: "POST", body: form }).then(json<Document>);
  },
  remove: async (id: string) => {
    const res = await fetch(`${BASE}/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) throw new ApiError(res.status, detailFrom(await res.text(), res.status));
  },
  fileUrl: (id: string) => `${BASE}/api/documents/${id}/file`,
  /** Chunks on one (1-based) page: used to show cited text when there is no stored PDF. */
  chunks: (id: string, page: number) =>
    fetch(`${BASE}/api/documents/${id}/chunks?page=${page}`).then(json<Chunk[]>),
  /** Newest eval result of a kind. The backend returns `{}` when none exists. */
  evalLatest: (kind: "retrieval" | "answer") =>
    fetch(`${BASE}/api/eval/latest?kind=${kind}`).then(json<unknown>),
};

/**
 * The original PDF bytes, or `null` when the backend has no stored file (404, e.g. the built-in
 * demo document). Cached per document so switching citations doesn't re-download the PDF.
 */
const fileCache = new Map<string, Promise<ArrayBuffer | null>>();
export function fetchPdfBytes(id: string): Promise<ArrayBuffer | null> {
  let pending = fileCache.get(id);
  if (!pending) {
    pending = fetch(api.fileUrl(id)).then(async (res) => {
      if (res.status === 404) return null;
      if (!res.ok) throw new ApiError(res.status, detailFrom(await res.text(), res.status));
      return res.arrayBuffer();
    });
    // Don't cache failures: a later attempt may succeed.
    pending.catch(() => fileCache.delete(id));
    fileCache.set(id, pending);
  }
  return pending;
}

/**
 * Upload a PDF and report progress (0..1). `fetch` cannot report upload progress, so this uses
 * XMLHttpRequest. Resolves with the new Document (status "processing"); poll until ready.
 */
export function uploadWithProgress(
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Document> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/documents`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(JSON.parse(xhr.responseText) as Document);
      } else {
        reject(new ApiError(xhr.status, detailFrom(xhr.responseText, xhr.status)));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error: is the backend running?"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** POST /api/chat and yield the SSE events as they arrive. */
export async function* chat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, detailFrom(await res.text(), res.status));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line; each has an `event:` and a `data:` line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (dataLine) yield JSON.parse(dataLine.slice(6)) as ChatEvent;
    }
  }
}

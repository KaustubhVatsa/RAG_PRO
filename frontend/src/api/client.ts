import type { ChatEvent, ChatRequest, Document, Health } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch(`${BASE}/api/health`).then(json<Health>),
  documents: () => fetch(`${BASE}/api/documents`).then(json<Document[]>),
  document: (id: string) => fetch(`${BASE}/api/documents/${id}`).then(json<Document>),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/api/documents`, { method: "POST", body: form }).then(json<Document>);
  },
  remove: (id: string) => fetch(`${BASE}/api/documents/${id}`, { method: "DELETE" }),
  fileUrl: (id: string) => `${BASE}/api/documents/${id}/file`,
};

/** POST /api/chat and yield the SSE events as they arrive. */
export async function* chat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (dataLine) yield JSON.parse(dataLine.slice(6)) as ChatEvent;
    }
  }
}

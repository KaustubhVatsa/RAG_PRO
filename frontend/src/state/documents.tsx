import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, uploadWithProgress } from "../api/client";
import type { Document, Health } from "../api/types";

/**
 * App-wide document state: the library, which documents are selected for chat, in-flight uploads,
 * and backend health. Lives in a context because the home page, the workspace and the 3D scene all
 * read it.
 */

/** An upload that hasn't produced a Document yet (bytes still travelling, or it was rejected). */
export interface PendingUpload {
  key: string;
  name: string;
  progress: number; // 0..1
  error: string | null;
}

export type BackendState = "loading" | "online" | "offline";

interface DocumentsValue {
  docs: Document[];
  loaded: boolean;
  backend: BackendState;
  health: Health | null;
  selected: string[];
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  uploads: PendingUpload[];
  dismissUpload: (key: string) => void;
  /** Upload a PDF; resolves with the new (processing) document, or null if it failed. */
  upload: (file: File) => Promise<Document | null>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<DocumentsValue | null>(null);

export const DEMO_DOC_ID = "demo-attention";
const MAX_UPLOAD_MB = 25;

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [backend, setBackend] = useState<BackendState>("loading");
  const [selected, setSelected] = useState<string[]>([]);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  // Docs uploaded in this session: auto-select them once they become ready.
  const autoSelect = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const list = await api.documents();
      setDocs(list);
      setBackend("online");
    } catch {
      setBackend("offline");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setHealth(h);
        setBackend("online");
      })
      .catch(() => setBackend("offline"));
    void refresh();
  }, [refresh]);

  // Poll once a second while anything is still processing (the backend ingests in the background).
  const processing = docs.some((d) => d.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const t = window.setInterval(() => void refresh(), 1000);
    return () => window.clearInterval(t);
  }, [processing, refresh]);

  // Selection hygiene: drop ids that disappeared or aren't ready; auto-select fresh uploads.
  useEffect(() => {
    setSelected((sel) => {
      const ready = new Set(docs.filter((d) => d.status === "ready").map((d) => d.id));
      const next = sel.filter((id) => ready.has(id));
      for (const id of autoSelect.current) {
        if (ready.has(id)) {
          autoSelect.current.delete(id);
          if (!next.includes(id)) next.push(id);
        }
      }
      return next.length === sel.length && next.every((id, i) => id === sel[i]) ? sel : next;
    });
  }, [docs]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const upload = useCallback(
    async (file: File) => {
      const key = `${file.name}-${Date.now()}`;
      const fail = (error: string) =>
        setUploads((u) => [...u.filter((x) => x.key !== key), { key, name: file.name, progress: 0, error }]);
      if (!isPdf(file)) {
        fail("Only PDF files are supported.");
        return null;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        fail(`That PDF is larger than ${MAX_UPLOAD_MB} MB.`);
        return null;
      }
      setUploads((u) => [...u, { key, name: file.name, progress: 0, error: null }]);
      try {
        const doc = await uploadWithProgress(file, (p) =>
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))),
        );
        setUploads((u) => u.filter((x) => x.key !== key));
        autoSelect.current.add(doc.id);
        setDocs((d) => [doc, ...d.filter((x) => x.id !== doc.id)]);
        return doc;
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        return null;
      }
    },
    [],
  );

  const dismissUpload = useCallback((key: string) => {
    setUploads((u) => u.filter((x) => x.key !== key));
  }, []);

  const remove = useCallback(
    async (id: string) => {
      await api.remove(id);
      setDocs((d) => d.filter((x) => x.id !== id));
      setSelected((s) => s.filter((x) => x !== id));
    },
    [],
  );

  const value = useMemo<DocumentsValue>(
    () => ({
      docs,
      loaded,
      backend,
      health,
      selected,
      setSelected,
      toggleSelected,
      uploads,
      dismissUpload,
      upload,
      remove,
      refresh,
    }),
    [docs, loaded, backend, health, selected, toggleSelected, uploads, dismissUpload, upload, remove, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDocuments(): DocumentsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDocuments must be used inside <DocumentsProvider>");
  return v;
}

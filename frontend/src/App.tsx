import { useCallback, useEffect, useRef, useState } from "react";
import { api, chat } from "./api/client";
import type { Answer, ChatMode, Claim, Document, Health, ScoredChunk } from "./api/types";

interface Turn {
  question: string;
  text: string;
  answer?: Answer;
  claims?: Claim[];
  retrieved?: ScoredChunk[];
  error?: string;
}

// TODO(frontend): replace this v0 with the real design: PDF viewer with page jump + highlights,
// claim-level confidence colours, eval dashboard page. The API client + types are ready.
export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<ChatMode>("answer");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => api.documents().then(setDocs).catch(() => {}), []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    refresh();
  }, [refresh]);

  // poll while any document is still processing
  useEffect(() => {
    if (!docs.some((d) => d.status === "processing")) return;
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [docs, refresh]);

  // auto-select the first ready doc
  useEffect(() => {
    if (selected.length === 0) {
      const first = docs.find((d) => d.status === "ready");
      if (first) setSelected([first.id]);
    }
  }, [docs, selected.length]);

  async function onUpload(file: File | undefined) {
    if (!file) return;
    try {
      await api.upload(file);
      refresh();
    } catch (e) {
      alert(String(e));
    }
  }

  async function ask() {
    const question = input.trim();
    if (!question || busy || selected.length === 0) return;
    setInput("");
    setBusy(true);
    const idx = turns.length;
    setTurns((t) => [...t, { question, text: "" }]);
    const patch = (p: Partial<Turn>) =>
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, ...p } : x)));
    try {
      let text = "";
      const history = turns.flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.answer?.text ?? t.text },
      ]);
      for await (const ev of chat({ question, doc_ids: selected, mode, history })) {
        if (ev.type === "retrieval") patch({ retrieved: ev.chunks });
        else if (ev.type === "token") patch({ text: (text += ev.text) });
        else if (ev.type === "claims") patch({ claims: ev.claims });
        else if (ev.type === "done") patch({ answer: ev.answer, text: ev.answer.text });
        else if (ev.type === "error") patch({ error: ev.message });
      }
    } catch (e) {
      patch({ error: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <aside>
        <h1>Verity</h1>
        {health && health.llm_provider === "mock" && (
          <div className="badge">mock mode: canned answers</div>
        )}
        <button onClick={() => fileRef.current?.click()}>+ Upload PDF</button>
        <input ref={fileRef} type="file" accept="application/pdf" hidden
          onChange={(e) => onUpload(e.target.files?.[0])} />
        <ul>
          {docs.map((d) => (
            <li key={d.id}>
              <label>
                <input type="checkbox" disabled={d.status !== "ready"}
                  checked={selected.includes(d.id)}
                  onChange={(e) => setSelected((s) =>
                    e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id))} />
                {d.title}
              </label>
              <small className={`status ${d.status}`}>
                {d.status === "ready" ? `${d.n_chunks} chunks` : d.status}
                {d.error ? `: ${d.error}` : ""}
              </small>
            </li>
          ))}
        </ul>
      </aside>

      <main>
        <div className="turns">
          {turns.length === 0 && <p className="hint">Select a document and ask a question.</p>}
          {turns.map((t, i) => (
            <div key={i} className="turn">
              <div className="q">{t.question}</div>
              <div className={`a ${t.answer?.abstained ? "abstained" : ""}`}>
                {t.text || (busy && i === turns.length - 1 ? "…" : "")}
                {t.error && <div className="err">{t.error}</div>}
              </div>
              {t.answer && t.answer.citations.length > 0 && (
                <div className="cites">
                  {t.answer.citations.map((c) => (
                    <span key={c.n} className="cite" title={c.quote}>[{c.n}] p.{c.page}</span>
                  ))}
                </div>
              )}
              {t.claims && (
                <ul className="claims">
                  {t.claims.map((c, j) => (
                    <li key={j} className={`claim ${c.status}`}>{c.status}: {c.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <select value={mode} onChange={(e) => setMode(e.target.value as ChatMode)}>
            <option value="answer">Answer</option>
            <option value="teacher">Teacher</option>
            <option value="factcheck">Fact-check</option>
          </select>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "factcheck" ? "Paste a statement to verify…" : "Ask about the paper…"} />
          <button disabled={busy || selected.length === 0}>Send</button>
        </form>
      </main>
    </div>
  );
}

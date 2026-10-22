import { useEffect, useRef, useState, type RefObject } from "react";
import type { ChatMode, Citation } from "../../api/types";
import { useReducedMotion } from "../../lib/media";
import { renderInline } from "../../lib/markdown";
import { displayText, useChat } from "../../state/chat";
import { useDocuments } from "../../state/documents";
import { IconLens, IconSparkle } from "../icons";
import { AssistantMessage } from "./AssistantMessage";
import { Composer, MODES } from "./Composer";

interface Props {
  onOpenCitation: (turnId: string, c: Citation) => void;
  active: { turnId: string; n: number } | null;
  inputRef: RefObject<HTMLTextAreaElement>;
}

const SUGGESTIONS: { mode: ChatMode; q: string }[] = [
  { mode: "answer", q: "How does multi-head attention work?" },
  { mode: "teacher", q: "Why are the dot products scaled by √d_k?" },
  { mode: "factcheck", q: "The Transformer relies on recurrence to model long-range dependencies." },
];

export function ChatPanel({ onOpenCitation, active, inputRef }: Props) {
  const { turns, busy, send, stop, retry } = useChat();
  const { docs, selected } = useDocuments();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ChatMode>("answer");
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const selectedDocs = docs.filter((d) => selected.includes(d.id));
  const blockedReason = selectedDocs.length === 0 ? "Select a document in the library to start…" : null;

  const submit = (q = draft, m = mode) => {
    const question = q.trim();
    if (!question || busy || blockedReason) return;
    send(question, m, selected);
    setDraft("");
    stickToBottom.current = true;
  };

  // Keep the view pinned to the newest text, unless the user scrolled up to read.
  const last = turns[turns.length - 1];
  const lastLen = last ? displayText(last).length : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [turns.length, lastLen, last?.status, reduced]);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Screen-reader announcements: status changes only, never token by token.
  const announcement = !last
    ? ""
    : last.status === "retrieving"
      ? "Searching the document."
      : last.status === "done" && last.answer
        ? last.answer.abstained
          ? "Verity could not find this in the document."
          : `Answer ready. ${last.answer.text}`
        : last.status === "error"
          ? `Error: ${last.error}`
          : last.status === "stopped"
            ? "Stopped."
            : "";

  return (
    <section className="chat" aria-label="Conversation">
      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="chat-inner" role="log" aria-live="off">
          {turns.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon" aria-hidden="true">
                <IconLens size={22} />
              </div>
              <h2 className="chat-empty-title">Ask the paper</h2>
              <p className="chat-empty-text">
                {selectedDocs.length
                  ? `Asking ${selectedDocs.length === 1 ? `“${selectedDocs[0].title}”` : `${selectedDocs.length} documents`}. Every claim comes back with a page and the exact quote, or an honest “not in the paper”.`
                  : "Pick a document from the library (or upload one) and ask a question."}
              </p>
              {selectedDocs.length > 0 && (
                <ul className="suggestions" aria-label="Suggested questions">
                  {SUGGESTIONS.map((s) => (
                    <li key={s.q}>
                      <button
                        type="button"
                        className="suggestion"
                        onClick={() => {
                          setMode(s.mode);
                          submit(s.q, s.mode);
                        }}
                      >
                        <span className="suggestion-mode">
                          <IconSparkle size={12} />
                          {MODES.find((m) => m.value === s.mode)?.label}
                        </span>
                        <span className="suggestion-q">{renderInline(s.q)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {turns.map((t, i) => (
            <div key={t.id} className="turn">
              <div className="msg msg-user">
                <div className="msg-bubble">
                  <span className="visually-hidden">You asked: </span>
                  {t.question}
                </div>
              </div>
              <AssistantMessage
                turn={t}
                animate={!reduced && i === turns.length - 1}
                onOpenCitation={onOpenCitation}
                activeCitation={active?.turnId === t.id ? active.n : null}
                onRetry={retry}
                onSuggest={(q) => {
                  setDraft(q);
                  inputRef.current?.focus();
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
      <div className="chat-composer">
        <Composer
          value={draft}
          onChange={setDraft}
          mode={mode}
          onModeChange={setMode}
          onSend={() => submit()}
          onStop={stop}
          busy={busy}
          blockedReason={blockedReason}
          inputRef={inputRef}
        />
      </div>
    </section>
  );
}

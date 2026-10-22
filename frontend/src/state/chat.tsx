import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, chat } from "../api/client";
import type { Answer, ChatMode, Claim, Message, ScoredChunk } from "../api/types";
import { visibleStreamText } from "../lib/answerText";

/**
 * Conversation state. One Turn = one question and its (streaming, then final) answer.
 *
 * SSE event handling (see contracts/openapi.yaml):
 *   retrieval -> store the ranked passages (the Evidence panel + 3D scene light up)
 *   token*    -> append to `raw` (the UI shows visibleStreamText(raw), hiding the Evidence block)
 *   claims    -> store claim verdicts
 *   done      -> store the final Answer; its `text` replaces the streamed text
 *   error     -> show an error with retry
 */
export type TurnStatus = "retrieving" | "streaming" | "done" | "error" | "stopped";

export interface Turn {
  id: string;
  question: string;
  mode: ChatMode;
  docIds: string[];
  status: TurnStatus;
  raw: string;
  retrieved: ScoredChunk[] | null;
  claims: Claim[] | null;
  answer: Answer | null;
  error: string | null;
}

/** The text to display for a turn: the clean final text once done, else the filtered stream. */
export function displayText(t: Turn): string {
  return t.answer ? t.answer.text : visibleStreamText(t.raw);
}

export const isBusy = (t: Turn | undefined) =>
  t !== undefined && (t.status === "retrieving" || t.status === "streaming");

interface ChatValue {
  turns: Turn[];
  busy: boolean;
  send: (question: string, mode: ChatMode, docIds: string[]) => void;
  stop: () => void;
  retry: (turnId: string) => void;
  clear: () => void;
}

const Ctx = createContext<ChatValue | null>(null);

let seq = 0;
const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return `A selected document isn't ready yet. ${e.message}`;
    if (e.status === 422) return "Select at least one document to ask about.";
    if (e.status === 0) return e.message;
    return e.message;
  }
  if (e instanceof TypeError) return "Can't reach the Verity backend. Is it running on :8000?";
  return e instanceof Error ? e.message : String(e);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  // A ref copy of turns so `run` can build history without being re-created on every token.
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  const patch = useCallback((id: string, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => {
    setTurns((all) =>
      all.map((t) => (t.id === id ? { ...t, ...(typeof p === "function" ? p(t) : p) } : t)),
    );
  }, []);

  /** Stream one turn. `history` is everything before it (only finished answers). */
  const run = useCallback(
    async (turn: Turn, history: Message[]) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const stream = chat(
          { question: turn.question, doc_ids: turn.docIds, mode: turn.mode, history },
          ctrl.signal,
        );
        for await (const ev of stream) {
          switch (ev.type) {
            case "retrieval":
              patch(turn.id, { retrieved: ev.chunks, status: "streaming" });
              break;
            case "token":
              patch(turn.id, (t) => ({ raw: t.raw + ev.text, status: "streaming" }));
              break;
            case "claims":
              patch(turn.id, { claims: ev.claims });
              break;
            case "done":
              patch(turn.id, (t) => ({
                answer: ev.answer,
                claims: ev.answer.claims.length ? ev.answer.claims : t.claims,
                status: "done",
              }));
              break;
            case "error":
              patch(turn.id, { error: ev.message, status: "error" });
              break;
          }
        }
        // Stream ended without done/error (connection dropped): treat as an error.
        patch(turn.id, (t) =>
          t.status === "done" || t.status === "error"
            ? {}
            : { status: "error", error: "The answer stream ended unexpectedly." },
        );
      } catch (e) {
        if (ctrl.signal.aborted) patch(turn.id, { status: "stopped" });
        else patch(turn.id, { status: "error", error: errorMessage(e) });
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [patch],
  );

  const historyBefore = (all: Turn[], index: number): Message[] =>
    all.slice(0, index).flatMap((t) =>
      t.answer
        ? [
            { role: "user" as const, content: t.question },
            { role: "assistant" as const, content: t.answer.text },
          ]
        : [],
    );

  const send = useCallback(
    (question: string, mode: ChatMode, docIds: string[]) => {
      const turn: Turn = {
        id: newId(),
        question,
        mode,
        docIds,
        status: "retrieving",
        raw: "",
        retrieved: null,
        claims: null,
        answer: null,
        error: null,
      };
      const history = historyBefore(turnsRef.current, turnsRef.current.length);
      setTurns((t) => [...t, turn]);
      void run(turn, history);
    },
    [run],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(
    (turnId: string) => {
      const all = turnsRef.current;
      const i = all.findIndex((t) => t.id === turnId);
      if (i === -1) return;
      const fresh: Turn = {
        ...all[i],
        status: "retrieving",
        raw: "",
        retrieved: null,
        claims: null,
        answer: null,
        error: null,
      };
      setTurns((t) => t.map((x) => (x.id === turnId ? fresh : x)));
      void run(fresh, historyBefore(all, i));
    },
    [run],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
  }, []);

  const busy = isBusy(turns[turns.length - 1]);
  const value = useMemo(
    () => ({ turns, busy, send, stop, retry, clear }),
    [turns, busy, send, stop, retry, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat(): ChatValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChat must be used inside <ChatProvider>");
  return v;
}

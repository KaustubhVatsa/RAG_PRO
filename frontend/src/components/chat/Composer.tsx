import { useEffect, useLayoutEffect, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { ChatMode } from "../../api/types";
import { IconSend, IconStop } from "../icons";
import { Kbd } from "../ui/Feedback";
import { SegmentedControl, type SegmentOption } from "../ui/SegmentedControl";

export const MODES: (SegmentOption<ChatMode> & { hint: string; placeholder: string })[] = [
  {
    value: "answer",
    label: "Answer",
    hint: "A direct answer. Every sentence cites a page and an exact quote.",
    placeholder: "Ask anything about the paper…",
  },
  {
    value: "teacher",
    label: "Teacher",
    hint: "Step-by-step explanation in plain words, ending with a check-your-understanding question.",
    placeholder: "What would you like explained?",
  },
  {
    value: "factcheck",
    label: "Fact-check",
    hint: "Paste a statement. Verity rules it supported, contradicted, or not in the paper.",
    placeholder: "Paste a statement to check against the paper…",
  },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  /** Why sending is impossible right now (e.g. no document selected), or null. */
  blockedReason: string | null;
  inputRef: RefObject<HTMLTextAreaElement>;
}

/**
 * Message box. Enter sends, Shift+Enter inserts a newline. While an answer streams the send
 * button becomes a stop button (aborts the request).
 */
export function Composer({ value, onChange, mode, onModeChange, onSend, onStop, busy, blockedReason, inputRef }: Props) {
  const current = MODES.find((m) => m.value === mode) ?? MODES[0];
  const canSend = !busy && !blockedReason && value.trim().length > 0;

  // Auto-grow the textarea up to ~8 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value, inputRef]);

  // Focus on mount (desktop): the user came here to ask something.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [inputRef]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (canSend) onSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={submit} aria-label="Ask Verity">
      <div className="composer-top">
        <SegmentedControl label="Answer mode" value={mode} options={MODES} onChange={onModeChange} size="sm" />
        <p className="composer-hint" id="mode-hint">
          {current.hint}
        </p>
      </div>
      <div className={`composer-box ${busy ? "is-busy" : ""}`}>
        <label htmlFor="composer-input" className="visually-hidden">
          {mode === "factcheck" ? "Statement to check" : "Your question"}
        </label>
        <textarea
          id="composer-input"
          ref={inputRef}
          rows={1}
          value={value}
          placeholder={blockedReason ?? current.placeholder}
          aria-describedby="mode-hint composer-keys"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {busy ? (
          <button type="button" className="composer-send is-stop" onClick={onStop} aria-label="Stop generating">
            <IconStop size={16} />
          </button>
        ) : (
          <button type="submit" className="composer-send" disabled={!canSend} aria-label="Send">
            <IconSend size={18} />
          </button>
        )}
      </div>
      <p className="composer-keys" id="composer-keys">
        <Kbd>Enter</Kbd> send <span aria-hidden="true">·</span> <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line{" "}
        <span aria-hidden="true">·</span> <Kbd>/</Kbd> focus <span aria-hidden="true">·</span> <Kbd>Esc</Kbd> close panels
      </p>
    </form>
  );
}

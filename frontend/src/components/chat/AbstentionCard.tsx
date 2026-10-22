import type { ChatMode } from "../../api/types";

/**
 * Shown when Verity declines to answer. This is the system working as designed (no evidence, no
 * answer), so it is calm and informative: no error colour, no alarm icon.
 */
export function AbstentionCard({
  text,
  reason,
  mode,
  onSuggest,
}: {
  text: string;
  reason: string | null;
  mode: ChatMode;
  /** Pre-fill the composer with a follow-up. */
  onSuggest?: (q: string) => void;
}) {
  return (
    <div className="abstain">
      <div className="abstain-art" aria-hidden="true">
        {/* an open lens with nothing in it: "looked, found nothing" */}
        <svg viewBox="0 0 48 48" width="44" height="44" fill="none">
          <circle cx="21" cy="21" r="12.5" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3.4" />
          <path d="M30.5 30.5l8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M16 21h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="abstain-body">
        <div className="abstain-kicker">{mode === "factcheck" ? "Not enough information" : "Not in this document"}</div>
        <p className="abstain-text">{text}</p>
        {reason && <p className="abstain-reason">Why: {reason}.</p>}
        <p className="abstain-help">
          Verity only answers from the selected paper. That keeps every answer checkable. Try rephrasing with the
          paper's own terms, or select another document.
        </p>
        {onSuggest && (
          <div className="abstain-actions">
            <button type="button" className="chip-btn" onClick={() => onSuggest("What is this paper's main contribution?")}>
              What is the main contribution?
            </button>
            <button type="button" className="chip-btn" onClick={() => onSuggest("Summarise the method section.")}>
              Summarise the method
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

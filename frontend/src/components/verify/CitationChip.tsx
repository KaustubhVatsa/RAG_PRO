import type { Citation } from "../../api/types";
import { useHoverPopover } from "../ui/Popover";
import { QUOTE_META, QuoteBadge, quoteState } from "./meta";

interface Props {
  n: number;
  /** Undefined while streaming (citations arrive with `done`) or if the backend dropped the marker. */
  citation?: Citation;
  /** Section heading of the cited chunk, if we know it from the retrieval event. */
  section?: string | null;
  onOpen?: (c: Citation) => void;
  /** Highlight when this citation is the one open in the Evidence panel. */
  active?: boolean;
}

/**
 * Inline [n] chip. Hover/focus shows the exact quote with page + verification state; click opens
 * the source in the Evidence panel.
 */
export function CitationChip({ n, citation, section, onOpen, active }: Props) {
  const pop = useHoverPopover<HTMLButtonElement>();
  const state = citation ? quoteState(citation.verified) : "none";

  if (!citation) {
    // Not resolved (yet): a quiet, non-interactive marker.
    return (
      <span className="cite-chip is-pending" aria-label={`citation ${n}, resolving`}>
        {n}
      </span>
    );
  }

  const label = `Citation ${n}, page ${citation.page}, ${QUOTE_META[state].label}. Open source.`;
  return (
    <>
      <button
        ref={pop.ref}
        type="button"
        className={`cite-chip cite-${state} ${active ? "is-active" : ""}`}
        aria-label={label}
        onClick={() => onOpen?.(citation)}
        {...pop.triggerProps}
      >
        <span className="cite-n">{n}</span>
        {state !== "none" && <span className="cite-glyph">{QUOTE_META[state].icon(10)}</span>}
      </button>
      {pop.render(
        <div className="cite-pop">
          <div className="cite-pop-head">
            <span className="cite-pop-page">p. {citation.page}</span>
            {section && <span className="cite-pop-section">{section}</span>}
          </div>
          <blockquote className={`cite-pop-quote ${state === "flagged" ? "is-flagged" : ""}`}>
            {citation.quote}
            {state !== "verified" && "…"}
          </blockquote>
          <div className="cite-pop-foot">
            <QuoteBadge verified={citation.verified} />
            <span className="cite-pop-detail">{QUOTE_META[state].detail}</span>
          </div>
          <div className="cite-pop-hint">Click to open the source</div>
        </div>,
        "popover-cite",
      )}
    </>
  );
}

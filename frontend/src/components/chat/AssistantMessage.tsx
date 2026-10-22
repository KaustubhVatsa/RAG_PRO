import type { Citation } from "../../api/types";
import { factcheckVerdict, type Verdict } from "../../lib/answerText";
import { Markdown } from "../../lib/markdown";
import { useSmoothText } from "../../lib/useSmoothText";
import { displayText, type Turn } from "../../state/chat";
import { LogoMark } from "../brand/Logo";
import { IconAlert, IconRetry } from "../icons";
import { Button } from "../ui/Button";
import { ConfidenceMeter, Skeleton } from "../ui/Feedback";
import { CitationChip } from "../verify/CitationChip";
import { QUOTE_META, quoteState } from "../verify/meta";
import { AbstentionCard } from "./AbstentionCard";
import { AnswerBody } from "./AnswerBody";
import { ClaimSummary } from "./ClaimSummary";

interface Props {
  turn: Turn;
  /** Animate the text reveal (latest turn only, and not under reduced motion). */
  animate: boolean;
  onOpenCitation: (turnId: string, c: Citation) => void;
  activeCitation: number | null;
  onRetry: (turnId: string) => void;
  onSuggest?: (q: string) => void;
}

const MODE_LABEL = { answer: "Answer", teacher: "Teacher", factcheck: "Fact-check" } as const;

export function AssistantMessage({ turn, animate, onOpenCitation, activeCitation, onRetry, onSuggest }: Props) {
  const target = displayText(turn);
  const { text, caughtUp } = useSmoothText(target, animate);
  const { answer } = turn;
  const finished = turn.status === "done" && answer !== null && caughtUp;
  const open = (c: Citation) => onOpenCitation(turn.id, c);

  return (
    <article className={`msg msg-assistant status-${turn.status}`} aria-label="Verity's answer">
      <div className="msg-avatar" aria-hidden="true">
        <LogoMark size={20} animated={turn.status === "retrieving"} loop={turn.status === "retrieving"} />
      </div>
      <div className="msg-main">
        <div className="msg-meta">
          <span className="msg-who">Verity</span>
          <span className="msg-mode">{MODE_LABEL[turn.mode]}</span>
          {turn.status === "retrieving" && <span className="msg-state">searching the paper…</span>}
          {turn.status === "streaming" && <span className="msg-state">writing · quoting sources</span>}
          {turn.status === "done" && !caughtUp && <span className="msg-state">checking quotes…</span>}
        </div>

        {turn.status === "retrieving" && <Pipeline />}

        {/* Finished, grounded answer */}
        {finished && answer.abstained && (
          <AbstentionCard text={answer.text} reason={answer.abstain_reason} mode={answer.mode} onSuggest={onSuggest} />
        )}
        {finished && !answer.abstained && (
          <FinishedAnswer turn={turn} open={open} activeCitation={activeCitation} />
        )}

        {/* Streaming (or finishing the reveal): plain markdown + caret; chips resolve on done */}
        {!finished && turn.status !== "retrieving" && text && (
          <div className="md answer-md is-streaming">
            <Markdown
              text={text}
              hooks={{ citation: (n, key) => <CitationChip key={key} n={n} citation={answer?.citations.find((c) => c.n === n)} /> }}
            />
            {(turn.status === "streaming" || !caughtUp) && <span className="caret" aria-hidden="true" />}
          </div>
        )}

        {turn.status === "stopped" && (
          <div className="msg-note">
            <span>Stopped. {text ? "The partial answer above was not verified." : ""}</span>
            <Button size="sm" variant="ghost" icon={<IconRetry size={14} />} onClick={() => onRetry(turn.id)}>
              Ask again
            </Button>
          </div>
        )}

        {turn.status === "error" && (
          <div className="msg-error" role="alert">
            <IconAlert size={18} />
            <div>
              <p className="msg-error-title">Couldn't finish this answer</p>
              <p className="msg-error-detail">{turn.error}</p>
            </div>
            <Button size="sm" variant="secondary" icon={<IconRetry size={14} />} onClick={() => onRetry(turn.id)}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

/** The three pipeline stages, shown while retrieval runs. */
function Pipeline() {
  return (
    <div className="pipeline">
      <ol className="pipeline-steps" aria-label="Answer pipeline">
        <li className="is-active">Retrieve passages</li>
        <li>Answer with quotes</li>
        <li>Check every claim</li>
      </ol>
      <Skeleton lines={3} />
    </div>
  );
}

const VERDICT_META: Record<Verdict, string> = {
  supported: "Supported by the paper",
  contradicted: "Contradicted by the paper",
  nei: "Not enough information",
};

function FinishedAnswer({
  turn,
  open,
  activeCitation,
}: {
  turn: Turn;
  open: (c: Citation) => void;
  activeCitation: number | null;
}) {
  const answer = turn.answer!;
  const claims = answer.claims.length ? answer.claims : turn.claims ?? [];
  // Fact-check answers lead with a verdict word: lift it into a badge.
  const verdict = answer.mode === "factcheck" ? factcheckVerdict(answer.text) : null;
  const body = verdict ? verdict.rest : answer.text;

  return (
    <>
      {verdict && (
        <div className={`verdict verdict-${verdict.verdict}`}>
          <span className="verdict-label">Verdict</span>
          {VERDICT_META[verdict.verdict]}
        </div>
      )}
      <AnswerBody
        text={body}
        claims={claims}
        citations={answer.citations}
        retrieved={turn.retrieved}
        revealed
        onOpenCitation={open}
        activeCitation={activeCitation}
      />
      <div className="answer-foot">
        {answer.citations.length > 0 && (
          <div className="sources-row">
            <span className="sources-label">Sources</span>
            {answer.citations.map((c) => {
              const s = quoteState(c.verified);
              return (
                <button
                  key={c.n}
                  type="button"
                  className={`source-pill cite-${s} ${activeCitation === c.n ? "is-active" : ""}`}
                  onClick={() => open(c)}
                  title={QUOTE_META[s].label}
                >
                  <span className="source-pill-n">{c.n}</span>
                  p. {c.page}
                  {s !== "none" && <span className="cite-glyph">{QUOTE_META[s].icon(10)}</span>}
                </button>
              );
            })}
          </div>
        )}
        <ConfidenceMeter value={answer.confidence} />
        <ClaimSummary claims={claims} />
      </div>
    </>
  );
}

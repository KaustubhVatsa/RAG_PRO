import type { MouseEvent, ReactNode } from "react";
import type { Claim } from "../../api/types";
import { useHoverPopover } from "../ui/Popover";
import { CLAIM_META, ClaimBadge, QuoteBadge } from "./meta";

interface Props {
  claim: Claim;
  /** Position in the answer, used to stagger the underline reveal. */
  index: number;
  /** Plays the underline/tint reveal when true (after the answer finishes). */
  revealed: boolean;
  children: ReactNode;
}

/**
 * A sentence of the answer wrapped with its verification verdict: a tinted sweep plus a status
 * specific underline pattern. Hover or focus shows the verdict, the verifier's note and the
 * evidence quote.
 */
export function ClaimSpan({ claim, index, revealed, children }: Props) {
  const pop = useHoverPopover<HTMLSpanElement>();

  // Citation chips inside the claim have their own popover; don't stack two.
  const onMouseOver = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest(".cite-chip")) pop.hide(0);
    else pop.show();
  };

  return (
    <>
      <span
        ref={pop.ref}
        tabIndex={0}
        className={`claim claim-${claim.status} ${revealed ? "is-revealed" : ""}`}
        style={{ ["--d" as string]: `${index * 110}ms` }}
        onMouseOver={onMouseOver}
        onMouseLeave={() => pop.hide()}
        onFocus={pop.triggerProps.onFocus}
        onBlur={pop.triggerProps.onBlur}
        aria-describedby={pop.triggerProps["aria-describedby"]}
      >
        {children}
        <span className="visually-hidden"> ({CLAIM_META[claim.status].label} claim)</span>
      </span>
      {pop.render(
        <div className="claim-pop">
          <div className="claim-pop-head">
            <ClaimBadge status={claim.status} />
          </div>
          <p className="claim-pop-note">{claim.note ?? CLAIM_META[claim.status].blurb}</p>
          {claim.evidence.length > 0 ? (
            <ul className="claim-pop-evidence">
              {claim.evidence.slice(0, 2).map((c) => (
                <li key={c.n}>
                  <div className="claim-pop-ev-head">
                    <span className="cite-pop-page">
                      [{c.n}] p. {c.page}
                    </span>
                    <QuoteBadge verified={c.verified} />
                  </div>
                  <blockquote className="cite-pop-quote">{c.quote}</blockquote>
                </li>
              ))}
            </ul>
          ) : (
            <p className="claim-pop-none">No citation attached to this sentence.</p>
          )}
        </div>,
        "popover-claim",
      )}
    </>
  );
}

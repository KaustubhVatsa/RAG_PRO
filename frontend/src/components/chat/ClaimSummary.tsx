import { useId, useState } from "react";
import type { Claim } from "../../api/types";
import { renderInline } from "../../lib/markdown";
import { IconChevron } from "../icons";
import { CLAIM_META, CLAIM_ORDER, ClaimBadge } from "../verify/meta";

/**
 * "4 claims · 2 supported · 1 unsupported · 1 unverified" with a stacked bar, expandable to the
 * full claim list. Gives the verdict at a glance without hovering every sentence.
 */
export function ClaimSummary({ claims }: { claims: Claim[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (claims.length === 0) return null;

  const counts = CLAIM_ORDER.map((s) => ({ status: s, n: claims.filter((c) => c.status === s).length })).filter(
    (x) => x.n > 0,
  );

  return (
    <div className="claim-summary">
      <button
        type="button"
        className="claim-summary-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="claim-summary-bar" aria-hidden="true">
          {counts.map((c) => (
            <span key={c.status} className={`claim-summary-seg seg-${c.status}`} style={{ flexGrow: c.n }} />
          ))}
        </span>
        <span className="claim-summary-text">
          <strong>
            {claims.length} claim{claims.length === 1 ? "" : "s"}
          </strong>
          {counts.map((c) => (
            <span key={c.status} className={`claim-summary-count count-${c.status}`}>
              {CLAIM_META[c.status].icon(12)}
              {c.n} {c.status === "unverified" ? "unverified" : CLAIM_META[c.status].label.toLowerCase()}
            </span>
          ))}
        </span>
        <IconChevron size={14} className={`claim-summary-chev ${open ? "is-open" : ""}`} />
      </button>
      {open && (
        <ol id={listId} className="claim-list">
          {claims.map((c, i) => (
            <li key={i} className={`claim-list-item item-${c.status}`}>
              <ClaimBadge status={c.status} compact />
              <div>
                <p>{renderInline(c.text)}</p>
                {c.note && <p className="claim-list-note">{c.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

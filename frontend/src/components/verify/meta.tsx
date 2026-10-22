import type { ReactNode } from "react";
import type { ClaimStatus } from "../../api/types";
import { IconContradict, IconCross, IconCheck, IconPending, IconQuestion, IconSupported } from "../icons";

/**
 * One place that defines how each verification state looks and reads. Colour is never the only
 * signal: every state also has its own icon and its own underline pattern (see verify.css).
 *
 *   supported     solid underline     ✓ in a ring
 *   unsupported   dashed underline    ? in a dashed ring
 *   contradicted  wavy underline      ⊘ slashed ring
 *   unverified    dotted underline    dotted ring
 */
export const CLAIM_META: Record<ClaimStatus, { label: string; blurb: string; icon: (size?: number) => ReactNode }> = {
  supported: {
    label: "Supported",
    blurb: "The cited passage backs this claim.",
    icon: (s = 14) => <IconSupported size={s} />,
  },
  unsupported: {
    label: "Unsupported",
    blurb: "The cited evidence doesn't back this claim.",
    icon: (s = 14) => <IconQuestion size={s} />,
  },
  contradicted: {
    label: "Contradicted",
    blurb: "The paper says otherwise.",
    icon: (s = 14) => <IconContradict size={s} />,
  },
  unverified: {
    label: "Not yet verified",
    blurb: "No verdict yet. Check the cited quote yourself.",
    icon: (s = 14) => <IconPending size={s} />,
  },
};

export const CLAIM_ORDER: ClaimStatus[] = ["supported", "unsupported", "contradicted", "unverified"];

/** Citation.verified: true = quote found verbatim, false = not found (flagged), null = no quote. */
export type QuoteState = "verified" | "flagged" | "none";
export const quoteState = (v: boolean | null | undefined): QuoteState =>
  v === true ? "verified" : v === false ? "flagged" : "none";

export const QUOTE_META: Record<QuoteState, { label: string; detail: string; icon: (size?: number) => ReactNode }> = {
  verified: {
    label: "Quote verified",
    detail: "Found word for word in the source.",
    icon: (s = 12) => <IconCheck size={s} strokeWidth={2.4} />,
  },
  flagged: {
    label: "Quote not found",
    detail: "The model's quote isn't in the source, so this shows the start of the passage instead.",
    icon: (s = 12) => <IconCross size={s} strokeWidth={2.4} />,
  },
  none: {
    label: "No quote given",
    detail: "The model cited this passage without quoting it; showing its opening words.",
    icon: () => null,
  },
};

export function ClaimBadge({ status, compact = false }: { status: ClaimStatus; compact?: boolean }) {
  const meta = CLAIM_META[status];
  return (
    <span className={`claim-badge claim-badge-${status}`}>
      {meta.icon(compact ? 12 : 14)}
      {!compact && <span>{meta.label}</span>}
    </span>
  );
}

export function QuoteBadge({ verified }: { verified: boolean | null | undefined }) {
  const state = quoteState(verified);
  const meta = QUOTE_META[state];
  return (
    <span className={`quote-badge quote-${state}`}>
      {meta.icon(12)}
      {meta.label}
    </span>
  );
}

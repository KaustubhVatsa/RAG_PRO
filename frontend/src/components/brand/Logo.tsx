import "./logo.css";

/**
 * The Verity mark: a lens (an open ring) with a check mark whose long stroke leaves the lens and
 * lands on a single amber node. Read it as "look closely, confirm, and point at the evidence".
 *
 * Geometry (32×32 grid):
 *  - ring: circle centre (15,17), r 11, with a gap cut where the check exits (≈ -62°..-18°)
 *  - check: (9.6,17.4) → (13.6,21.4) → (24.2,9.3)
 *  - node: (26,6.9), r 3: the "evidence point" the answer is anchored to
 * Ring and check use currentColor; the node uses the accent token, so it works on any theme.
 */
const RING = "M25.46 13.6A11 11 0 1 1 20.16 7.29";
const CHECK = "M9.6 17.4l4 4L24.2 9.3";

interface MarkProps {
  size?: number;
  /** Draw-on animation: ring, then check, then the node lights up. Loops when `loop`. */
  animated?: boolean;
  loop?: boolean;
  className?: string;
  title?: string;
}

export function LogoMark({ size = 28, animated, loop, className = "", title }: MarkProps) {
  const cls = ["logo-mark", animated && "is-animated", loop && "is-looping", className]
    .filter(Boolean)
    .join(" ");
  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* pathLength=1 lets the CSS draw animation use dash values of 0..1 regardless of size */}
      <path
        className="logo-ring"
        d={RING}
        pathLength={1}
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <path
        className="logo-check"
        d={CHECK}
        pathLength={1}
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="logo-node-glow" cx="26" cy="6.9" r="5.5" />
      <circle className="logo-node" cx="26" cy="6.9" r="2.8" />
    </svg>
  );
}

/** Mark + wordmark. The wordmark is live text in the display serif (crisp at every size). */
export function Lockup({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`logo-lockup ${className}`} style={{ fontSize: size * 0.82 }}>
      <LogoMark size={size} />
      <span className="logo-word">Verity</span>
    </span>
  );
}

/** Full-screen-ish loading moment (route chunks loading, first data fetch). */
export function LogoLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="logo-loader" role="status" aria-live="polite">
      <LogoMark size={56} animated loop />
      <span className="logo-loader-label">{label}…</span>
    </div>
  );
}

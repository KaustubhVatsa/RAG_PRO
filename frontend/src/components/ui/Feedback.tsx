import type { ReactNode } from "react";

/** Shimmering placeholder lines while content loads. */
export function Skeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`skeleton ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton-line" style={{ width: `${i === lines - 1 ? 62 : 100 - i * 6}%` }} />
      ))}
    </div>
  );
}

/**
 * Answer confidence (0..1). Renders nothing when null: the backend only fills it in once the
 * verifier produces one, and an empty meter would suggest "0% confident".
 */
export function ConfidenceMeter({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const band = pct >= 75 ? "high" : pct >= 45 ? "mid" : "low";
  const words = { high: "High", mid: "Moderate", low: "Low" }[band];
  return (
    <div className={`confidence confidence-${band}`}>
      <span className="confidence-label">Confidence</span>
      <span
        className="confidence-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Confidence ${pct}%`}
      >
        {/* five segments: reads as a gauge, not a progress bar */}
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`confidence-seg ${pct > i * 20 ? "is-on" : ""}`} />
        ))}
      </span>
      <span className="confidence-value">
        {words} · {pct}%
      </span>
    </div>
  );
}

/** Centered empty state with an illustration slot. */
export function EmptyState({
  art,
  title,
  children,
  actions,
}: {
  art?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {art && <div className="empty-art">{art}</div>}
      <h3 className="empty-title">{title}</h3>
      {children && <div className="empty-body">{children}</div>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

/** Small uppercase-ish label + optional count, used as section headers inside panels. */
export function PanelLabel({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="panel-label">
      <span>{children}</span>
      {count !== undefined && <span className="panel-count">{count}</span>}
    </div>
  );
}

/** Keyboard key hint. */
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;

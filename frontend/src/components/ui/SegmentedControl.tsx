import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Short explanation, exposed as the option's description. */
  hint?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
}

/**
 * Radio-group semantics with a sliding "thumb". Arrow keys move the selection (WAI-ARIA radio
 * group pattern); only the checked option is in the tab order. The thumb position is driven by
 * a CSS variable (--i = selected index, --n = count), so the slide is a pure CSS transition with a
 * gentle spring easing.
 */
export function SegmentedControl<T extends string>({ label, value, options, onChange, size = "md" }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`segmented segmented-${size}`}
      style={{ ["--i" as string]: index, ["--n" as string]: options.length }}
      onKeyDown={onKeyDown}
    >
      <span className="segmented-thumb" aria-hidden="true" />
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          title={o.hint}
          className="segmented-option"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
}

/**
 * WAI-ARIA tabs (tablist + tab). Arrow keys switch tabs. The matching panel must use
 * `tabPanelProps(baseId, id)` so tabs and panels are linked for screen readers.
 */
export function Tabs<T extends string>({
  baseId,
  label,
  tabs,
  value,
  onChange,
}: {
  baseId: string;
  label: string;
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tabs.findIndex((t) => t.id === value));
  const onKeyDown = (e: KeyboardEvent) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="tabs" onKeyDown={onKeyDown}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          type="button"
          id={`${baseId}-tab-${t.id}`}
          aria-selected={t.id === value}
          aria-controls={`${baseId}-panel-${t.id}`}
          tabIndex={t.id === value ? 0 : -1}
          className="tab"
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const tabPanelProps = (baseId: string, id: string) => ({
  role: "tabpanel" as const,
  id: `${baseId}-panel-${id}`,
  "aria-labelledby": `${baseId}-tab-${id}`,
  tabIndex: 0,
});

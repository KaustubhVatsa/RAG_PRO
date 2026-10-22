import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "../icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus management shared by modal dialogs and drawers:
 *  - moves focus into the container on open (first focusable, or the container itself)
 *  - traps Tab / Shift+Tab inside it
 *  - Escape calls onClose
 *  - restores focus to whatever was focused before, on close
 */
function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  return ref;
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row. */
  actions?: ReactNode;
}

/** Centered modal dialog (used for confirmations). */
export function Dialog({ open, onClose, title, description, children, actions }: DialogProps) {
  const ref = useFocusTrap(open, onClose);
  const titleId = useId();
  const descId = useId();
  if (!open) return null;
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="dialog"
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        {description && (
          <div id={descId} className="dialog-desc">
            {description}
          </div>
        )}
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: "left" | "right" | "bottom";
  label: string;
  children: ReactNode;
}

/** Off-canvas panel for small screens (library on the left, evidence as a bottom sheet). */
export function Drawer({ open, onClose, side, label, children }: DrawerProps) {
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="scrim scrim-drawer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={`drawer drawer-${side}`}>
        <div className="drawer-head">
          {side === "bottom" && <span className="drawer-grip" aria-hidden="true" />}
          <span className="drawer-title">{label}</span>
          <button type="button" className="icon-btn btn-ghost icon-btn-sm" aria-label={`Close ${label}`} onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

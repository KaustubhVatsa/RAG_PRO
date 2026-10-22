import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Hover/focus popover (a rich tooltip). Usage:
 *
 *   const pop = useHoverPopover<HTMLSpanElement>();
 *   <span ref={pop.ref} {...pop.triggerProps}>…</span>
 *   {pop.render(<div>content</div>)}
 *
 * It renders into document.body through a portal (so it is never clipped by a scrolling panel),
 * positions itself above the trigger, flips below when there's no room, and clamps to the viewport.
 * Opens on hover (short delay) and on keyboard focus; closes on leave/blur, Escape, or scroll.
 * Content is descriptive only (role="tooltip"); actions live on the trigger itself.
 */
export function useHoverPopover<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const timer = useRef<number>();
  const id = useId();

  const show = useCallback((delay = 120) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  }, []);
  const hide = useCallback((delay = 80) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), delay);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Measure after the popover mounts, then place it.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = ref.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const a = anchor.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    const gap = 8;
    const margin = 10;
    const placement = a.top - p.height - gap < margin ? "bottom" : "top";
    const top = placement === "top" ? a.top - p.height - gap : a.bottom + gap;
    const left = Math.min(
      Math.max(margin, a.left + a.width / 2 - p.width / 2),
      window.innerWidth - p.width - margin,
    );
    setPos({ top, left, placement });
  }, [open]);

  // Escape and any scroll close it (repositioning on scroll isn't worth the complexity here).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const triggerProps = {
    onMouseEnter: () => show(),
    onMouseLeave: () => hide(),
    onFocus: () => show(0),
    onBlur: () => hide(0),
    "aria-describedby": open ? id : undefined,
  };

  const render = (content: ReactNode, className = "") =>
    open
      ? createPortal(
          <div
            ref={popRef}
            id={id}
            role="tooltip"
            className={`popover ${className} ${pos ? `is-placed is-${pos.placement}` : ""}`}
            style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
          >
            {content}
          </div>,
          document.body,
        )
      : null;

  return { ref, open, show, hide, triggerProps, render };
}

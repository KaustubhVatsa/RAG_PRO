import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** True when WebGL can actually create a context (checked once, then cached). */
let webglCache: boolean | null = null;
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement("canvas");
    webglCache = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/**
 * "Should this animated thing be running right now?": false when the element is scrolled out of
 * view or the browser tab is hidden. Used to pause the 3D render loop.
 */
export function useIsActive(ref: RefObject<Element>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === "visible");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return onScreen && tabVisible;
}

/**
 * "Magnetic" hover: the element drifts a few pixels toward the pointer. Writes CSS variables
 * (--mx/--my) instead of React state so it never re-renders. Disabled for reduced motion and
 * touch (coarse pointers).
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.22) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(e.clientX - (r.left + r.width / 2)) * strength}px`);
      el.style.setProperty("--my", `${(e.clientY - (r.top + r.height / 2)) * strength}px`);
    };
    const leave = () => {
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);
  return ref;
}

/**
 * CSS 3D tilt: sets --rx/--ry (degrees) and --px/--py (pointer position, %) on the element so
 * the stylesheet can rotate it and move a sheen. Same guards as useMagnetic.
 */
export function useTilt<T extends HTMLElement>(maxDeg = 6) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width; // 0..1
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(x - 0.5) * 2 * maxDeg}deg`);
      el.style.setProperty("--rx", `${(0.5 - y) * 2 * maxDeg}deg`);
      el.style.setProperty("--px", `${x * 100}%`);
      el.style.setProperty("--py", `${y * 100}%`);
    };
    const leave = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [maxDeg]);
  return ref;
}

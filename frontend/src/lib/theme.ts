import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Theme state lives on <html data-theme>. index.html sets it before first paint (saved choice or
 * OS preference). This hook reads it, lets the user flip it, and persists an explicit choice.
 * If the user never chose, we keep following the OS when it changes.
 */
export type Theme = "light" | "dark";
const KEY = "verity-theme";

function readSaved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null; // storage blocked (private mode, sandboxed iframe): just don't persist
  }
}

function save(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

const listeners = new Set<() => void>();
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current);

  // Follow OS changes only while the user hasn't made an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!readSaved()) apply(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    save(t);
    apply(t);
  }, []);

  const toggle = useCallback(() => setTheme(current() === "dark" ? "light" : "dark"), [setTheme]);

  return { theme, setTheme, toggle };
}

import { useSyncExternalStore } from "react";

/**
 * A tiny hash router. Four screens don't justify a routing library: the URL hash (#/workspace)
 * is the single source of truth, and components re-render when it changes.
 */
export type Route = "home" | "workspace" | "eval" | "lab";

const PATHS: Record<Route, string> = {
  home: "#/",
  workspace: "#/workspace",
  eval: "#/eval",
  lab: "#/lab",
};

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").split(/[?/]/)[0];
  if (path === "workspace" || path === "eval" || path === "lab") return path;
  return "home";
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parse(window.location.hash));
}

export function hrefFor(route: Route): string {
  return PATHS[route];
}

export function navigate(route: Route) {
  if (parse(window.location.hash) !== route) window.location.hash = PATHS[route];
}

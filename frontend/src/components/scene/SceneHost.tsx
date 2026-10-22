import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { hasWebGL, useIsActive, useReducedMotion } from "../../lib/media";
import { useTheme } from "../../lib/theme";
import { ErrorBoundary } from "../ErrorBoundary";
import { ConstellationFallback } from "./ConstellationFallback";
import { readSceneColors, type SceneColors, type SceneSignal } from "./layout";
import "./scene.css";

// three.js + react-three-fiber live in their own chunk, fetched only when a scene is shown.
const Constellation = lazy(() => import("./Constellation"));

/**
 * Decides HOW to show the constellation:
 *   WebGL available and motion allowed -> lazy 3D scene (SVG shown while it loads)
 *   otherwise (or if the 3D scene throws) -> static SVG fallback
 * and pauses the 3D render loop when off-screen or the tab is hidden.
 *
 * `force` lets the Design Lab show a specific renderer.
 */
export function SceneHost({
  signal,
  variant,
  className = "",
  force,
}: {
  signal: SceneSignal;
  variant: "hero" | "panel";
  className?: string;
  force?: "3d" | "fallback";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const active = useIsActive(ref);
  const { theme } = useTheme();
  const [colors, setColors] = useState<SceneColors | null>(null);

  // Re-read token colours whenever the theme flips.
  useLayoutEffect(() => {
    if (ref.current) setColors(readSceneColors(ref.current));
  }, [theme]);

  const use3D = force ? force === "3d" && hasWebGL() : hasWebGL() && !reduced;
  const fallback = <ConstellationFallback signal={signal} />;

  return (
    <div ref={ref} className={`scene scene-${variant} ${className}`} aria-hidden="true">
      {use3D && colors ? (
        <ErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <Constellation signal={signal} colors={colors} active={active} variant={variant} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}

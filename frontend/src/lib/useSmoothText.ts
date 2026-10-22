import { useEffect, useRef, useState } from "react";

/**
 * Reveal `target` progressively at a readable pace instead of in network-sized bursts.
 *
 * Real models stream unevenly and the offline mock sends everything at once; both read poorly.
 * Each animation frame we reveal a few characters, more when we're far behind, so the text never
 * lags much. With `enabled = false` (reduced motion, or history replay) the full text shows at once.
 */
export function useSmoothText(target: string, enabled: boolean): { text: string; caughtUp: boolean } {
  const [shown, setShown] = useState(enabled ? 0 : target.length);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (!enabled) {
      shownRef.current = target.length;
      setShown(target.length);
      return;
    }
    if (shownRef.current > target.length) {
      shownRef.current = target.length; // text got shorter (e.g. Evidence block hidden)
      setShown(target.length);
    }
    let raf = 0;
    const tick = () => {
      const remaining = target.length - shownRef.current;
      if (remaining <= 0) return;
      // 1..10 chars per frame (~60-600 chars/s): fast enough to never feel laggy, slow enough
      // that a burst still reads as "being written".
      const step = Math.min(10, Math.max(1, Math.ceil(remaining / 14)));
      shownRef.current = Math.min(target.length, shownRef.current + step);
      setShown(shownRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);

  const n = Math.min(shown, target.length);
  return { text: target.slice(0, n), caughtUp: n >= target.length };
}

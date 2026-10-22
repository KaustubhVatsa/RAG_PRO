import { useMemo } from "react";
import { layoutNodes, type SceneSignal } from "./layout";

/**
 * Static SVG version of the constellation for when WebGL is unavailable or the user prefers
 * reduced motion. Same layout as the 3D scene, projected flat with a fixed viewing angle; lit
 * stars and citation threads are still shown, so it carries the same information.
 */
export function ConstellationFallback({ signal }: { signal: SceneSignal }) {
  const { nodeCount: n } = signal;
  const layout = useMemo(() => layoutNodes(n), [n]);

  // Fixed rotation (about Y then X) so the flat projection has some depth.
  const pts = useMemo(() => {
    const ay = 0.6;
    const ax = -0.25;
    return Array.from({ length: n }, (_, i) => {
      const x0 = layout.positions[i * 3];
      const y0 = layout.positions[i * 3 + 1];
      const z0 = layout.positions[i * 3 + 2];
      const x1 = x0 * Math.cos(ay) + z0 * Math.sin(ay);
      const z1 = -x0 * Math.sin(ay) + z0 * Math.cos(ay);
      const y1 = y0 * Math.cos(ax) - z1 * Math.sin(ax);
      const z2 = y0 * Math.sin(ax) + z1 * Math.cos(ax);
      return { x: x1, y: -y1, depth: (z2 + 2.2) / 4.4 }; // depth 0 (far) .. 1 (near)
    });
  }, [layout, n]);

  // In ambient (hero) mode, show a fixed "answered" moment.
  const lit = signal.ambient
    ? [3, 17, 29, 41, 56].filter((i) => i < n).map((index, k) => ({ index, strength: 1 - k * 0.15 }))
    : signal.lit;
  const threads = signal.ambient
    ? lit.slice(0, 3).map((l, k) => ({ index: l.index, state: k === 2 ? ("flagged" as const) : ("verified" as const) }))
    : signal.threads;
  const litMap = new Map(lit.map((l) => [l.index, l.strength]));
  const threadSet = new Map(threads.map((t) => [t.index, t.state]));

  return (
    <svg className="constellation-svg" viewBox="-2.7 -2.2 5.4 4.4" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="cs-edges">
        {layout.edges.map(([a, b], i) => (
          <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} />
        ))}
      </g>
      <g className="cs-threads">
        {threads.map((t, i) => (
          <line key={i} className={`cs-thread th-${t.state}`} x1={0} y1={0} x2={pts[t.index]?.x ?? 0} y2={pts[t.index]?.y ?? 0} />
        ))}
      </g>
      <g>
        {pts.map((p, i) => {
          const s = litMap.get(i);
          const th = threadSet.get(i);
          const cls = th ? `cs-node is-thread th-${th}` : s !== undefined ? "cs-node is-lit" : "cs-node";
          const r = 0.022 + p.depth * 0.03 + (s ?? 0) * 0.03 + (th ? 0.02 : 0);
          return (
            <g key={i} className={cls} style={{ ["--d" as string]: `${(i % 9) * 0.4}s` }}>
              {(s !== undefined || th) && <circle className="cs-halo" cx={p.x} cy={p.y} r={r * 3.2} />}
              <circle cx={p.x} cy={p.y} r={r} opacity={0.35 + p.depth * 0.65} />
            </g>
          );
        })}
      </g>
      <circle className="cs-core-halo" cx={0} cy={0} r={0.28} />
      <circle className="cs-core" cx={0} cy={0} r={0.07} />
    </svg>
  );
}

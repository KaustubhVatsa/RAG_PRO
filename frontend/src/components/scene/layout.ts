/**
 * Deterministic layout for the "knowledge constellation". Shared by the WebGL scene and the SVG
 * fallback so both draw the same constellation.
 *
 * Nodes = passages of the selected documents (padded with ambient "stars" so a short paper still
 * looks alive). They sit on a slightly flattened, jittered Fibonacci sphere; each node links to its
 * two nearest neighbours, which reads as a web of related passages.
 */

export type ThreadState = "verified" | "flagged" | "none";

/** What the app tells the scene. Plain data, so it is easy to drive from the Design Lab too. */
export interface SceneSignal {
  nodeCount: number;
  phase: "idle" | "retrieving" | "answering" | "done";
  /** Retrieved passages: node index + relevance 0..1. */
  lit: { index: number; strength: number }[];
  /** Citations: a thread from the centre ("the answer") to the cited node. */
  threads: { index: number; state: ThreadState }[];
  /** Hero mode: invent a gentle question → retrieval → citation cycle on its own. */
  ambient?: boolean;
}

export interface Layout {
  positions: Float32Array; // xyz per node
  sizes: Float32Array; // base point size per node
  edges: [number, number][];
}

/** Small seeded PRNG (mulberry32): same seed, same constellation on every load. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<number, Layout>();

export function layoutNodes(count: number, radius = 2.1): Layout {
  const key = count * 1000 + Math.round(radius * 100);
  const hit = cache.get(key);
  if (hit) return hit;

  const rand = rng(7 + count);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2; // 1..-1
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const depth = radius * (0.62 + rand() * 0.5); // jitter in and out of the shell
    positions[i * 3] = Math.cos(theta) * r * depth;
    positions[i * 3 + 1] = y * depth * 0.78; // flattened: reads as a galaxy, not a ball
    positions[i * 3 + 2] = Math.sin(theta) * r * depth;
    sizes[i] = 0.7 + rand() * 0.8;
  }

  // Two nearest neighbours per node (O(n²) is fine for ~150 nodes, computed once and cached).
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const d: { j: number; dist: number }[] = [];
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const dx = positions[i * 3] - positions[j * 3];
      const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
      d.push({ j, dist: dx * dx + dy * dy + dz * dz });
    }
    d.sort((a, b) => a.dist - b.dist);
    for (const { j } of d.slice(0, 2)) {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(k)) {
        seen.add(k);
        edges.push([i, j]);
      }
    }
  }

  const layout = { positions, sizes, edges };
  cache.set(key, layout);
  return layout;
}

/** Map a chunk id to a node index (stable hash), so the same passage always lights the same star. */
export function nodeForChunk(chunkId: string, count: number): number {
  let h = 2166136261;
  for (let i = 0; i < chunkId.length; i++) {
    h ^= chunkId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % count;
}

/** Theme colours the scene needs, read from CSS custom properties. */
export interface SceneColors {
  dark: boolean;
  node: string;
  edge: string;
  accent: string;
  verified: string;
  flagged: string;
  neutral: string;
  sea: string;
}

export function readSceneColors(el: Element): SceneColors {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const dark = (el.closest("[data-theme]")?.getAttribute("data-theme") ?? "light") === "dark";
  return {
    dark,
    node: v("--text-muted", dark ? "#a9b0ab" : "#4b5557"),
    edge: v("--text-faint", "#858e8a"),
    accent: v("--accent", "#e9b65c"),
    verified: v("--supported", "#52cca4"),
    flagged: v("--contradicted", "#f2875a"),
    neutral: v("--unverified", "#9aa5aa"),
    sea: v("--sea", "#2f7f7a"),
  };
}

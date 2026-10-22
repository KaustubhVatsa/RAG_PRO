import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { layoutNodes, rng, type SceneColors, type SceneSignal, type ThreadState } from "./layout";

/**
 * The signature 3D scene: a "knowledge constellation".
 *
 *  - every star is a passage of the selected paper(s); faint lines join neighbouring passages
 *  - the bright core in the middle is "your question / the answer"
 *  - when Verity retrieves, the matching passages light up and pulse (brightness = relevance)
 *  - when an answer cites a passage, a thread is drawn from the core to that star, coloured by
 *    whether the quote was verified (green), flagged (vermillion) or not quoted (neutral)
 *  - the whole field slowly turns and tilts toward the pointer; stars near the pointer brighten
 *
 * Performance: ONE draw call for all stars (a custom point shader), one for the edges, one for
 * the threads. DPR is capped, and the render loop stops entirely when the host passes
 * `active = false` (tab hidden or scrolled off-screen). This file is lazy-loaded.
 */

const MAX_THREADS = 12;

interface Props {
  signal: SceneSignal;
  colors: SceneColors;
  active: boolean;
  variant: "hero" | "panel";
}

export default function Constellation({ signal, colors, active, variant }: Props) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, variant === "hero" ? 6.4 : 5.6], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Field signal={signal} colors={colors} variant={variant} />
    </Canvas>
  );
}

// ---------------------------------------------------------------- shaders
// Soft round sprites: a bright core plus a halo whose strength follows aGlow (0..1).
const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aGlow;
  uniform float uPixelRatio;
  uniform float uScale;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = aSize * (1.0 + aGlow * 1.8);
    gl_PointSize = s * uScale * uPixelRatio * (6.0 / -mv.z);
    vColor = aColor;
    vGlow = aGlow;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.17, 0.02, d);
    float halo = smoothstep(0.5, 0.0, d);
    halo = halo * halo * (0.18 + vGlow * 0.9);
    float a = clamp(core * (0.55 + vGlow * 0.45) + halo, 0.0, 1.0) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.9 + vGlow * 0.5), a);
  }
`;

// ---------------------------------------------------------------- the field
function Field({ signal, colors, variant }: { signal: SceneSignal; colors: SceneColors; variant: "hero" | "panel" }) {
  const n = signal.nodeCount;
  const layout = useMemo(() => layoutNodes(n), [n]);
  const { camera, gl } = useThree();
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points>(null);

  // Colours as THREE.Color (re-created when the theme changes).
  const palette = useMemo(
    () => ({
      node: new THREE.Color(colors.node),
      accent: new THREE.Color(colors.accent),
      verified: new THREE.Color(colors.verified),
      flagged: new THREE.Color(colors.flagged),
      neutral: new THREE.Color(colors.neutral),
    }),
    [colors],
  );

  // Star geometry: n passages + 1 core at the origin (index n).
  const nodeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((n + 1) * 3);
    pos.set(layout.positions);
    const size = new Float32Array(n + 1);
    size.set(layout.sizes);
    size[n] = 2.6;
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array((n + 1) * 3), 3));
    g.setAttribute("aGlow", new THREE.BufferAttribute(new Float32Array(n + 1), 1));
    return g;
  }, [layout, n]);

  const nodeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uPixelRatio: { value: 1 },
          uScale: { value: 1 },
          uOpacity: { value: 1 },
        },
      }),
    [],
  );

  // Additive glow looks magical on dark backgrounds but washes out on paper: switch per theme.
  useEffect(() => {
    nodeMat.blending = colors.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    nodeMat.uniforms.uScale.value = (variant === "hero" ? 7.5 : 6.5) * (colors.dark ? 1 : 1.08);
    nodeMat.needsUpdate = true;
  }, [colors.dark, nodeMat, variant]);

  useEffect(() => {
    nodeMat.uniforms.uPixelRatio.value = gl.getPixelRatio();
  }, [gl, nodeMat]);

  // Edges between neighbouring passages.
  const edgeGeo = useMemo(() => {
    const arr = new Float32Array(layout.edges.length * 6);
    layout.edges.forEach(([a, b], i) => {
      arr.set(layout.positions.subarray(a * 3, a * 3 + 3), i * 6);
      arr.set(layout.positions.subarray(b * 3, b * 3 + 3), i * 6 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, [layout]);
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }), []);
  useEffect(() => {
    edgeMat.color.set(colors.edge);
    edgeMat.opacity = colors.dark ? 0.16 : 0.2;
  }, [colors, edgeMat]);

  // Threads (core -> cited star). Vertex positions are rewritten each frame as they "grow".
  const threadGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_THREADS * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX_THREADS * 6), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const threadMat = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }),
    [],
  );
  useEffect(() => {
    threadMat.blending = colors.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    threadMat.needsUpdate = true;
  }, [colors.dark, threadMat]);

  // Free GPU memory when these objects are replaced or the scene unmounts.
  useEffect(() => () => nodeGeo.dispose(), [nodeGeo]);
  useEffect(() => () => edgeGeo.dispose(), [edgeGeo]);
  useEffect(
    () => () => {
      threadGeo.dispose();
      threadMat.dispose();
      edgeMat.dispose();
      nodeMat.dispose();
    },
    [threadGeo, threadMat, edgeMat, nodeMat],
  );

  // Pointer, tracked on the window so the field tilts even when the cursor is beside it.
  const pointer = useRef({ x: 0, y: 0, inside: false });
  useEffect(() => {
    const canvas = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.current.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      pointer.current.inside = Math.abs(pointer.current.x) <= 1 && Math.abs(pointer.current.y) <= 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [gl]);

  // Thread growth progress, reset whenever the set of threads changes (checked per frame because
  // ambient mode changes threads without re-rendering).
  const progress = useRef(new Float32Array(MAX_THREADS));
  const lastThreadKey = useRef("");

  const glow = useRef(new Float32Array(n + 1));
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const mixed = useMemo(() => new THREE.Color(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    if (!tilt.current || !spin.current || !points.current) return;

    // Motion: slow spin + pointer tilt (eased).
    spin.current.rotation.y += dt * (variant === "hero" ? 0.05 : 0.04);
    const p = pointer.current;
    tilt.current.rotation.x += (-p.y * 0.22 - tilt.current.rotation.x) * Math.min(1, dt * 2.5);
    tilt.current.rotation.y += (p.x * 0.3 - tilt.current.rotation.y) * Math.min(1, dt * 2.5);

    // What should be lit right now: the app's signal, or an invented cycle in ambient mode.
    const { lit, threads, phase } = signal.ambient ? ambientCycle(t, n) : signal;
    const litMap = new Map(lit.map((l) => [l.index, l.strength]));
    const threadMap = new Map(threads.map((th) => [th.index, th.state]));
    const pulsing = phase === "retrieving" || phase === "answering";

    const colorAttr = nodeGeo.getAttribute("aColor") as THREE.BufferAttribute;
    const glowAttr = nodeGeo.getAttribute("aGlow") as THREE.BufferAttribute;
    const aspect = state.size.width / Math.max(1, state.size.height);
    const g = glow.current;
    const k = Math.min(1, dt * 4);
    points.current.updateMatrixWorld();

    for (let i = 0; i < n; i++) {
      let target = 0;
      const s = litMap.get(i);
      if (s !== undefined) target = (0.35 + 0.65 * s) * (pulsing ? 0.75 + 0.25 * Math.sin(t * 5 + i) : 1);
      const th = threadMap.get(i);
      if (th !== undefined) target = 1;

      // Hover: brighten stars near the pointer (compare in screen space).
      if (p.inside) {
        tmp.fromArray(layout.positions, i * 3).applyMatrix4(points.current.matrixWorld).project(camera);
        const dx = (tmp.x - p.x) * aspect;
        const dy = tmp.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.18) target = Math.max(target, 0.7 * (1 - d / 0.18));
      }
      g[i] += (target - g[i]) * k;
      glowAttr.setX(i, g[i]);

      const hot = th !== undefined ? threadColor(th, palette) : palette.accent;
      mixed.copy(palette.node).lerp(hot, Math.min(1, g[i] * 1.3));
      colorAttr.setXYZ(i, mixed.r, mixed.g, mixed.b);
    }

    // The core: breathes while working, steady when done.
    const coreTarget = pulsing ? 0.65 + 0.35 * Math.sin(t * 4) : phase === "done" ? 0.75 : 0.35;
    g[n] += (coreTarget - g[n]) * k;
    glowAttr.setX(n, g[n]);
    colorAttr.setXYZ(n, palette.accent.r, palette.accent.g, palette.accent.b);
    glowAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Threads grow from the core outward, staggered.
    const key = threads.map((th) => `${th.index}:${th.state}`).join(",");
    if (key !== lastThreadKey.current) {
      lastThreadKey.current = key;
      progress.current.fill(0);
    }
    const tPos = threadGeo.getAttribute("position") as THREE.BufferAttribute;
    const tCol = threadGeo.getAttribute("color") as THREE.BufferAttribute;
    const count = Math.min(threads.length, MAX_THREADS);
    for (let i = 0; i < count; i++) {
      const prog = (progress.current[i] = Math.min(1, progress.current[i] + dt * 1.2));
      const eased = 1 - Math.pow(1 - Math.max(0, prog * 1.4 - i * 0.12), 3);
      const e = Math.min(1, Math.max(0, eased));
      const idx = threads[i].index;
      tPos.setXYZ(i * 2, 0, 0, 0);
      tPos.setXYZ(
        i * 2 + 1,
        layout.positions[idx * 3] * e,
        layout.positions[idx * 3 + 1] * e,
        layout.positions[idx * 3 + 2] * e,
      );
      const c = threadColor(threads[i].state, palette);
      tCol.setXYZ(i * 2, palette.accent.r, palette.accent.g, palette.accent.b);
      tCol.setXYZ(i * 2 + 1, c.r, c.g, c.b);
    }
    threadGeo.setDrawRange(0, count * 2);
    tPos.needsUpdate = true;
    tCol.needsUpdate = true;
  });

  return (
    <group ref={tilt}>
      <group ref={spin}>
        <lineSegments geometry={edgeGeo} material={edgeMat} />
        <lineSegments geometry={threadGeo} material={threadMat} />
        <points ref={points} geometry={nodeGeo} material={nodeMat} />
      </group>
    </group>
  );
}

function threadColor(s: ThreadState, p: { verified: THREE.Color; flagged: THREE.Color; neutral: THREE.Color }) {
  return s === "verified" ? p.verified : s === "flagged" ? p.flagged : p.neutral;
}

/**
 * Hero mode: a 6-second loop that mimics a real question.
 *   0.0-1.4s  retrieval: a handful of stars pulse
 *   1.4-4.8s  citation: threads grow to two or three of them
 *   4.8-6.0s  rest
 * Each cycle picks different stars (seeded by the cycle number).
 */
function ambientCycle(t: number, n: number): Pick<SceneSignal, "lit" | "threads" | "phase"> {
  const period = 6;
  const cycle = Math.floor(t / period);
  const local = t - cycle * period;
  const rand = rng(cycle * 7919 + 13);
  const lit = Array.from({ length: 6 }, () => ({ index: Math.floor(rand() * n), strength: 0.4 + rand() * 0.6 }));
  if (local > 4.8) return { lit: [], threads: [], phase: "idle" };
  if (local < 1.4) return { lit, threads: [], phase: "retrieving" };
  const states: ThreadState[] = ["verified", "verified", rand() > 0.6 ? "flagged" : "verified"];
  return {
    lit,
    threads: lit.slice(0, 3).map((l, i) => ({ index: l.index, state: states[i] })),
    phase: "done",
  };
}

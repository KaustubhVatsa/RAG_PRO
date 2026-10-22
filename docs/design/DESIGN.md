# Verity design

Verity answers questions about a paper and shows its work: every claim cites a page and an exact
quote, each claim is checked, and when the paper doesn't say, Verity says so. The interface should
make that checkable, and it should feel calm, precise and a little magical. The look we are after is
a scholar's reading lamp over good paper: warm light on ink.

![Home, dark](screens/home-dark.png)

## 1. References: what we took, and what we left

These were inspiration only. No assets, marks or code were copied.

| Reference | What we borrowed (conceptually) |
|---|---|
| [Linear: behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh) | Recede the chrome and keep content prominent. Linear moved from cool, blue-ish grays to warmer, less saturated neutrals, and it uses soft separators instead of heavy borders. We use warm "ink" and "paper" neutrals, dim side panels, and 1px translucent borders. |
| [Vercel Geist](https://vercel.com/geist) | Disciplined tokens (colour, radius, materials), tight display tracking, and a mono face for data. Our type scale and mono usage for page numbers, scores and kbd hints follow this. |
| [Perplexity design breakdown](https://www.925studios.co/blog/perplexity-design-breakdown) | The citation sits *at the claim*, not in a footnote list. Our `[n]` chips sit inline, a "Sources" row sits under each answer, and a panel holds the full passages. |
| Raycast ([design notes](https://www.shadcn.io/design/raycast)) | Depth from layered surfaces and inset highlights rather than heavy shadows: the "raised glass" feel of our cards, composer and floating annotations. |
| [Codrops: three.js instancing](https://tympanus.net/codrops/2025/07/10/three-js-instances-rendering-multiple-objects-simultaneously/) and the [R3F "breathing dots" recreation](https://tympanus.net/codrops/author/the_ross_man) | Draw many particles in one draw call and use motion that "breathes". Our constellation is a single custom point shader plus two line meshes. |
| Awwwards / godly-style WebGL heroes | A 3D hero should *mean* something. Ours is a literal picture of retrieval (stars = passages, threads = citations), not decoration. |

What we deliberately avoided: the purple-on-black "AI" palette, default SaaS blue, glassmorphism
everywhere, and confetti-style delight. Trust UIs should not perform.

## 2. Principles

1. **Evidence is the hero.** Quotes, pages and verdicts get the strongest typography (the display
   serif). The chrome stays quiet.
2. **Never colour alone.** Every verification state has a colour, an icon and an underline pattern.
3. **Abstaining is not an error.** "Not in this document" gets a calm, warm card with next steps,
   never the red error style.
4. **Show the work progressively.** Retrieve, then write, then check: the UI reflects each stage
   (pipeline chips, the streaming caret, chips that resolve, claim underlines that sweep in).
5. **Motion explains, then gets out of the way.** Short durations, ease-out curves, and a spring
   only on toggles and indicators. Everything collapses under `prefers-reduced-motion`.
6. **Readable over clever.** Small components, plain CSS and tokens. Every non-obvious bit has a comment.

## 3. Palette

All colours are CSS custom properties in `frontend/src/styles/tokens.css`, declared on
`[data-theme="light"|"dark"]` so any subtree can switch theme (the Design Lab shows both side by side).

| Token | Light (paper & ink) | Dark (ink & lamplight) | Use |
|---|---|---|---|
| `--bg` | `#f5f2eb` | `#0b0f11` | page |
| `--surface` | `#fffdf8` | `#141b1f` | cards, inputs |
| `--text` | `#1a1f21` | `#ece7dc` | body |
| `--text-muted` | `#4b5557` | `#a9b0ab` | secondary |
| `--accent` | `#e3a83f` | `#e9b65c` | lamplight amber: CTAs, focus, the logo node |
| `--accent-text` | `#875809` | `#efc57a` | amber *text* (AA on bg) |
| `--sea` | `#2c706b` | `#2f7f7a` | deep teal, only for depth (aurora, score bars, 3D) |

**Verification semantics** (derived from the Okabe–Ito colour-blind-safe set, then tuned for AA
contrast against each theme's background):

| State | Light | Dark | Icon | Underline |
|---|---|---|---|---|
| supported | `#00775a` | `#52cca4` | check in a ring | solid |
| unsupported | `#9e3f7a` | `#dc93c4` | ? in a dashed ring | dashed |
| contradicted | `#b4400c` | `#f2875a` | slashed ring | wavy |
| unverified | `#59656a` | `#9aa5aa` | dotted ring | dotted |

Citation `verified` states: `true` = green chip with ✓, `false` = vermillion chip with ✗ and a
diagonal hatch ("flagged"), `null` = neutral chip with no glyph. While streaming, chips are dashed
"pending" markers.

Contrast (computed, WCAG 2.x): body text is 14–16:1 on every surface in both themes. Muted text is
at least 6.4:1, faint text at least 4.7:1, and semantic colours at least 4.6:1 on `--bg`, `--surface`
and `--surface-2`. Dark text on the amber accent is 8.6:1 or better.

## 4. Type

Self-hosted variable fonts via `@fontsource-variable/*` (no runtime CDN requests):

- **Fraunces** (display serif, optical sizes): headings, quotes, the wordmark, stat numbers. Gives
  the "scholarly but warm" voice. The italic carries the hero line and every quoted passage.
- **Inter** (UI sans): interface and answer body, 15px / 1.6, with the measure capped near 68ch.
- **JetBrains Mono**: page numbers, scores, citation numbers, keyboard hints.

Scale: 11 / 12 / 13 / 15 / 17 / 20 / 26 / 36, plus a fluid display size of `clamp(2.6rem, 6.2vw, 5.1rem)`.

## 5. Motion

| Token | Value | Used for |
|---|---|---|
| `--dur-fast` | 140ms | hover colour changes |
| `--dur-base` | 220ms | popovers, tabs |
| `--dur-slow` | 420ms | drawers, segmented thumb, toggles |
| `--dur-slower` | 800ms | claim reveal sweep, score bars, quote marker |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | default |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | toggle knob, segmented thumb, chip lift, logo node pop |

Rules: animate only `transform` and `opacity` (plus `background-size` for the claim sweep). No
loops on content, except the subtle "working" signals (pipeline chip breathing, the composer border
light, the caret), which stop once work ends. Under `prefers-reduced-motion` all durations collapse
to 0, the 3D scene is replaced by the static SVG, magnetic and tilt effects are disabled, and text
appears without the typewriter reveal.

Micro-interactions: a magnetic primary CTA; CSS 3D tilt with a pointer-following sheen on the "how
it works" cards and the hero dropzone; a spring toggle; a sliding segmented thumb; an aurora
backdrop and film grain; skeleton shimmer; a streaming caret; a staggered claim underline reveal; a
marker-pen sweep on highlighted quotes; and a light that travels round the composer border while an
answer is running.

## 6. Logo

![Logo](screens/logo.png)

**Concept: lens + check + evidence node.** An open ring (a lens: "look closely") holds a check mark
("verified"). The check's long stroke leaves the lens through a gap and lands on a single amber
node: the evidence point the answer is anchored to. So it reads as "the claim is checked, and here
is where it comes from".

- Geometry on a 32-unit grid: ring r=11 centred at (15,17) with a gap at −62°…−18°; check
  (9.6,17.4) → (13.6,21.4) → (24.2,9.3); node r≈2.8 at (26,6.9). Strokes are 2.6 units with round
  caps (3 in the favicon, for 16px legibility).
- Ring and check use `currentColor`; the node uses `--accent`, so the mark works on both themes and
  inherits text colour anywhere.
- Wordmark: "Verity" in Fraunces 600, −0.02em tracking, set as live text so it stays crisp.
- Files: `frontend/src/components/brand/Logo.tsx` (`LogoMark`, `Lockup`, `LogoLoader`),
  `frontend/public/favicon.svg` (switches colours with `prefers-color-scheme`).
- Animated variant: the ring draws on, then the check, then the node pops with a glow. It loops in
  the loading moment (`LogoLoader`, the route `Suspense` fallback) and in the assistant avatar while
  retrieving.

## 7. The 3D scene: knowledge constellation

`frontend/src/components/scene/`

- **Meaning:** each star is a passage of the selected paper(s). Faint lines join neighbouring
  passages. The bright core is the question/answer. On `retrieval`, the retrieved passages light
  up (brightness = relative score) and pulse while Verity works. On `done`, a thread grows from the
  core to each cited passage, coloured by quote state (green verified, vermillion flagged, neutral
  if there's no quote). Stars near the pointer brighten, and the whole field tilts toward the pointer
  and slowly turns.
- **Where:** the home hero (ambient mode loops a 6s "question → retrieval → citations" story) and
  the top of the Evidence panel (live, driven by the latest answer), with a one-line caption.
- **Performance:** one `THREE.Points` with a custom shader (soft sprite + glow attribute) for all
  stars, plus one `LineSegments` for edges and one for threads. DPR is capped at 1.75. The render
  loop switches to `frameloop="demand"` when the canvas is off-screen (IntersectionObserver) or the
  tab is hidden. Geometry and materials are disposed on unmount. Additive blending in dark, normal
  blending in light.
- **Loading:** `React.lazy` + dynamic import, so three.js and R3F live in a separate chunk that is
  fetched only when a scene mounts. The SVG fallback renders while it loads.
- **Fallback:** `ConstellationFallback.tsx` draws the same deterministic layout as a static SVG
  (same lit stars and threads). It is used when WebGL is unavailable, when the user prefers reduced
  motion, or if the 3D scene throws (error boundary).
- **Theming:** colours are read from CSS tokens on the host element, so the scene follows the
  active theme, including inside the Lab's forced-theme columns.

## 8. Screens

- **Home** (`#/`): hero with the constellation and floating annotations, a "Try the demo paper"
  CTA (selects `demo-attention`), the drag-and-drop dropzone with progress, "how an answer earns
  your trust", and the claim-state legend.
- **Workspace** (`#/workspace`): library | chat | evidence. At 1180px and wider, all three columns
  show, and the evidence panel can be collapsed. From 860px to 1180px, evidence opens as a right
  drawer. Below 860px, the library is a left drawer and evidence is a bottom sheet. Drawers and
  dialogs trap focus and close on Esc.
- **Eval** (`#/eval`): stat tiles, a recall@k bar chart, an MRR gauge and abstention bars, all
  hand-rolled SVG with a hidden table for screen readers. The empty state shows the `make` command
  with a copy button.
- **Design Lab** (`#/lab`): every component in every state, light and dark side by side, using
  fixture data and no backend. It is linked in the nav only in dev builds, but stays reachable by URL.

## 9. Implementation notes

- **Streaming:** raw tokens include the model's trailing `Evidence:` block. `visibleStreamText()`
  hides it (including a half-arrived "Evid…" line), and on `done` the final `answer.text` replaces
  it. `useSmoothText` reveals text at a readable pace, because the mock backend sends everything at once.
- **Claims:** `segmentByClaims()` finds each claim sentence inside each markdown block (stripping
  list markers) and wraps it in a `ClaimSpan`. A claim that can't be located is still listed in the
  claim summary under the answer.
- **Markdown:** a ~150-line renderer in `lib/markdown.tsx` builds React elements and never uses
  `dangerouslySetInnerHTML`. Underscore italics need word boundaries, so `d_model` stays intact.
- **Source panel:** it fetches `/file` once per document (cached). On 404 it falls back to
  `/chunks?page=N` with the quote highlighted (`lib/findQuote.ts`, which forgives whitespace, case
  and quotes, like the backend's `normalize`). With a PDF, pdf.js renders the page plus its text
  layer, and the spans overlapping the quote get a marker highlight.
- **Theme:** an inline script in `index.html` sets `data-theme` before first paint (saved choice →
  OS preference). The toggle persists to localStorage inside try/catch. Without an explicit choice,
  the app follows OS changes live.

## 10. Dependencies (and why)

| Package | Why | Where it loads |
|---|---|---|
| `three` | WebGL scene | lazy chunk |
| `@react-three/fiber` | declarative scene + render loop control (`frameloop`) that fits React state | lazy chunk |
| `pdfjs-dist` | PDF rendering + text layer for quote highlighting; smaller and more controllable than `react-pdf` | lazy chunk + worker |
| `@fontsource-variable/{fraunces,inter,jetbrains-mono}` | self-hosted fonts, no CDN | CSS (per-subset woff2, only fetched when used) |
| `@types/three` (dev) | types | none |

Not added: `@react-three/drei` (we needed no helpers), `motion` (CSS covers every interaction),
a router (four routes, hash-based, ~30 lines), a chart library (four small SVG charts), and a
markdown library (the small safe renderer is easier to audit).

Bundle (production build, gzipped): the initial JS is about 70 KB, plus CSS at about 16 KB. Lazy
chunks: the 3D scene is about 240 KB, the PDF viewer about 108 KB (plus its worker, fetched only for
documents with a stored PDF), the eval dashboard about 3 KB and the Lab about 6 KB.

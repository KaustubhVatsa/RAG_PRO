#!/usr/bin/env python3
"""Generates the Excalidraw diagrams (+ SVG previews) in this folder.

    python docs/diagrams/build_diagrams.py

Open the .excalidraw files at https://excalidraw.com (File > Open) to edit them by hand.
Boxes are grouped with their text and arrows are bound to boxes, so dragging a box
drags its label and its arrows. Re-running this script overwrites hand edits, so
pick one workflow per diagram: edit the script, or edit in Excalidraw.
"""

from __future__ import annotations

import json
import random
import textwrap
from html import escape
from pathlib import Path

OUT = Path(__file__).parent
rng = random.Random(7)

# (background, stroke)
STYLES = {
    "you": ("#a5d8ff", "#1971c2"),  # frontend / API / reasoning
    "partner": ("#b2f2bb", "#2f9e44"),  # knowledge layer
    "shared": ("#e9ecef", "#495057"),  # contracts, glue, neutral
    "data": ("#ffd8a8", "#e8590c"),  # datastore
    "ext": ("#d0bfff", "#6741d9"),  # external providers / models
    "none": ("transparent", "#868e96"),
}
SEAM = "#e8590c"
MUTED = "#495057"
CHAR_W = 0.56  # average glyph width / font size, used to estimate text boxes
LINE_H = 1.25


def text_size(text: str, size: int) -> tuple[float, float]:
    lines = text.split("\n")
    return max(len(l) for l in lines) * size * CHAR_W + 8, len(lines) * size * LINE_H


def wrap(text: str, avail: float, size: int) -> str:
    cols = max(8, int(avail / (size * CHAR_W)))
    out: list[str] = []
    for para in text.split("\n"):
        out += textwrap.wrap(para, cols) or [""]
    return "\n".join(out)


class Diagram:
    def __init__(self, name: str):
        self.name = name
        self.els: list[dict] = []
        self.by_id: dict[str, dict] = {}
        self.warnings: list[str] = []
        self._n = 0

    # ------------------------------------------------------------ primitives
    def _id(self, prefix: str) -> str:
        self._n += 1
        return f"{prefix}{self._n}"

    def _base(self, typ: str, x, y, w, h, stroke, bg="transparent", **kw) -> dict:
        el = {
            "id": kw.pop("id", None) or self._id(typ[:3]),
            "type": typ,
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "angle": 0,
            "strokeColor": stroke,
            "backgroundColor": bg,
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 1,
            "opacity": 100,
            "groupIds": [],
            "frameId": None,
            "roundness": None,
            "seed": rng.randint(1, 2**31 - 1),
            "version": 1,
            "versionNonce": rng.randint(1, 2**31 - 1),
            "isDeleted": False,
            "boundElements": [],
            "updated": 1700000000000,
            "link": None,
            "locked": False,
        }
        el.update(kw)
        self.els.append(el)
        self.by_id[el["id"]] = el
        return el

    def text(self, x, y, s, size=18, color="#1e1e1e", align="left", group=None, w=None):
        tw, th = text_size(s, size)
        w = w or tw
        el = self._base(
            "text",
            x,
            y,
            w,
            th,
            color,
            text=s,
            fontSize=size,
            fontFamily=1,
            textAlign=align,
            verticalAlign="top",
            containerId=None,
            originalText=s,
            autoResize=True,
            lineHeight=LINE_H,
            baseline=int(size * 0.9),
            roughness=1,
            strokeWidth=1,
        )
        if group:
            el["groupIds"] = [group]
        return el

    # ------------------------------------------------------------ shapes
    def box(
        self,
        id: str,
        x,
        y,
        w,
        h,
        title: str,
        sub: str | None = None,
        style="you",
        dashed=False,
        shape="rectangle",
        tsize=20,
        ssize=14,
    ):
        bg, stroke = STYLES[style]
        gid = f"g_{id}"
        el = self._base(
            shape,
            x,
            y,
            w,
            h,
            stroke,
            bg,
            id=id,
            groupIds=[gid],
            strokeStyle="dashed" if dashed else "solid",
            roundness={"type": 3} if shape == "rectangle" else {"type": 2},
        )
        avail = w - 24 if shape == "rectangle" else w * 0.58
        t = wrap(title, avail, tsize)
        s = wrap(sub, avail, ssize) if sub else None
        th = len(t.split("\n")) * tsize * LINE_H
        sh = len(s.split("\n")) * ssize * LINE_H if s else 0
        total = th + (6 + sh if s else 0)
        if total > h - 8:
            self.warnings.append(f"{self.name}: text overflows box '{id}' ({total:.0f} > {h - 8})")
        top = y + (h - total) / 2
        self.text(x + 6, top, t, tsize, "#1e1e1e", "center", gid, w=w - 12)
        if s:
            self.text(x + 6, top + th + 6, s, ssize, MUTED, "center", gid, w=w - 12)
        return el

    def frame(self, id: str, x, y, w, h, label: str | None = None):
        """Unfilled dashed grouping rectangle."""
        el = self._base(
            "rectangle", x, y, w, h, STYLES["none"][1], id=id, strokeStyle="dashed",
            roundness={"type": 3},
        )
        if label:
            self.text(x + 10, y + 6, label, 14, MUTED)
        return el

    # ------------------------------------------------------------ arrows
    @staticmethod
    def _pt(el: dict, side: str) -> tuple[float, float]:
        x, y, w, h = el["x"], el["y"], el["width"], el["height"]
        return {"l": (x, y + h / 2), "r": (x + w, y + h / 2), "t": (x + w / 2, y), "b": (x + w / 2, y + h)}[side]

    def _auto_sides(self, a: dict, b: dict) -> tuple[str, str]:
        dx = (b["x"] + b["width"] / 2) - (a["x"] + a["width"] / 2)
        dy = (b["y"] + b["height"] / 2) - (a["y"] + a["height"] / 2)
        hsep = abs(dx) - (a["width"] + b["width"]) / 2
        vsep = abs(dy) - (a["height"] + b["height"]) / 2
        if hsep > vsep:
            return ("r", "l") if dx > 0 else ("l", "r")
        return ("b", "t") if dy > 0 else ("t", "b")

    def arrow(
        self,
        a: str,
        b: str,
        label: str | None = None,
        *,
        dashed=False,
        color="#343a40",
        both=False,
        sides: tuple[str, str] | None = None,
        via: list[tuple[float, float]] | None = None,
        start_pt=None,
        end_pt=None,
        lpos: tuple[float, float] | None = None,
        lalign="left",
        lcolor=None,
        lsize=14,
    ):
        A, B = self.by_id[a], self.by_id[b]
        s_side, e_side = sides or self._auto_sides(A, B)
        sx, sy = start_pt or self._pt(A, s_side)
        ex, ey = end_pt or self._pt(B, e_side)
        way = [(sx, sy), *(via or []), (ex, ey)]
        pts = [[px - sx, py - sy] for px, py in way]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        el = self._base(
            "arrow",
            sx,
            sy,
            max(xs) - min(xs),
            max(ys) - min(ys),
            color,
            points=pts,
            lastCommittedPoint=None,
            startBinding={"elementId": a, "focus": 0, "gap": 2},
            endBinding={"elementId": b, "focus": 0, "gap": 2},
            startArrowhead="arrow" if both else None,
            endArrowhead="arrow",
            elbowed=False,
            strokeStyle="dashed" if dashed else "solid",
            roundness={"type": 2},
        )
        A["boundElements"].append({"id": el["id"], "type": "arrow"})
        B["boundElements"].append({"id": el["id"], "type": "arrow"})
        if label:
            mid = len(way) // 2
            if len(way) % 2:  # odd number of points: use the middle waypoint
                mx, my = way[mid]
            else:
                (x1, y1), (x2, y2) = way[mid - 1], way[mid]
                mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            tw, th = text_size(label, lsize)
            horizontal = abs(ex - sx) >= abs(ey - sy) if len(way) == 2 else False
            if lpos:
                lx, ly = lpos
            elif horizontal:
                lx, ly = mx - tw / 2, my - th - 6
            else:
                lx, ly = mx + 8, my - th / 2
            self.text(lx, ly, label, lsize, lcolor or color, lalign)
        return el

    # ------------------------------------------------------------ output
    def title(self, title: str, subtitle: str | None = None):
        self.text(40, 14, title, 32)
        if subtitle:
            self.text(42, 58, subtitle, 16, MUTED)

    def legend(self, x, y, items: list[tuple[str, str, bool]]):
        """items: (style, label, dashed)"""
        for i, (style, label, dashed) in enumerate(items):
            bg, stroke = STYLES[style]
            lx = x + i * 270
            self._base(
                "rectangle", lx, y, 28, 20, stroke, bg, strokeStyle="dashed" if dashed else "solid",
                roundness={"type": 3},
            )
            self.text(lx + 38, y - 1, label, 15, MUTED)

    def save(self):
        doc = {
            "type": "excalidraw",
            "version": 2,
            "source": "https://excalidraw.com",
            "elements": self.els,
            "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
            "files": {},
        }
        (OUT / f"{self.name}.excalidraw").write_text(json.dumps(doc, indent=2))
        (OUT / f"{self.name}.svg").write_text(render_svg(self.els))
        for w in self.warnings:
            print("WARN", w)
        print(f"wrote {self.name}.excalidraw / .svg ({len(self.els)} elements)")


# ---------------------------------------------------------------------------- SVG preview
def render_svg(els: list[dict]) -> str:
    pad = 40
    xs, ys, xe, ye = [], [], [], []
    for e in els:
        pts = e.get("points")
        if pts:
            xs += [e["x"] + p[0] for p in pts]
            xe += [e["x"] + p[0] for p in pts]
            ys += [e["y"] + p[1] for p in pts]
            ye += [e["y"] + p[1] for p in pts]
        else:
            xs.append(e["x"])
            xe.append(e["x"] + e["width"])
            ys.append(e["y"])
            ye.append(e["y"] + e["height"])
    x0, y0, x1, y1 = min(xs) - pad, min(ys) - pad, max(xe) + pad, max(ye) + pad
    markers: dict[str, str] = {}
    body: list[str] = []
    for e in els:
        t, st, bg = e["type"], e["strokeColor"], e["backgroundColor"]
        dash = ' stroke-dasharray="8 6"' if e.get("strokeStyle") == "dashed" else ""
        if t == "rectangle":
            body.append(
                f'<rect x="{e["x"]}" y="{e["y"]}" width="{e["width"]}" height="{e["height"]}" rx="12" '
                f'fill="{bg}" stroke="{st}" stroke-width="2"{dash}/>'
            )
        elif t == "diamond":
            x, y, w, h = e["x"], e["y"], e["width"], e["height"]
            body.append(
                f'<polygon points="{x + w / 2},{y} {x + w},{y + h / 2} {x + w / 2},{y + h} {x},{y + h / 2}" '
                f'fill="{bg}" stroke="{st}" stroke-width="2"{dash}/>'
            )
        elif t == "text":
            size = e["fontSize"]
            anchor = {"left": "start", "center": "middle", "right": "end"}[e["textAlign"]]
            ax = {"start": e["x"], "middle": e["x"] + e["width"] / 2, "end": e["x"] + e["width"]}[anchor]
            for i, line in enumerate(e["text"].split("\n")):
                body.append(
                    f'<text x="{ax:.1f}" y="{e["y"] + size * (0.95 + LINE_H * i):.1f}" font-size="{size}" '
                    f'fill="{st}" text-anchor="{anchor}">{escape(line)}</text>'
                )
        elif t == "arrow":
            cid = st.lstrip("#")
            markers[cid] = (
                f'<marker id="m{cid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" '
                f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{st}"/></marker>'
            )
            d = " ".join(
                f'{"M" if i == 0 else "L"}{e["x"] + p[0]:.1f},{e["y"] + p[1]:.1f}' for i, p in enumerate(e["points"])
            )
            start = f' marker-start="url(#m{cid})"' if e.get("startArrowhead") else ""
            body.append(
                f'<path d="{d}" fill="none" stroke="{st}" stroke-width="2"{dash} '
                f'marker-end="url(#m{cid})"{start}/>'
            )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1 - x0} {y1 - y0}" '
        f'width="{x1 - x0}" height="{y1 - y0}" font-family="-apple-system, Helvetica, Arial, sans-serif">'
        f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="#ffffff"/>'
        f'<defs>{"".join(markers.values())}</defs>{"".join(body)}</svg>'
    )


LEGEND_OWNERS = [
    ("you", "You: frontend, API, reasoning", False),
    ("partner", "Partner: knowledge layer", False),
    ("ext", "External model / provider", False),
    ("data", "Datastore", False),
]


# ============================================================================ 1. system overview
def system_overview():
    d = Diagram("01-system-overview")
    d.title("Verity: system overview", "who builds what, and where the three seams are")
    A, B, C = 120, 520, 980  # column x
    d.box("ui", B, 100, 360, 80, "React UI", "chat · citations · claim colours · PDF viewer", "you")
    d.box("api", B, 240, 360, 80, "FastAPI", "routes · upload · SSE streaming", "you")
    d.box("ingest", A, 410, 300, 120, "Ingestion pipeline", "parse PDF → chunk → embed → store (P2-P6)", "partner")
    d.box("embed", A, 610, 300, 90, "Embedder (local)", "bge-small · free · no API key", "partner")
    d.box("reason", B, 410, 360, 120, "Reasoning agent", "retrieve → answer with citations → verify claims → abstain (R1-R7)", "you")
    d.box("llm", C, 370, 320, 100, "Answer LLM", "Llama 3.x via Groq / Ollama / OpenRouter", "ext")
    d.box("judge", C, 510, 320, 100, "Judge LLM", "different model family; checks each claim", "ext")
    d.box("retr", B, 610, 360, 120, "Retrieval", "vector + BM25 → RRF fusion → rerank (P7)", "partner")
    d.box("rerank", C, 650, 320, 90, "Reranker (local)", "bge-reranker cross-encoder", "partner")
    d.box("mongo", 240, 840, 520, 110, "MongoDB (Atlas free tier)", "documents · chunks · vector index · text index", "data")

    d.arrow("ui", "api", "HTTP + SSE")
    d.arrow("api", "reason", "question")
    d.arrow("api", "ingest", "upload PDF\n(Seam 3: Ingestor)", lpos=(318, 336), lcolor=SEAM)
    d.arrow("reason", "llm", "answer", both=True, lpos=(884, 392))
    d.arrow("reason", "judge", "verify", lpos=(886, 522))
    d.arrow("reason", "retr", "Seam 1: Retriever", lcolor=SEAM, lpos=(710, 560))
    d.arrow("retr", "embed", "embed\nquery", lpos=(436, 600))
    d.arrow("retr", "rerank", "rerank", lpos=(884, 650))
    d.arrow("ingest", "embed", "embed chunks", lpos=(278, 556))
    d.arrow(
        "ingest", "mongo", "write chunks\n(Seam 2: ChunkStore)", sides=("l", "l"),
        via=[(60, 470), (60, 895)], lpos=(66, 846), lcolor=SEAM,
    )
    d.arrow("retr", "mongo", "Seam 2: ChunkStore", sides=("b", "t"), lcolor=SEAM, lpos=(660, 768))
    d.legend(120, 1010, LEGEND_OWNERS)
    d.save()


# ============================================================================ 2. answer pipeline
def answer_pipeline():
    d = Diagram("02-answer-pipeline")
    d.title("Verity: how a question becomes a verified answer", "solid = built in v0 · dashed = planned (task id in brackets)")
    W, H = 250, 100
    col = lambda i: 40 + i * 310  # noqa: E731
    r0, r1, r2 = 250, 480, 700

    d.box("q", col(0), r0, W, H, "Question", "+ chat history, selected docs", "shared")
    d.box("rw", col(1), r0, W, H, "Rewrite / decompose", "[R5] fast LLM", "you", dashed=True)
    d.box("rt", col(2), r0, W, H, "Retrieve top-k", "Seam 1: Retriever (partner)", "partner")
    d.box("enough", col(3), r0 - 15, W, 130, "Enough evidence?", "[R5]", "you", dashed=True, shape="diamond", tsize=18)
    d.box("rq", 700, 100, 250, 80, "Re-query", "[R5] new search, max 3 rounds", "you", dashed=True)
    d.box("gen", col(4), r0, W, H, "Answer with [n] citations", "main LLM, grounded prompt", "you")

    d.box("quote", col(4), r1, W, H, "Verbatim quote check", "[R2] done: quote must appear in chunk", "you")
    d.box("split", col(3), r1, W, H, "Split into claims", "sentences; failed quote → unsupported", "you")
    d.box("ver", col(2), r1, W, H, "Verify each claim", "[R3] judge LLM vs cited chunks", "you", dashed=True)
    d.box("sup", col(1), r1 - 15, W, 130, "Enough support?", "[R4]", "you", dashed=True, shape="diamond", tsize=18)
    d.box("ans", col(0), r1, W, H, "Answer", "claims coloured green / yellow / red + confidence", "you")
    d.box("abs", col(1), r2, W, H, "Abstain", "“not in this document”", "you")

    d.arrow("q", "rw")
    d.arrow("rw", "rt")
    d.arrow("rt", "enough")
    d.arrow("enough", "gen", "yes", lpos=(1250, 262))
    d.arrow("enough", "rq", "no", sides=("t", "r"), lpos=(1030, 150))
    d.arrow("rq", "rt", "again", sides=("b", "t"), lpos=(838, 204))
    d.arrow("gen", "quote")
    d.arrow("quote", "split")
    d.arrow("split", "ver")
    d.arrow("ver", "sup")
    d.arrow("sup", "ans", "yes", lpos=(310, 470))
    d.arrow("sup", "abs", "no", sides=("b", "t"), lpos=(505, 640))
    d.legend(40, 880, [("you", "You", False), ("partner", "Partner", False), ("shared", "Shared / input", False), ("you", "dashed = planned", True)])
    d.save()


# ============================================================================ 3. knowledge layer
def knowledge_layer():
    d = Diagram("03-knowledge-layer")
    d.title("Knowledge layer: ingestion and retrieval", "partner's half: PDF in, ranked passages out (task ids in brackets)")
    d.text(40, 96, "INGESTION: once per uploaded PDF, in the background", 16, "#2f9e44")
    W, H, y = 210, 110, 130
    x = lambda i: 40 + i * 260  # noqa: E731
    d.box("pdf", x(0), y, W, H, "PDF upload", "from the API, max 25 MB", "shared")
    d.box("parse", x(1), y, W, H, "parse_pdf [P2]", "PyMuPDF · blocks, headings · drop headers/footers", "partner")
    d.box("chunk", x(2), y, W, H, "chunk_pages [P3]", "section-aware · ~400 tokens · overlap · keep page", "partner")
    d.box("emb", x(3), y, W, H, "embed [P4]", "bge-small (384-d) · batched", "partner")
    d.box("upsert", x(4), y, W, H, "Mongo upsert [P5]", "chunks + vectors", "partner")
    d.box("ready", x(5), y, W, H, "status = ready", "or failed + error, never raises", "partner")
    for a, b in [("pdf", "parse"), ("parse", "chunk"), ("chunk", "emb"), ("emb", "upsert"), ("upsert", "ready")]:
        d.arrow(a, b)

    d.box(
        "mongo", 560, 330, 960, 100, "MongoDB (Atlas)",
        "chunks: text + embedding + page + section · vector index (HNSW, cosine) · text index (BM25) · always filtered by doc_id",
        "data",
    )
    d.arrow("upsert", "mongo", "upsert", sides=("b", "t"), end_pt=(1185, 330), lpos=(1196, 262))

    d.text(40, 470, "RETRIEVAL: every question", 16, "#2f9e44")
    d.box("query", 40, 590, 190, 90, "Query", "from the reasoning agent", "shared")
    d.box("eq", 280, 520, 200, 90, "embed_query [P4]", "BGE query prefix", "partner")
    d.frame("par", 530, 505, 250, 290, "run in parallel")
    d.box("vec", 550, 535, 210, 100, "Vector search [P7a]", "top 30 by cosine", "partner")
    d.box("bm", 550, 675, 210, 100, "BM25 search [P7a]", "keywords, top 30", "partner")
    d.box("rrf", 830, 590, 200, 100, "RRF fusion [P7b]", "merge by rank, not score", "partner")
    d.box("rr", 1080, 590, 230, 100, "Cross-encoder rerank [P7c]", "top 30 → top k", "partner")
    d.box("out", 1360, 590, 190, 100, "ScoredChunk[ ]", "→ Reasoning (Seam 1)", "you")

    d.arrow("query", "eq")
    d.arrow("query", "bm", "keywords", lpos=(236, 690))
    d.arrow("eq", "vec")
    d.arrow("vec", "rrf")
    d.arrow("bm", "rrf")
    d.arrow("rrf", "rr")
    d.arrow("rr", "out")
    d.arrow("par", "mongo", "both read MongoDB", dashed=True, sides=("t", "b"), end_pt=(655, 430), lpos=(665, 462))
    d.legend(40, 860, [("partner", "Partner", False), ("you", "You (consumer)", False), ("data", "Datastore", False), ("shared", "Input", False)])
    d.save()


# ============================================================================ 4. work split
def work_split():
    d = Diagram("04-work-split")
    d.title("Who builds what, and when", "two tracks, one frozen contract; milestones are the only sync points")
    steps = [
        ("m0", "M0", "scaffold + contracts (done)", "shared"),
        ("m1", "M1", "both run on mocks (done)", "shared"),
        ("m2", "M2", "real ingestion P2-P6 → INGESTOR=real", "partner"),
        ("m3", "M3", "real retrieval P7 → RETRIEVER=real", "partner"),
        ("m4", "M4", "verifier + real LLM R1-R6", "you"),
        ("m5", "M5", "eval dataset + ablation charts", "shared"),
        ("m6", "M6", "deployed demo + README + video", "shared"),
    ]
    for i, (id, t, s, st) in enumerate(steps):
        d.box(id, 40 + i * 205, 100, 180, 120, t, s, st, tsize=22, ssize=13)
        if i:
            d.arrow(steps[i - 1][0], id)

    def column(x, w, header, style, items):
        d.box(f"h_{header}", x, 280, w, 56, header, None, style, tsize=22)
        y = 360
        for j, (t, s, h) in enumerate(items):
            d.box(f"{header}{j}", x, y, w, h, t, s, style)
            y += h + 20

    column(40, 420, "YOU (with Claude)", "you", [
        ("Frontend F1-F6", "layout · PDF viewer + highlights · claim colours · modes · eval dashboard · states", 110),
        ("API A1-A3", "conversations in Mongo · limits + CORS · background worker", 100),
        ("Reasoning R1-R7", "real LLM · quote check · claim verifier · abstention · query rewrite + re-retrieve · modes · answer eval", 130),
    ])
    column(520, 380, "SHARED", "shared", [
        ("Frozen contracts", "core/schemas.py · core/interfaces.py · openapi.yaml: both approve changes", 110),
        ("Three seams", "Retriever · ChunkStore · Ingestor, each with a dev stand-in", 100),
        ("Eval dataset", "partner labels, you review · 40+ questions · ~25% unanswerable", 100),
        ("CI + CODEOWNERS", "main always green · small PRs", 80),
    ])
    column(960, 420, "PARTNER", "partner", [
        ("Parse + chunk P2-P3", "PyMuPDF · section-aware chunking", 90),
        ("Embeddings + MongoDB P4-P5", "bge-small · vector + text indexes · passes the store contract tests", 110),
        ("Pipeline + retrieval P6-P7", "ingest pipeline · vector · BM25 · RRF · rerank", 100),
        ("CLI + retrieval eval P8-P9", "ablations: chunk size, embedding model, hybrid, rerank", 100),
    ])
    d.legend(40, 920, [("you", "You", False), ("partner", "Partner", False), ("shared", "Shared / both", False)])
    d.save()


if __name__ == "__main__":
    system_overview()
    answer_pipeline()
    knowledge_layer()
    work_split()

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Citation } from "../api/types";
import { ChatPanel } from "../components/chat/ChatPanel";
import { EvidencePanel, type EvidenceTab } from "../components/evidence/EvidencePanel";
import type { SourceTarget } from "../components/evidence/types";
import { IconLibrary, IconPanel } from "../components/icons";
import { Library } from "../components/library/Library";
import { nodeForChunk, type SceneSignal } from "../components/scene/layout";
import { SceneHost } from "../components/scene/SceneHost";
import { TopBar } from "../components/shell/TopBar";
import { IconButton } from "../components/ui/Button";
import { Drawer } from "../components/ui/Dialog";
import { quoteState } from "../components/verify/meta";
import { useMediaQuery } from "../lib/media";
import { useChat, type Turn } from "../state/chat";
import { useDocuments } from "../state/documents";

/**
 * The main screen: library | chat | evidence.
 * Wide screens show all three columns (evidence collapsible). Medium screens move the evidence
 * panel into a drawer; small screens move both side panels into drawers.
 */
export default function Workspace() {
  const { docs, selected, setSelected } = useDocuments();
  const { turns } = useChat();
  const wide = useMediaQuery("(min-width: 1180px)");
  const medium = useMediaQuery("(min-width: 860px)");

  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [drawer, setDrawer] = useState<"library" | "evidence" | null>(null);
  const [tab, setTab] = useState<EvidenceTab>("passages");
  const [target, setTarget] = useState<SourceTarget | null>(null);
  const [active, setActive] = useState<{ turnId: string; n: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // First visit: select the first ready document so the user can ask right away.
  useEffect(() => {
    if (selected.length === 0) {
      const first = docs.find((d) => d.status === "ready");
      if (first) setSelected([first.id]);
    }
    // Deliberately keyed on docs.length only: re-run when documents arrive, not on every poll.
  }, [docs.length]);

  // A new question resets the panel to "what did Verity read".
  useEffect(() => {
    if (turns.length === 0) return;
    setTab("passages");
    setActive(null);
  }, [turns.length]);

  // Close drawers that no longer apply after a resize.
  useEffect(() => {
    if (wide && drawer === "evidence") setDrawer(null);
    if (medium && drawer === "library") setDrawer(null);
  }, [wide, medium, drawer]);

  const showEvidence = useCallback(() => {
    if (wide) setEvidenceOpen(true);
    else setDrawer("evidence");
  }, [wide]);

  const openTarget = useCallback(
    (t: SourceTarget) => {
      setTarget(t);
      setTab("source");
      showEvidence();
    },
    [showEvidence],
  );

  const onOpenCitation = useCallback(
    (turnId: string, c: Citation) => {
      setActive({ turnId, n: c.n });
      openTarget({ docId: c.doc_id, page: c.page, chunkId: c.chunk_id, quote: c.quote, verified: c.verified, n: c.n });
    },
    [openTarget],
  );

  // Page buttons: leaving the cited page drops the quote highlight.
  const onPage = (page: number) =>
    setTarget((t) => (t ? { ...t, page, quote: null, chunkId: null, verified: undefined, n: undefined } : t));

  // Keyboard: "/" focuses the composer, Escape closes drawers then the evidence panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable=true]");
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && !e.defaultPrevented) {
        if (document.querySelector(".popover")) return; // a popover consumes this Escape
        if (drawer) return; // the drawer's own focus trap handles it
        if (wide && evidenceOpen && !typing) setEvidenceOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer, wide, evidenceOpen]);

  const evidenceTurn: Turn | null = (active && turns.find((t) => t.id === active.turnId)) || turns[turns.length - 1] || null;
  const signal = useSceneSignal(evidenceTurn);

  const evidence = (
    <EvidencePanel
      turn={evidenceTurn}
      tab={tab}
      onTab={setTab}
      target={target}
      onOpen={openTarget}
      onPage={onPage}
      header={
        <div className="evidence-scene">
          <SceneHost signal={signal} variant="panel" />
          <SceneCaption turn={evidenceTurn} />
        </div>
      }
    />
  );

  return (
    <div className={`workspace ${wide && evidenceOpen ? "has-evidence" : ""} ${wide ? "is-wide" : ""} ${medium ? "is-medium" : "is-small"}`}>
      <TopBar
        start={
          !medium && (
            <IconButton label="Open library" onClick={() => setDrawer("library")}>
              <IconLibrary />
            </IconButton>
          )
        }
        end={
          <IconButton
            label={wide ? (evidenceOpen ? "Hide evidence panel" : "Show evidence panel") : "Open evidence"}
            aria-pressed={wide ? evidenceOpen : undefined}
            onClick={() => (wide ? setEvidenceOpen((o) => !o) : setDrawer("evidence"))}
          >
            <IconPanel />
          </IconButton>
        }
      />
      <div className="workspace-body">
        {medium && (
          <aside className="ws-library" aria-label="Library">
            <Library />
          </aside>
        )}
        <main id="main" tabIndex={-1} className="ws-chat">
          <ChatPanel onOpenCitation={onOpenCitation} active={active} inputRef={inputRef} />
        </main>
        {wide && evidenceOpen && (
          <aside className="ws-evidence" aria-label="Evidence">
            {evidence}
          </aside>
        )}
      </div>

      <Drawer open={drawer === "library"} onClose={() => setDrawer(null)} side="left" label="Library">
        <Library />
      </Drawer>
      <Drawer open={drawer === "evidence"} onClose={() => setDrawer(null)} side={medium ? "right" : "bottom"} label="Evidence">
        {evidence}
      </Drawer>
    </div>
  );
}

/** One line under the scene explaining what the stars currently show. */
function SceneCaption({ turn }: { turn: Turn | null }) {
  let text = "Each star is a passage of your selected papers.";
  if (turn?.status === "retrieving") text = "Searching passages…";
  else if (turn?.retrieved && !turn.answer) text = `${turn.retrieved.length} passages lit by relevance`;
  else if (turn?.answer?.abstained) text = "Nothing relevant enough: Verity abstained";
  else if (turn?.answer) {
    const c = turn.answer.citations;
    const ok = c.filter((x) => x.verified === true).length;
    text = `${c.length} citation thread${c.length === 1 ? "" : "s"} · ${ok} quote${ok === 1 ? "" : "s"} verified`;
  }
  return (
    <p className="scene-caption" aria-live="polite">
      {text}
    </p>
  );
}

/** Translate the chat state into what the constellation should light up. */
function useSceneSignal(turn: Turn | null): SceneSignal {
  const { docs, selected } = useDocuments();
  const totalChunks = docs.filter((d) => selected.includes(d.id)).reduce((s, d) => s + d.n_chunks, 0);
  // More passages, more stars; padded so tiny docs still look like a sky.
  const nodeCount = Math.max(42, Math.min(120, totalChunks * 4));

  return useMemo<SceneSignal>(() => {
    if (!turn) return { nodeCount, phase: "idle", lit: [], threads: [] };
    const chunks = turn.retrieved ?? [];
    const max = Math.max(...chunks.map((c) => c.score), 1e-9);
    const lit = chunks.map((c) => ({ index: nodeForChunk(c.chunk.id, nodeCount), strength: c.score / max }));
    const threads = (turn.answer?.citations ?? []).map((c) => ({
      index: nodeForChunk(c.chunk_id, nodeCount),
      state: quoteState(c.verified),
    }));
    const phase =
      turn.status === "retrieving" ? "retrieving" : turn.status === "streaming" ? "answering" : turn.answer ? "done" : "idle";
    return { nodeCount, phase, lit, threads };
  }, [turn, nodeCount]);
}

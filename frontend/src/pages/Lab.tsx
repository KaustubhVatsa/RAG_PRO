import { useId, useState, type ReactNode } from "react";
import { Lockup, LogoLoader, LogoMark } from "../components/brand/Logo";
import { AbstentionCard } from "../components/chat/AbstentionCard";
import { AssistantMessage } from "../components/chat/AssistantMessage";
import { ClaimSummary } from "../components/chat/ClaimSummary";
import { MODES } from "../components/chat/Composer";
import { AnswerEvalCard, EvalEmpty, RetrievalEvalCard } from "../components/eval/EvalCards";
import "../components/eval/eval.css";
import { PaperPage } from "../components/evidence/ChunkSource";
import { RetrievedList } from "../components/evidence/RetrievedList";
import { IconAlert, IconClose, IconSend, IconTrash, IconUpload } from "../components/icons";
import { DocStatusChip } from "../components/library/DocStatusChip";
import { ProgressRing } from "../components/library/Dropzone";
import type { SceneSignal } from "../components/scene/layout";
import { nodeForChunk } from "../components/scene/layout";
import { SceneHost } from "../components/scene/SceneHost";
import { TopBar } from "../components/shell/TopBar";
import { Button, IconButton, MagneticButton } from "../components/ui/Button";
import { Dialog, Drawer } from "../components/ui/Dialog";
import { ConfidenceMeter, EmptyState, Skeleton } from "../components/ui/Feedback";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Tabs } from "../components/ui/Tabs";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { CitationChip } from "../components/verify/CitationChip";
import { ClaimSpan } from "../components/verify/ClaimSpan";
import { CLAIM_ORDER, ClaimBadge, QuoteBadge } from "../components/verify/meta";
import * as F from "../lab/fixtures";
import { renderInline } from "../lib/markdown";
import type { ChatMode } from "../api/types";

/**
 * Design Lab (#/lab): every component in every state, in light and dark side by side, using
 * fixture data only. This page is how the design is reviewed without running the backend.
 * (Hover popovers render into <body>, so they follow the page theme, not the column's.)
 */
export default function Lab() {
  return (
    <div className="page lab-page">
      <TopBar />
      <main id="main" tabIndex={-1} className="page-main lab-main">
        <header className="page-head">
          <div>
            <p className="eyebrow">Design Lab</p>
            <h1 className="page-title">Every component, every state</h1>
            <p className="page-lead">
              Fixture data, no backend required. Each block renders in the light theme (left) and the dark theme (right).
              Hover citations and claims to see their popovers.
            </p>
          </div>
        </header>
        <nav className="lab-toc" aria-label="Lab sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#/lab`} onClick={(e) => {
              e.preventDefault();
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
            }}>
              {s.title}
            </a>
          ))}
        </nav>
        {SECTIONS.map((s) => (
          <LabSection key={s.id} id={s.id} title={s.title} note={s.note}>
            {s.render()}
          </LabSection>
        ))}
      </main>
    </div>
  );
}

function LabSection({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="lab-section" aria-labelledby={`${id}-t`}>
      <div className="lab-section-head">
        <h2 id={`${id}-t`}>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      <div className="lab-pair">
        <div className="lab-theme" data-theme="light">
          <span className="lab-theme-tag">Light</span>
          {children}
        </div>
        <div className="lab-theme" data-theme="dark">
          <span className="lab-theme-tag">Dark</span>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Small labelled cell inside a section. */
const Spec = ({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) => (
  <div className={`lab-spec ${wide ? "is-wide" : ""}`}>
    <div className="lab-spec-label">{label}</div>
    <div className="lab-spec-body">{children}</div>
  </div>
);

const noop = () => {};

function ModeDemo() {
  const [mode, setMode] = useState<ChatMode>("teacher");
  return <SegmentedControl label="Answer mode" value={mode} options={MODES} onChange={setMode} size="sm" />;
}
function TabsDemo() {
  const [tab, setTab] = useState<"passages" | "source">("passages");
  const id = useId();
  return (
    <Tabs
      baseId={`lab-tabs-${id}`}
      label="Demo tabs"
      value={tab}
      onChange={setTab}
      tabs={[
        { id: "passages", label: "Passages" },
        { id: "source", label: "Source" },
      ]}
    />
  );
}
function OverlayDemo() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="lab-row">
      <Button onClick={() => setDialog(true)}>Open dialog</Button>
      <Button onClick={() => setDrawer(true)}>Open drawer</Button>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Delete this document?"
        description="“Attention Is All You Need” and its indexed passages will be removed."
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)} data-autofocus>
              Cancel
            </Button>
            <Button variant="danger" icon={<IconTrash size={15} />} onClick={() => setDialog(false)}>
              Delete
            </Button>
          </>
        }
      />
      <Drawer open={drawer} onClose={() => setDrawer(false)} side="right" label="Evidence">
        <RetrievedList chunks={F.RETRIEVED} citations={F.ANSWER.citations} loading={false} onOpen={noop} docTitle={() => undefined} />
      </Drawer>
    </div>
  );
}
function ReplayLogo() {
  const [k, setK] = useState(0);
  return (
    <div className="lab-row">
      <LogoMark key={k} size={56} animated />
      <Button size="sm" variant="ghost" onClick={() => setK((x) => x + 1)}>
        Replay
      </Button>
    </div>
  );
}

const SWATCHES = [
  "--bg",
  "--surface",
  "--surface-2",
  "--text",
  "--text-muted",
  "--accent",
  "--accent-text",
  "--supported",
  "--unsupported",
  "--contradicted",
  "--unverified",
  "--sea",
];

const doneSignal: SceneSignal = {
  nodeCount: 60,
  phase: "done",
  lit: F.RETRIEVED.map((r) => ({ index: nodeForChunk(r.chunk.id, 60), strength: r.score })),
  threads: F.ANSWER.citations.map((c) => ({
    index: nodeForChunk(c.chunk_id, 60),
    state: c.verified === true ? "verified" : c.verified === false ? "flagged" : "none",
  })),
};

const SECTIONS: { id: string; title: string; note?: string; render: () => ReactNode }[] = [
  {
    id: "brand",
    title: "Brand",
    note: "Lens + check + evidence node. Ring and check use currentColor, the node uses the accent token.",
    render: () => (
      <div className="lab-grid">
        <Spec label="Lockup">
          <Lockup size={34} />
        </Spec>
        <Spec label="Mark at 16 / 24 / 40">
          <div className="lab-row">
            <LogoMark size={16} />
            <LogoMark size={24} />
            <LogoMark size={40} />
          </div>
        </Spec>
        <Spec label="Draw-on animation">
          <ReplayLogo />
        </Spec>
        <Spec label="Loading moment">
          <LogoLoader label="Opening workspace" />
        </Spec>
      </div>
    ),
  },
  {
    id: "tokens",
    title: "Colour & type",
    render: () => (
      <div className="lab-grid">
        <Spec label="Tokens" wide>
          <div className="swatches">
            {SWATCHES.map((s) => (
              <div key={s} className="swatch">
                <span className="swatch-chip" style={{ background: `var(${s})` }} />
                <code>{s}</code>
              </div>
            ))}
          </div>
        </Spec>
        <Spec label="Type scale" wide>
          <div className="type-specimen">
            <p className="ts-display">Ask the paper.</p>
            <p className="ts-2xl">Every sentence carries its verdict</p>
            <p className="ts-lg">Fraunces for voice, Inter for interface</p>
            <p>Body 15/1.6: answers stay readable at length, with a measure capped near 70 characters.</p>
            <p className="ts-mono">JetBrains Mono · p. 5 · score 0.912</p>
          </div>
        </Spec>
      </div>
    ),
  },
  {
    id: "controls",
    title: "Controls",
    render: () => (
      <div className="lab-grid">
        <Spec label="Buttons">
          <div className="lab-row wrap">
            <Button variant="primary" icon={<IconSend size={15} />}>
              Primary
            </Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon={<IconTrash size={15} />}>
              Danger
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Spec>
        <Spec label="Magnetic CTA + sizes">
          <div className="lab-row wrap">
            <MagneticButton variant="primary" size="lg">
              Try the demo paper
            </MagneticButton>
            <Button size="sm">Small</Button>
            <IconButton label="Upload">
              <IconUpload />
            </IconButton>
            <IconButton label="Close" size="sm">
              <IconClose size={15} />
            </IconButton>
          </div>
        </Spec>
        <Spec label="Mode switcher (arrow keys)">
          <ModeDemo />
        </Spec>
        <Spec label="Theme switch + tabs">
          <div className="lab-row wrap">
            <ThemeToggle />
            <TabsDemo />
          </div>
        </Spec>
        <Spec label="Dialog + drawer (focus trapped, Esc closes)">
          <OverlayDemo />
        </Spec>
      </div>
    ),
  },
  {
    id: "verification",
    title: "Citations & claims",
    note: "Three citation states (verified, flagged, no quote) plus pending while streaming; four claim states, each with icon + underline pattern.",
    render: () => (
      <div className="lab-grid">
        <Spec label="Citation chips">
          <div className="lab-row">
            <CitationChip n={1} citation={F.C_VERIFIED} section="3.2.2 Multi-Head Attention" />
            <CitationChip n={3} citation={F.C_FLAGGED} />
            <CitationChip n={4} citation={F.C_NONE} />
            <CitationChip n={5} />
            <CitationChip n={1} citation={F.C_VERIFIED} active />
          </div>
        </Spec>
        <Spec label="Quote badges">
          <div className="lab-row wrap">
            <QuoteBadge verified />
            <QuoteBadge verified={false} />
            <QuoteBadge verified={null} />
          </div>
        </Spec>
        <Spec label="Claim badges">
          <div className="lab-row wrap">
            {CLAIM_ORDER.map((s) => (
              <ClaimBadge key={s} status={s} />
            ))}
          </div>
        </Spec>
        <Spec label="Claim sentences (hover me)" wide>
          <p className="md lab-claims">
            {F.CLAIMS.map((c, i) => (
              <span key={i}>
                <ClaimSpan claim={c} index={i} revealed>
                  {renderInline(c.text.replace(/\s*\[\d+\]\.?$/, "."))}
                </ClaimSpan>{" "}
              </span>
            ))}
          </p>
        </Spec>
        <Spec label="Claim summary (click to expand)" wide>
          <ClaimSummary claims={F.CLAIMS} />
        </Spec>
      </div>
    ),
  },
  {
    id: "answers",
    title: "Answers",
    note: "A finished answer mixing all four claim states and all three citation states.",
    render: () => (
      <div className="lab-stack">
        <AssistantMessage turn={F.TURN_DONE} animate={false} onOpenCitation={noop} activeCitation={2} onRetry={noop} />
        <AssistantMessage turn={F.TURN_NO_CONFIDENCE} animate={false} onOpenCitation={noop} activeCitation={null} onRetry={noop} />
        <AssistantMessage turn={F.TURN_FACTCHECK} animate={false} onOpenCitation={noop} activeCitation={null} onRetry={noop} />
      </div>
    ),
  },
  {
    id: "states",
    title: "Answer lifecycle",
    note: "Retrieving → streaming (Evidence block hidden, caret) → done; plus abstention, error and stopped.",
    render: () => (
      <div className="lab-stack">
        <AssistantMessage turn={F.TURN_RETRIEVING} animate={false} onOpenCitation={noop} activeCitation={null} onRetry={noop} />
        <AssistantMessage turn={F.TURN_STREAMING} animate={false} onOpenCitation={noop} activeCitation={null} onRetry={noop} />
        <AssistantMessage turn={F.TURN_ABSTAIN} animate={false} onOpenCitation={noop} activeCitation={null} onRetry={noop} />
        <AssistantMessage turn={F.TURN_ERROR} animate={false} onOpenCitation={noop} activeCitation={null} onRetry={noop} />
        <AssistantMessage turn={F.TURN_STOPPED} animate={false} onOpenCitation={noop} activeCitation={null} onRetry={noop} />
      </div>
    ),
  },
  {
    id: "meters",
    title: "Confidence & feedback",
    render: () => (
      <div className="lab-grid">
        <Spec label="Confidence 0.92 / 0.60 / 0.28">
          <div className="lab-stack tight">
            <ConfidenceMeter value={0.92} />
            <ConfidenceMeter value={0.6} />
            <ConfidenceMeter value={0.28} />
          </div>
        </Spec>
        <Spec label="Confidence null">
          <p className="lab-muted">Renders nothing (no misleading empty meter).</p>
          <ConfidenceMeter value={null} />
        </Spec>
        <Spec label="Skeleton">
          <Skeleton lines={3} />
        </Spec>
        <Spec label="Abstention (standalone)" wide>
          <AbstentionCard text="I can't find this in the provided document(s)." reason="model found no support in the excerpts" mode="factcheck" onSuggest={noop} />
        </Spec>
      </div>
    ),
  },
  {
    id: "library",
    title: "Library & upload",
    render: () => (
      <div className="lab-grid">
        <Spec label="Document status">
          <div className="lab-stack tight">
            <DocStatusChip doc={{ status: "ready", n_chunks: 11, n_pages: 8, error: null }} />
            <DocStatusChip doc={{ status: "processing", n_chunks: 0, n_pages: 0, error: null }} />
            <DocStatusChip doc={{ status: "failed", n_chunks: 0, n_pages: 0, error: "ValueError: encrypted PDF" }} />
          </div>
        </Spec>
        <Spec label="Upload progress">
          <div className="lab-row">
            <ProgressRing value={0.15} />
            <ProgressRing value={0.55} />
            <ProgressRing value={0.92} size={30} />
          </div>
        </Spec>
        <Spec label="Upload error">
          <div className="upload-error" role="note">
            <IconAlert size={14} />
            <div>
              <strong>notes.docx</strong>
              <span>Only PDF files are supported.</span>
            </div>
          </div>
        </Spec>
        <Spec label="Dropzone (dragging)">
          <div className="dropzone dropzone-compact is-dragging">
            <button type="button" className="dropzone-btn">
              <span className="dropzone-icon">
                <IconUpload size={16} />
              </span>
              <span className="dropzone-text">
                <strong>Drop to upload</strong>
              </span>
            </button>
          </div>
        </Spec>
      </div>
    ),
  },
  {
    id: "evidence",
    title: "Evidence",
    render: () => (
      <div className="lab-grid">
        <Spec label="Retrieved passages" wide>
          <RetrievedList chunks={F.RETRIEVED} citations={F.ANSWER.citations} loading={false} onOpen={noop} docTitle={() => undefined} />
        </Spec>
        <Spec label="Loading">
          <RetrievedList chunks={null} citations={[]} loading onOpen={noop} docTitle={() => undefined} />
        </Spec>
        <Spec label="No passages">
          <RetrievedList chunks={[]} citations={[]} loading={false} onOpen={noop} docTitle={() => undefined} />
        </Spec>
        <Spec label="Source fallback: indexed text with quote" wide>
          <PaperPage page={5} chunks={[F.CHUNKS[0]]} chunkId={F.CHUNKS[0].id} quote={F.C_VERIFIED.quote} />
        </Spec>
        <Spec label="Empty source">
          <EmptyState title="No source open">Click a citation chip in an answer to open the page here.</EmptyState>
        </Spec>
      </div>
    ),
  },
  {
    id: "scene",
    title: "Knowledge constellation",
    note: "Top: WebGL (if available). Bottom: the static SVG fallback used for reduced motion / no WebGL.",
    render: () => (
      <div className="lab-grid">
        <Spec label="3D: answer with citation threads" wide>
          <div className="lab-scene">
            <SceneHost signal={doneSignal} variant="panel" force="3d" />
          </div>
        </Spec>
        <Spec label="Fallback: idle">
          <div className="lab-scene small">
            <SceneHost signal={{ ...doneSignal, phase: "idle", lit: [], threads: [] }} variant="panel" force="fallback" />
          </div>
        </Spec>
        <Spec label="Fallback: retrieved">
          <div className="lab-scene small">
            <SceneHost signal={{ ...doneSignal, phase: "retrieving", threads: [] }} variant="panel" force="fallback" />
          </div>
        </Spec>
        <Spec label="Fallback: cited">
          <div className="lab-scene small">
            <SceneHost signal={doneSignal} variant="panel" force="fallback" />
          </div>
        </Spec>
      </div>
    ),
  },
  {
    id: "eval",
    title: "Eval dashboard",
    render: () => (
      <div className="lab-stack">
        <RetrievalEvalCard data={F.RETRIEVAL_EVAL} />
        <AnswerEvalCard data={F.ANSWER_EVAL} />
        <EvalEmpty kind="retrieval" />
      </div>
    ),
  },
];

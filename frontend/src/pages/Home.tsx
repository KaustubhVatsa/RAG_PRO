import type { ReactNode } from "react";
import { LogoMark } from "../components/brand/Logo";
import { IconChevron, IconLayers, IconLens, IconQuote, IconSparkle } from "../components/icons";
import { Dropzone } from "../components/library/Dropzone";
import type { SceneSignal } from "../components/scene/layout";
import { SceneHost } from "../components/scene/SceneHost";
import { TopBar } from "../components/shell/TopBar";
import { MagneticButton } from "../components/ui/Button";
import { CLAIM_META, CLAIM_ORDER, QuoteBadge } from "../components/verify/meta";
import { useTilt } from "../lib/media";
import { hrefFor, navigate } from "../lib/router";
import { DEMO_DOC_ID, useDocuments } from "../state/documents";

const HERO_SIGNAL: SceneSignal = { nodeCount: 110, phase: "idle", lit: [], threads: [], ambient: true };

/** Landing page: what Verity is, the living constellation, and two ways in (demo or upload). */
export default function Home() {
  const { docs, setSelected, backend } = useDocuments();
  const demo = docs.find((d) => d.id === DEMO_DOC_ID && d.status === "ready");
  const readyCount = docs.filter((d) => d.status === "ready").length;

  const tryDemo = () => {
    if (demo) setSelected([demo.id]);
    navigate("workspace");
  };

  return (
    <div className="home">
      <TopBar />
      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <IconSparkle size={13} /> Grounded answers for research papers
            </p>
            <h1 id="hero-title" className="hero-title">
              Ask the paper.
              <br />
              <em>See the proof.</em>
            </h1>
            <p className="hero-lead">
              Verity answers only from your PDF. Every claim cites a page and an exact quote, every quote is checked
              against the source, and when the paper doesn't say, Verity says so.
            </p>
            <div className="hero-actions">
              <MagneticButton variant="primary" size="lg" onClick={tryDemo} iconEnd={<IconChevron size={16} />}>
                Try the demo paper
              </MagneticButton>
              <span className="hero-demo-note">
                {demo ? "“Attention Is All You Need”, preloaded" : backend === "offline" ? "start the backend to try it" : " "}
              </span>
            </div>
            <Dropzone variant="hero" onUploaded={() => navigate("workspace")} />
            {readyCount > 0 && (
              <a className="hero-continue" href={hrefFor("workspace")}>
                Continue to your workspace · {readyCount} document{readyCount === 1 ? "" : "s"} ready
              </a>
            )}
          </div>

          <div className="hero-visual">
            <SceneHost signal={HERO_SIGNAL} variant="hero" className="hero-scene" />
            {/* Floating annotations: what the lit stars and threads mean. */}
            <FloatCard className="float-a">
              <span className="float-kicker">
                <span className="cite-chip cite-verified demo-chip">2</span> page 5
              </span>
              <q>The base model uses h=8 parallel attention heads.</q>
              <QuoteBadge verified />
            </FloatCard>
            <FloatCard className="float-b">
              <span className={`claim-badge claim-badge-supported`}>
                {CLAIM_META.supported.icon(14)} Supported
              </span>
              <span className="float-text">Claim matches its cited passage</span>
            </FloatCard>
            <FloatCard className="float-c">
              <span className="float-kicker">
                <IconLens size={13} /> Not in this document
              </span>
              <span className="float-text">No evidence, no answer.</span>
            </FloatCard>
          </div>
        </section>

        <section className="how" aria-labelledby="how-title">
          <h2 id="how-title" className="section-title">
            How an answer earns your trust
          </h2>
          <div className="how-grid">
            <TiltCard
              step="01"
              icon={<IconLayers size={20} />}
              title="Retrieve"
              text="Hybrid search ranks the passages most likely to hold the answer. You can inspect every one, with its score."
            />
            <TiltCard
              step="02"
              icon={<IconQuote size={20} />}
              title="Quote"
              text="The model must cite a passage and copy an exact phrase from it. A program checks the quote word for word."
            />
            <TiltCard
              step="03"
              icon={<LogoMark size={20} />}
              title="Verify, or abstain"
              text="Each sentence is judged against its evidence. If nothing supports an answer, you get “not in the document”, not fiction."
            />
          </div>
        </section>

        <section className="legend-section" aria-labelledby="legend-title">
          <div className="legend-copy">
            <h2 id="legend-title" className="section-title">
              Every sentence carries its verdict
            </h2>
            <p>
              Each state has its own colour, icon and underline, so the verdict reads even without colour. Hover any
              sentence in an answer to see why.
            </p>
          </div>
          <ul className="legend-list">
            {CLAIM_ORDER.map((s, i) => (
              <li key={s} className="legend-item">
                <span className={`claim claim-${s} is-revealed`} style={{ ["--d" as string]: `${i * 120}ms` }}>
                  {LEGEND_SAMPLES[s]}
                </span>
                <span className={`claim-badge claim-badge-${s}`}>
                  {CLAIM_META[s].icon(13)} {CLAIM_META[s].label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="footer">
        <span className="footer-mark">
          <LogoMark size={18} /> Verity
        </span>
        <span>Answers you can check. Built with retrieval, verbatim quote checks and claim verification.</span>
      </footer>
    </div>
  );
}

const LEGEND_SAMPLES = {
  supported: "The Transformer dispenses with recurrence entirely.",
  unsupported: "It was trained on a billion sentence pairs.",
  contradicted: "Each layer uses a single attention head.",
  unverified: "Scaling keeps softmax gradients from vanishing.",
} as const;

function FloatCard({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`float-card ${className}`} aria-hidden="true">
      {children}
    </div>
  );
}

function TiltCard({ step, icon, title, text }: { step: string; icon: ReactNode; title: string; text: string }) {
  const ref = useTilt<HTMLDivElement>(7);
  return (
    <div ref={ref} className="tilt-card">
      <div className="tilt-inner">
        <span className="tilt-step">{step}</span>
        <span className="tilt-icon" aria-hidden="true">
          {icon}
        </span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

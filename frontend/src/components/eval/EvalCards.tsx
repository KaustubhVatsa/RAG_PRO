import { useState } from "react";
import type { AnswerEval, RetrievalEval } from "../../api/evals";
import { IconCheck, IconTerminal } from "../icons";

/**
 * Eval dashboard pieces, hand-rolled SVG (no chart library). Each chart is a single series in the
 * accent colour; values are printed on the marks and repeated in a visually-hidden table, so
 * nothing relies on reading bar lengths or colour.
 */

const pct = (v: number) => `${Math.round(v * 100)}%`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "unknown time");

export function RetrievalEvalCard({ data }: { data: RetrievalEval }) {
  return (
    <article className="eval-card">
      <EvalHead title="Retrieval" label={data.label} n={data.nQuestions} createdAt={data.createdAt} />
      <div className="eval-tiles">
        {data.recall.map((r) => (
          <StatTile key={r.k} label={`Recall@${r.k}`} value={pct(r.value)} hint={`a gold page is in the top ${r.k}`} />
        ))}
        {data.mrr !== null && <StatTile label="MRR" value={data.mrr.toFixed(3)} hint="1 / rank of the first gold page" />}
      </div>
      <div className="eval-charts">
        {data.recall.length > 0 && <RecallChart recall={data.recall} />}
        {data.mrr !== null && <MrrGauge value={data.mrr} />}
      </div>
    </article>
  );
}

export function AnswerEvalCard({ data }: { data: AnswerEval }) {
  const rows = [
    { key: "answerable", label: "Answers when it should", value: data.abstention.answerable },
    { key: "abstain", label: "Abstains when it should", value: data.abstention.shouldAbstain },
  ];
  return (
    <article className="eval-card">
      <EvalHead title="Answers" label={data.label} n={data.nQuestions} createdAt={data.createdAt} />
      <p className="eval-explain">
        Abstention accuracy: on answerable questions Verity should answer; on unanswerable or false-premise questions it
        should say the paper doesn't support an answer.
      </p>
      <div className="hbars" role="img" aria-label="Abstention accuracy by question type">
        {rows.map((r) => (
          <div key={r.key} className="hbar">
            <span className="hbar-label">{r.label}</span>
            <span className="hbar-track">
              <span className="hbar-fill" style={{ transform: `scaleX(${r.value ?? 0})` }} />
            </span>
            <span className="hbar-value">{r.value === null ? "n/a" : pct(r.value)}</span>
          </div>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>Abstention accuracy</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>{r.value === null ? "no questions" : pct(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function EvalHead({ title, label, n, createdAt }: { title: string; label: string; n: number; createdAt: string | null }) {
  return (
    <header className="eval-head">
      <h2>{title}</h2>
      <div className="eval-meta">
        <span className="eval-run">{label}</span>
        <span>{n} questions</span>
        <span>{when(createdAt)}</span>
      </div>
    </header>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat-tile" title={hint}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-hint">{hint}</span>
    </div>
  );
}

/** Vertical bars for recall@k: should rise with k. */
function RecallChart({ recall }: { recall: { k: number; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 280;
  const H = 150;
  const pad = { l: 30, r: 8, t: 14, b: 24 };
  const bw = Math.min(44, (W - pad.l - pad.r) / recall.length - 14);
  const step = (W - pad.l - pad.r) / recall.length;
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);

  return (
    <figure className="chart">
      <figcaption className="chart-title">Recall by cutoff k</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={recall.map((r) => `recall at ${r.k}: ${pct(r.value)}`).join(", ")}>
        {[0, 0.5, 1].map((g) => (
          <g key={g} className="chart-grid">
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} />
            <text x={pad.l - 6} y={y(g) + 3} textAnchor="end">
              {pct(g)}
            </text>
          </g>
        ))}
        {recall.map((r, i) => {
          const x = pad.l + step * i + (step - bw) / 2;
          const h = Math.max(2, y(0) - y(r.value));
          return (
            <g key={r.k} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? "is-hover" : ""}>
              {/* generous invisible hit target */}
              <rect x={pad.l + step * i} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
              <path className="chart-bar" d={roundedTopBar(x, y(0), bw, h, 4)} style={{ ["--i" as string]: i }} />
              <text className="chart-value" x={x + bw / 2} y={y(r.value) - 5} textAnchor="middle">
                {pct(r.value)}
              </text>
              <text className="chart-axis" x={x + bw / 2} y={H - 8} textAnchor="middle">
                k={r.k}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Bar with only the top corners rounded, anchored on the baseline. */
function roundedTopBar(x: number, base: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  const top = base - h;
  return `M${x},${base} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + w - rr} Q${x + w},${top} ${x + w},${top + rr} V${base} Z`;
}

/** Half-ring gauge for MRR (0..1). */
function MrrGauge({ value }: { value: number }) {
  const r = 56;
  const len = Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <figure className="chart chart-gauge">
      <figcaption className="chart-title">Mean reciprocal rank</figcaption>
      <svg viewBox="0 0 150 92" role="img" aria-label={`MRR ${value.toFixed(3)}`}>
        <path className="gauge-track" d={`M${75 - r},80 A${r},${r} 0 0 1 ${75 + r},80`} />
        <path
          className="gauge-fill"
          d={`M${75 - r},80 A${r},${r} 0 0 1 ${75 + r},80`}
          strokeDasharray={len}
          strokeDashoffset={len * (1 - v)}
        />
        <text className="gauge-value" x="75" y="74" textAnchor="middle">
          {value.toFixed(2)}
        </text>
        <text className="chart-axis" x={75 - r} y="91" textAnchor="middle">
          0
        </text>
        <text className="chart-axis" x={75 + r} y="91" textAnchor="middle">
          1
        </text>
      </svg>
    </figure>
  );
}

/** Empty state: no results file yet, with the exact command to make one. */
export function EvalEmpty({ kind }: { kind: "retrieval" | "answer" }) {
  const cmd = kind === "retrieval" ? "make eval-retrieval" : "make eval-answer";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the command is visible anyway */
    }
  };
  return (
    <article className="eval-card eval-empty">
      <header className="eval-head">
        <h2>{kind === "retrieval" ? "Retrieval" : "Answers"}</h2>
        <div className="eval-meta">
          <span>no results yet</span>
        </div>
      </header>
      <EmptyChartArt />
      <p className="eval-explain">
        {kind === "retrieval"
          ? "Measures whether the right pages are found: recall@k and MRR over the labelled question set."
          : "Measures whether Verity answers answerable questions and abstains on unanswerable or false-premise ones."}
      </p>
      <div className="cmd">
        <IconTerminal size={16} />
        <code>{cmd}</code>
        <button type="button" className="cmd-copy" onClick={copy} aria-label={`Copy command ${cmd}`}>
          {copied ? (
            <>
              <IconCheck size={13} /> Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <p className="eval-footnote">
        Run it from the repo root. Results land in <code>backend/evals/results/</code> and show up here on refresh.
      </p>
    </article>
  );
}

/** Ghosted bars: hints at what will appear. */
function EmptyChartArt() {
  return (
    <svg className="empty-chart" viewBox="0 0 200 70" aria-hidden="true">
      {[0.35, 0.62, 0.8, 0.5, 0.9].map((h, i) => (
        <rect key={i} x={12 + i * 38} y={64 - h * 56} width="24" height={h * 56} rx="4" style={{ ["--i" as string]: i }} />
      ))}
      <line x1="4" x2="196" y1="64.5" y2="64.5" />
    </svg>
  );
}

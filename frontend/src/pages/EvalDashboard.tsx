import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { parseAnswerEval, parseRetrievalEval, type AnswerEval, type RetrievalEval } from "../api/evals";
import { AnswerEvalCard, EvalEmpty, RetrievalEvalCard } from "../components/eval/EvalCards";
import "../components/eval/eval.css";
import { IconRetry } from "../components/icons";
import { TopBar } from "../components/shell/TopBar";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Feedback";

type Load<T> = { status: "loading" } | { status: "ok"; data: T | null } | { status: "error"; message: string };

/** Latest retrieval + answer eval results (lazy-loaded route). */
export default function EvalDashboard() {
  const [retrieval, setRetrieval] = useState<Load<RetrievalEval>>({ status: "loading" });
  const [answer, setAnswer] = useState<Load<AnswerEval>>({ status: "loading" });

  const load = useCallback(() => {
    setRetrieval({ status: "loading" });
    setAnswer({ status: "loading" });
    const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
    api
      .evalLatest("retrieval")
      .then((raw) => setRetrieval({ status: "ok", data: parseRetrievalEval(raw) }))
      .catch((e: unknown) => setRetrieval({ status: "error", message: msg(e) }));
    api
      .evalLatest("answer")
      .then((raw) => setAnswer({ status: "ok", data: parseAnswerEval(raw) }))
      .catch((e: unknown) => setAnswer({ status: "error", message: msg(e) }));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="page eval-page">
      <TopBar />
      <main id="main" tabIndex={-1} className="page-main">
        <header className="page-head">
          <div>
            <p className="eyebrow">Evaluation</p>
            <h1 className="page-title">How well does Verity do?</h1>
            <p className="page-lead">
              Latest results from the offline eval suite: does retrieval find the right pages, and does the answerer
              know when to stay quiet.
            </p>
          </div>
          <Button icon={<IconRetry size={15} />} onClick={load}>
            Refresh
          </Button>
        </header>
        <div className="eval-grid">
          {renderSection(retrieval, (d) => <RetrievalEvalCard data={d} />, <EvalEmpty kind="retrieval" />)}
          {renderSection(answer, (d) => <AnswerEvalCard data={d} />, <EvalEmpty kind="answer" />)}
        </div>
      </main>
    </div>
  );
}

function renderSection<T>(state: Load<T>, ok: (d: T) => JSX.Element, empty: JSX.Element) {
  if (state.status === "loading")
    return (
      <article className="eval-card">
        <Skeleton lines={6} />
      </article>
    );
  if (state.status === "error")
    return (
      <article className="eval-card eval-error" role="alert">
        <h2>Couldn't load results</h2>
        <p className="eval-explain">{state.message}</p>
      </article>
    );
  return state.data ? ok(state.data) : empty;
}

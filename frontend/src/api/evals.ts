/**
 * Eval results (GET /api/eval/latest). These are NOT part of the frozen schema contract: the
 * backend returns whatever JSON file `backend/evals/*_eval.py` last wrote, or `{}`. So instead of
 * trusting a type, we parse the unknown JSON defensively into the shapes the dashboard needs.
 *
 * Shapes written today (see backend/evals/retrieval_eval.py and answer_eval.py):
 *   retrieval: { label, kind, n_questions, "recall@1", "recall@3", "recall@5", mrr, created_at }
 *   answer:    { label, kind, n_questions, abstention_accuracy: { answerable, should_abstain }, created_at }
 */

export interface RetrievalEval {
  label: string;
  nQuestions: number;
  /** recall@k for each k found in the file, sorted by k */
  recall: { k: number; value: number }[];
  mrr: number | null;
  createdAt: string | null;
}

export interface AnswerEval {
  label: string;
  nQuestions: number;
  /** null when that bucket had no questions */
  abstention: { answerable: number | null; shouldAbstain: number | null };
  createdAt: string | null;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** `{}` (no results yet) and anything unrecognisable both become `null`. */
export function parseRetrievalEval(raw: unknown): RetrievalEval | null {
  if (!isObj(raw) || Object.keys(raw).length === 0) return null;
  const recall = Object.entries(raw)
    .map(([key, value]) => {
      const m = /^recall@(\d+)$/.exec(key);
      const v = num(value);
      return m && v !== null ? { k: Number(m[1]), value: v } : null;
    })
    .filter((x): x is { k: number; value: number } => x !== null)
    .sort((a, b) => a.k - b.k);
  const mrr = num(raw.mrr);
  if (recall.length === 0 && mrr === null) return null;
  return {
    label: str(raw.label) ?? "unnamed",
    nQuestions: num(raw.n_questions) ?? 0,
    recall,
    mrr,
    createdAt: str(raw.created_at),
  };
}

export function parseAnswerEval(raw: unknown): AnswerEval | null {
  if (!isObj(raw) || Object.keys(raw).length === 0) return null;
  const acc = raw.abstention_accuracy;
  if (!isObj(acc)) return null;
  return {
    label: str(raw.label) ?? "unnamed",
    nQuestions: num(raw.n_questions) ?? 0,
    abstention: { answerable: num(acc.answerable), shouldAbstain: num(acc.should_abstain) },
    createdAt: str(raw.created_at),
  };
}

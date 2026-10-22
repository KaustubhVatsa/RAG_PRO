import type { AnswerEval, RetrievalEval } from "../api/evals";
import type { Answer, Chunk, Citation, Claim, ScoredChunk } from "../api/types";
import type { Turn } from "../state/chat";

/**
 * Hand-written sample data for the Design Lab, shaped exactly like the API types so every
 * component can be reviewed in every state without a backend. Text is based on the demo fixture
 * ("Attention Is All You Need").
 */

const DOC = "demo-attention";

export const CHUNKS: Chunk[] = [
  {
    id: `${DOC}:4`,
    doc_id: DOC,
    ord: 4,
    page: 5,
    section: "3.2.2 Multi-Head Attention",
    text: "Instead of a single attention function with d_model-dimensional keys, values and queries, the model linearly projects them h times with different learned projections and attends in parallel. The base model uses h=8 parallel attention heads. For each head the dimensions are d_k = d_v = d_model/h = 64.",
  },
  {
    id: `${DOC}:3`,
    doc_id: DOC,
    ord: 3,
    page: 4,
    section: "3.2.1 Scaled Dot-Product Attention",
    text: "Attention computes the dot product of a query with all keys, divides each result by the square root of d_k, and applies a softmax to obtain weights on the values. The scaling matters because for large d_k the dot products grow large in magnitude, pushing the softmax into regions where gradients are extremely small.",
  },
  {
    id: `${DOC}:0`,
    doc_id: DOC,
    ord: 0,
    page: 1,
    section: "Abstract",
    text: "The Transformer is a sequence transduction model based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show the model is superior in quality while being more parallelizable and requiring significantly less time to train.",
  },
  {
    id: `${DOC}:7`,
    doc_id: DOC,
    ord: 7,
    page: 7,
    section: "4 Why Self-Attention",
    text: "Self-attention is compared with recurrent and convolutional layers on three criteria: computational complexity per layer, the amount of computation that can be parallelized, and the path length between long-range dependencies.",
  },
];

export const RETRIEVED: ScoredChunk[] = [
  { chunk: CHUNKS[0], score: 0.912, source: "rerank" },
  { chunk: CHUNKS[1], score: 0.774, source: "hybrid" },
  { chunk: CHUNKS[2], score: 0.52, source: "vector" },
  { chunk: CHUNKS[3], score: 0.31, source: "bm25" },
];

const cite = (n: number, chunk: Chunk, quote: string, verified: boolean | null): Citation => ({
  n,
  chunk_id: chunk.id,
  doc_id: chunk.doc_id,
  page: chunk.page,
  quote,
  verified,
});

export const C_VERIFIED = cite(1, CHUNKS[0], "The base model uses h=8 parallel attention heads.", true);
export const C_VERIFIED_2 = cite(2, CHUNKS[1], "divides each result by the square root of d_k", true);
export const C_FLAGGED = cite(3, CHUNKS[2], CHUNKS[2].text.slice(0, 120), false);
export const C_NONE = cite(4, CHUNKS[3], CHUNKS[3].text.slice(0, 120), null);

export const ANSWER_TEXT =
  "Multi-head attention runs several attention functions **in parallel** instead of one [1]. " +
  "Each head scales its dot products by the square root of *d_k* before the softmax [2]. " +
  "The paper reports training on a billion sentence pairs [3]. " +
  "It also states that recurrence is used in the decoder [4].\n\n" +
  "In short:\n" +
  "- `h = 8` heads in the base model [1]\n" +
  "- each head works in a smaller subspace (d_k = 64) [1]";

export const CLAIMS: Claim[] = [
  {
    text: "Multi-head attention runs several attention functions **in parallel** instead of one [1].",
    status: "supported",
    evidence: [C_VERIFIED],
    note: "Passage [1] describes h parallel projections attended in parallel.",
  },
  {
    text: "Each head scales its dot products by the square root of *d_k* before the softmax [2].",
    status: "unverified",
    evidence: [C_VERIFIED_2],
    note: null,
  },
  {
    text: "The paper reports training on a billion sentence pairs [3].",
    status: "unsupported",
    evidence: [C_FLAGGED],
    note: "a cited quote was not found verbatim in the source",
  },
  {
    text: "It also states that recurrence is used in the decoder [4].",
    status: "contradicted",
    evidence: [C_NONE],
    note: "The abstract says the model dispenses with recurrence entirely.",
  },
];

export const ANSWER: Answer = {
  text: ANSWER_TEXT,
  citations: [C_VERIFIED, C_VERIFIED_2, C_FLAGGED, C_NONE],
  claims: CLAIMS,
  abstained: false,
  abstain_reason: null,
  confidence: 0.82,
  mode: "answer",
};

const base: Omit<Turn, "status" | "raw" | "answer"> = {
  id: "lab",
  question: "How does multi-head attention work?",
  mode: "answer",
  docIds: [DOC],
  retrieved: RETRIEVED,
  claims: null,
  error: null,
};

export const TURN_DONE: Turn = { ...base, id: "lab-done", status: "done", raw: ANSWER_TEXT, answer: ANSWER, claims: CLAIMS };

export const TURN_NO_CONFIDENCE: Turn = {
  ...base,
  id: "lab-noconf",
  status: "done",
  raw: "",
  answer: {
    ...ANSWER,
    text: "The base model uses eight attention heads [1], each working in a 64-dimensional subspace [1].",
    citations: [C_VERIFIED],
    claims: [
      { text: "The base model uses eight attention heads [1], each working in a 64-dimensional subspace [1].", status: "unverified", evidence: [C_VERIFIED], note: null },
    ],
    confidence: null,
  },
};

export const TURN_FACTCHECK: Turn = {
  ...base,
  id: "lab-fc",
  mode: "factcheck",
  question: "The Transformer relies on recurrence.",
  status: "done",
  raw: "",
  answer: {
    text: "CONTRADICTED: The Transformer dispenses with recurrence and convolutions entirely [1].",
    citations: [cite(1, CHUNKS[2], "dispensing with recurrence and convolutions entirely", true)],
    claims: [
      {
        text: "The Transformer dispenses with recurrence and convolutions entirely [1].",
        status: "supported",
        evidence: [cite(1, CHUNKS[2], "dispensing with recurrence and convolutions entirely", true)],
        note: null,
      },
    ],
    abstained: false,
    abstain_reason: null,
    confidence: 0.64,
    mode: "factcheck",
  },
};

export const TURN_ABSTAIN: Turn = {
  ...base,
  id: "lab-abstain",
  question: "What GPU did the authors use for the ablation on image data?",
  status: "done",
  raw: "",
  retrieved: [],
  answer: {
    text: "I can't find this in the provided document(s).",
    citations: [],
    claims: [],
    abstained: true,
    abstain_reason: "no relevant passages retrieved",
    confidence: null,
    mode: "answer",
  },
};

export const TURN_STREAMING: Turn = {
  ...base,
  id: "lab-stream",
  status: "streaming",
  raw: "Multi-head attention runs several attention functions **in parallel** [1]. Each head scales its dot products by",
  answer: null,
};

export const TURN_RETRIEVING: Turn = { ...base, id: "lab-retr", status: "retrieving", raw: "", retrieved: null, answer: null };

export const TURN_ERROR: Turn = {
  ...base,
  id: "lab-err",
  status: "error",
  raw: "",
  answer: null,
  error: "Can't reach the Verity backend. Is it running on :8000?",
};

export const TURN_STOPPED: Turn = {
  ...base,
  id: "lab-stop",
  status: "stopped",
  raw: "Multi-head attention runs several attention functions in parallel [1]. Each head",
  answer: null,
};

export const RETRIEVAL_EVAL: RetrievalEval = {
  label: "hybrid+rerank",
  nQuestions: 24,
  recall: [
    { k: 1, value: 0.625 },
    { k: 3, value: 0.833 },
    { k: 5, value: 0.917 },
  ],
  mrr: 0.734,
  createdAt: "2026-10-20T14:32:00Z",
};

export const ANSWER_EVAL: AnswerEval = {
  label: "quote-check",
  nQuestions: 32,
  abstention: { answerable: 0.917, shouldAbstain: 0.75 },
  createdAt: "2026-10-20T14:40:00Z",
};

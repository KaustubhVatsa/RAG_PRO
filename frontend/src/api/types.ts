// Mirrors backend/app/core/schemas.py and contracts/openapi.yaml. Keep in sync.

export type DocStatus = "processing" | "ready" | "failed";
export type ChatMode = "answer" | "teacher" | "factcheck";
export type ClaimStatus = "supported" | "unsupported" | "contradicted" | "unverified";

export interface Document {
  id: string;
  title: string;
  filename: string;
  status: DocStatus;
  n_pages: number;
  n_chunks: number;
  error: string | null;
  created_at: string;
}

export interface Chunk {
  id: string;
  doc_id: string;
  ord: number;
  page: number;
  section: string | null;
  text: string;
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
  source: "vector" | "bm25" | "hybrid" | "rerank";
}

export interface Citation {
  n: number;
  chunk_id: string;
  doc_id: string;
  page: number;
  quote: string;
}

export interface Claim {
  text: string;
  status: ClaimStatus;
  evidence: Citation[];
  note: string | null;
}

export interface Answer {
  text: string;
  citations: Citation[];
  claims: Claim[];
  abstained: boolean;
  abstain_reason: string | null;
  confidence: number | null;
  mode: ChatMode;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  question: string;
  doc_ids: string[];
  mode: ChatMode;
  history: Message[];
}

export type ChatEvent =
  | { type: "retrieval"; chunks: ScoredChunk[] }
  | { type: "token"; text: string }
  | { type: "claims"; claims: Claim[] }
  | { type: "done"; answer: Answer }
  | { type: "error"; message: string };

export interface Health {
  status: string;
  store: string;
  retriever: string;
  ingestor: string;
  llm_provider: string;
}

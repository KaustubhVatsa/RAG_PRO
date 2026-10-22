/** What the Source tab should show: a page of a document, optionally with a quote to highlight. */
export interface SourceTarget {
  docId: string;
  page: number;
  chunkId: string | null;
  quote: string | null;
  /** Citation.verified of the citation that opened it (undefined when opened from a passage). */
  verified?: boolean | null;
  /** The [n] marker, when opened from a citation. */
  n?: number;
}

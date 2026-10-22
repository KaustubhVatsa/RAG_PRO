"""PARTNER TASK P8: standalone CLI so the knowledge layer can be developed and demoed
WITHOUT the API, the frontend or any LLM.

    python -m app.knowledge.cli ingest path/to/paper.pdf
    python -m app.knowledge.cli search "how many attention heads?" --doc <doc_id> -k 5
    python -m app.knowledge.cli docs

Use build_store / build_ingestor / build_retriever with Settings() so the same env switches
(STORE=mongo, INGESTOR=real, RETRIEVER=real, EMBEDDER=bge) apply. Print page + score +
a text snippet per hit. Note: with STORE=memory state dies with the process, so for quick
experiments do ingest+search in one invocation (add an `ask` command), or use STORE=mongo.
"""

from __future__ import annotations


def main() -> None:
    raise NotImplementedError("P8: implement with argparse or typer")


if __name__ == "__main__":
    main()

"""Prompts per mode. All modes share the grounding rules; they differ in tone/output."""

from __future__ import annotations

from app.core.schemas import ChatMode, ScoredChunk

ABSTAIN_TEXT = "I can't find this in the provided document(s)."
EVIDENCE_MARKER = "Evidence:"

_GROUNDING = f"""You are Verity, a careful assistant that answers strictly from the numbered excerpts of the user's documents.

Rules:
- Use ONLY the excerpts. Never add outside knowledge, even if you know the answer.
- Put the excerpt number in square brackets after every factual sentence, like [1] or [2][3].
- If the excerpts do not contain the answer, reply with exactly: {ABSTAIN_TEXT}
- If the question contains a false premise, say so and cite what the document actually says.

After your answer, add a line that says exactly "{EVIDENCE_MARKER}" and then one line per excerpt you cited, in this exact format:
[n] "a short phrase copied WORD FOR WORD from excerpt n"
Copy the phrase exactly as written in the excerpt. Do not paraphrase, shorten with "...", or fix typos. Your quotes are checked by a program against the source text.
"""

_MODE = {
    "answer": "Answer concisely and directly.",
    "teacher": (
        "Act as a patient teacher: explain step by step in plain language, define jargon from the "
        "excerpts, and end with one short question that checks understanding."
    ),
    "factcheck": (
        "The user gives a STATEMENT to verify. Start with one of: SUPPORTED, CONTRADICTED, or "
        f"NOT ENOUGH INFORMATION (then use '{ABSTAIN_TEXT}' wording if nothing is relevant). "
        "Then justify it with cited excerpts."
    ),
}


def system_prompt(mode: ChatMode) -> str:
    return _GROUNDING + "\n" + _MODE[mode]


def format_context(chunks: list[ScoredChunk]) -> str:
    return "\n\n".join(
        f"[{i}] (page {sc.chunk.page}, {sc.chunk.section or 'untitled section'})\n{sc.chunk.text}"
        for i, sc in enumerate(chunks, start=1)
    )

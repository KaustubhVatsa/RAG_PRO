# Learning note 01: quote-then-answer and the verbatim check (R2)

## The problem
An LLM that is told "answer from the excerpts and cite [1]" can still cite [1] and say something
the excerpt never said. A citation *marker* proves nothing; it's just text the model wrote.

## The idea
Make the model also **copy an exact phrase** from the excerpt it cites ("quote-then-answer"),
then check the phrase with ordinary code:

```
answer text with [n] markers
Evidence:
[1] "phrase copied word for word from excerpt 1"      <- we test: is this inside chunk 1?
```

Why this works: copying is easy for a model that read the text, and hard to fake when the text
doesn't say it. And the check is **deterministic**: plain string matching can't hallucinate,
costs nothing, and runs in microseconds. An LLM judge (R3) is slower, costs quota, and can be wrong too.
That's the layering principle for this project: cheap exact checks first, expensive fuzzy checks second.

## What we built (read in this order)
| file | what to notice |
|---|---|
| `reasoning/prompts.py` | the rule telling the model to emit an `Evidence:` block, and why ("checked by a program") |
| `reasoning/citations.py` | `split_evidence` → `normalize` → `quote_in_chunk` → `build_citations` |
| `reasoning/verifier.py` | a claim whose quote failed becomes `unsupported`, no LLM involved |
| `core/schemas.py` | `Citation.verified`: `True` / `False` / `None` (three states, on purpose) |
| `tests/test_quote_check.py` | a `LyingLLM` that cites a real chunk with a made-up quote |

## Concepts to be able to explain
1. **Marker vs evidence.** `[1]` says *where*; the quote proves *what*.
2. **Normalisation.** PDFs contain ligatures (`ﬁ`), curly quotes, odd dashes, line breaks. Without
   `normalize()` we'd call faithful quotes "fabricated" (a false alarm). With too much normalisation we
   might accept things we shouldn't. This is a precision/recall trade-off, so pick it deliberately.
3. **Strict vs fuzzy matching.** We use exact substring on purpose: a paraphrase is *not* a quote. The
   cost: a model that slightly misquotes gets flagged even when its claim is right. Measure it (below).
4. **Three-state result.** `None` ("no quote given") is different from `False` ("quote given and wrong").
   Collapsing them would punish models that forgot the format as if they had lied.
5. **Contract change.** Adding `verified` touched `schemas.py`, `types.ts`, `openapi.yaml`, all kept in
   sync. It's an *optional* field, so the partner's code is unaffected. That's what a safe contract change looks like.
6. **Defence in depth.** Invented markers like `[9]` are dropped in `build_citations`, fabricated quotes are
   flagged, and a missing Evidence block degrades gracefully instead of crashing.

## Try it
```bash
make test                       # test_quote_check.py: watch the LyingLLM get caught
cd backend && .venv/bin/python -c "
from app.reasoning.citations import quote_in_chunk
chunk = 'The base model uses h=8 parallel attention heads.'
print(quote_in_chunk('uses h=8 parallel attention heads', chunk))     # True
print(quote_in_chunk('employs eight attention heads', chunk))         # False: paraphrase
"
```

## Exercises (do these yourself; they are the learning)
1. **Break the normaliser.** Add a failing test with a hyphenated line break (`atten-\ntion`) that a PDF
   would produce. Make `normalize` handle it. What new false positives could your fix allow?
2. **Fuzzy fallback.** Add `quote_in_chunk_fuzzy` using `difflib.SequenceMatcher` (accept ratio ≥ 0.9 over the
   best-matching window). Which of the test cases flip? When you have real LLM outputs (R1), count how many
   `False` verdicts become `True`. That count is your first *measured* ablation row.
3. **Think:** a model could copy a real quote that is true but irrelevant to its claim. What would catch
   that? (Hint: that's exactly what the claim verifier in R3 is for.)

## Interview one-liner
"Citations markers are unverifiable, so we make the model quote its evidence and verify the quote
deterministically against the source chunk; failures mark the claim unsupported before any LLM judge runs."

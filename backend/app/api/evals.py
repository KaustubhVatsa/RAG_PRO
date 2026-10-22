from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/eval")
RESULTS_DIR = Path(__file__).resolve().parents[2] / "evals" / "results"


@router.get("/latest")
def latest(kind: str = "retrieval") -> dict:
    """Newest eval result file of a kind ('retrieval' | 'answer'), for the dashboard page.
    Returns {} when none exists yet."""
    files = sorted(RESULTS_DIR.glob(f"{kind}_*.json"))
    return json.loads(files[-1].read_text()) if files else {}

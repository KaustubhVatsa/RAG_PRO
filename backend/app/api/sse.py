from __future__ import annotations

from collections.abc import Iterable, Iterator

from app.core.schemas import ChatEvent, ErrorEvent


def sse(events: Iterable[ChatEvent]) -> Iterator[str]:
    """Server-Sent Events framing: `event: <type>` + `data: <json>` + blank line."""
    try:
        for ev in events:
            yield f"event: {ev.type}\ndata: {ev.model_dump_json()}\n\n"
    except Exception as exc:  # surface failures to the client instead of a dead stream
        err = ErrorEvent(message=f"{type(exc).__name__}: {exc}")
        yield f"event: error\ndata: {err.model_dump_json()}\n\n"

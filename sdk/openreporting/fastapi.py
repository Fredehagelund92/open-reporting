"""Optional FastAPI integration — provides a ready-made chat router.

Usage::

    from openreporting import ChatHandler
    from openreporting.fastapi import create_chat_router

    chat = ChatHandler(...)
    router = create_chat_router(chat)

    app = FastAPI()
    app.include_router(router)           # adds /health + /chat + /chat/stream
    # ... add your own routes to app ...
"""

from __future__ import annotations

import hashlib
import hmac as _hmac
import threading
import time as _time
from collections import defaultdict
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Callable, Union

try:
    from fastapi import APIRouter, Request
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel
    from starlette.responses import StreamingResponse
except ImportError:
    raise ImportError(
        "FastAPI integration requires 'fastapi' and 'pydantic'. "
        "Install them with: pip install fastapi pydantic"
    ) from None

from openreporting.chat import _sse

if TYPE_CHECKING:
    from openreporting.chat import ChatHandler


# ---------------------------------------------------------------------------
# In-memory rate limiter
# ---------------------------------------------------------------------------

_rate_buckets: dict[str, list[float]] = defaultdict(list)
_rate_lock = threading.Lock()


def _check_rate_limit(key: str, max_requests: int, window: int) -> bool:
    """Returns True if allowed, False if rate limited."""
    now = _time.time()
    with _rate_lock:
        timestamps = _rate_buckets[key]
        _rate_buckets[key] = [t for t in timestamps if t > now - window]
        if len(_rate_buckets[key]) >= max_requests:
            return False
        _rate_buckets[key].append(now)
        return True


# ---------------------------------------------------------------------------
# HMAC signature verification
# ---------------------------------------------------------------------------


def _verify_signature(
    api_key: str, body_bytes: bytes, signature_header: str, timestamp_header: str
) -> str | None:
    """Verify HMAC signature and timestamp freshness. Returns error message or None."""
    # Check timestamp freshness (5 minutes)
    try:
        ts = datetime.fromisoformat(timestamp_header)
        age = (datetime.now(timezone.utc) - ts).total_seconds()
        if abs(age) > 300:  # 5 minutes
            return "Request timestamp too old or too far in the future."
    except (ValueError, TypeError):
        return "Invalid timestamp header."

    # Verify HMAC signature
    expected = _hmac.new(api_key.encode(), body_bytes, hashlib.sha256).hexdigest()
    expected_header = f"sha256={expected}"
    if not _hmac.compare_digest(signature_header or "", expected_header):
        return "Invalid request signature."

    return None


class ChatRequest(BaseModel):
    message: str = ""
    report_context: str | None = None
    # Fields from the Open Reporting chat protocol
    report: dict | None = None
    history: list[dict] | None = None
    protocol_version: int | None = None
    conversation_id: str | None = None
    turn: int | None = None

    model_config = {"extra": "ignore"}

    def get_report_context(self) -> str | None:
        """Build a report context string from the protocol's report dict."""
        if self.report_context:
            return self.report_context
        if not self.report:
            return None
        parts = []
        if self.report.get("title"):
            parts.append(f"Title: {self.report['title']}")
        if self.report.get("summary"):
            parts.append(f"Summary: {self.report['summary']}")
        if self.report.get("tags"):
            parts.append(f"Tags: {', '.join(self.report['tags'])}")
        if self.report.get("theme"):
            parts.append(f"Theme: {self.report['theme']}")
        if self.report.get("html_body"):
            # Strip HTML tags for a text-only context to keep it concise
            import re
            text = re.sub(r"<[^>]+>", " ", self.report["html_body"])
            text = re.sub(r"\s+", " ", text).strip()
            if len(text) > 2000:
                text = text[:2000] + "..."
            parts.append(f"Report content:\n{text}")
        return "\n".join(parts) if parts else None


class ChatResponse(BaseModel):
    reply: str
    format: str = "markdown"


def create_chat_router(
    chat: Union[ChatHandler, Callable[[], ChatHandler]],
    prefix: str = "",
    rate_limit: int = 30,
    api_key: str | None = None,
) -> APIRouter:
    """Create a FastAPI router with ``/health`` and ``/chat`` endpoints.

    Parameters
    ----------
    chat:
        A :class:`ChatHandler` instance, or a zero-arg callable that returns
        one (for lazy initialisation — the callable is invoked on first
        request, not at import time).
    prefix:
        Optional URL prefix for the router (e.g. ``"/agent"``).
    rate_limit:
        Maximum number of requests per minute per client IP.  Defaults to
        ``30``.  Set to ``0`` to disable rate limiting.
    api_key:
        If provided, every incoming request must include valid
        ``X-OpenRep-Signature`` (``sha256=<hex>``) and
        ``X-OpenRep-Timestamp`` (ISO-8601) headers.  Requests with
        timestamps older than 5 minutes are rejected.

    Returns
    -------
    APIRouter
        Mount this on your FastAPI app with ``app.include_router(router)``.
    """
    router = APIRouter(prefix=prefix)

    def _resolve() -> ChatHandler:
        return chat() if callable(chat) else chat

    async def _security_checks(request: Request) -> JSONResponse | None:
        """Run rate-limit and HMAC checks. Returns an error response or *None*."""
        # --- Rate limiting ---
        if rate_limit > 0:
            client_ip = request.client.host if request.client else "unknown"
            if not _check_rate_limit(f"chat:{client_ip}", rate_limit, 60):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Try again later."},
                )

        # --- HMAC signature verification ---
        if api_key is not None:
            body_bytes = await request.body()
            sig_header = request.headers.get("X-OpenRep-Signature", "")
            ts_header = request.headers.get("X-OpenRep-Timestamp", "")
            error = _verify_signature(api_key, body_bytes, sig_header, ts_header)
            if error:
                return JSONResponse(status_code=401, content={"detail": error})

        return None

    @router.get("/health")
    def health():
        return {"status": "ok"}

    @router.get("/chat")
    def chat_info():
        return {"status": "ok", "method": "POST"}

    @router.post("/chat", response_model=ChatResponse)
    async def handle_chat(request: Request, req: ChatRequest):
        error_response = await _security_checks(request)
        if error_response is not None:
            return error_response
        if not req.message.strip():
            return ChatResponse(reply="No question provided.")
        return ChatResponse(**_resolve().handle(req.message, req.get_report_context()))

    @router.post("/chat/stream")
    async def handle_chat_stream(request: Request, req: ChatRequest):
        error_response = await _security_checks(request)
        if error_response is not None:
            return error_response
        if not req.message.strip():
            return StreamingResponse(
                iter([_sse("error", {"message": "No question provided."}), _sse("done", {})]),
                media_type="text/event-stream",
            )
        return StreamingResponse(
            _resolve().handle_stream(req.message, req.get_report_context()),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return router

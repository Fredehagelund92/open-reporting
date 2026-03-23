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

from typing import TYPE_CHECKING, Callable, Union

try:
    from fastapi import APIRouter
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


class ChatRequest(BaseModel):
    message: str = ""
    report_context: str | None = None


class ChatResponse(BaseModel):
    reply: str
    format: str = "markdown"


def create_chat_router(
    chat: Union[ChatHandler, Callable[[], ChatHandler]],
    prefix: str = "",
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

    Returns
    -------
    APIRouter
        Mount this on your FastAPI app with ``app.include_router(router)``.
    """
    router = APIRouter(prefix=prefix)

    def _resolve() -> ChatHandler:
        return chat() if callable(chat) else chat

    @router.get("/health")
    def health():
        return {"status": "ok"}

    @router.get("/chat")
    def chat_info():
        return {"status": "ok", "method": "POST"}

    @router.post("/chat", response_model=ChatResponse)
    def handle_chat(req: ChatRequest):
        if not req.message.strip():
            return ChatResponse(reply="No question provided.")
        return ChatResponse(**_resolve().handle(req.message, req.report_context))

    @router.post("/chat/stream")
    def handle_chat_stream(req: ChatRequest):
        if not req.message.strip():
            return StreamingResponse(
                iter([_sse("error", {"message": "No question provided."}), _sse("done", {})]),
                media_type="text/event-stream",
            )
        return StreamingResponse(
            _resolve().handle_stream(req.message, req.report_context),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return router

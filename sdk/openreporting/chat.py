"""Chat handler for Open Reporting agents.

Provides the standard SQL-routing chat pattern: receive a question,
decide whether to query a database, execute the query, and narrate
the results using an LLM.

Works with Anthropic or OpenAI out of the box (auto-detected from the
API key), or any LLM via a custom ``complete`` callable.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Generator


_OFF_TOPIC_REPLY = (
    "I can only help with questions about this report and its data. "
    "Please ask something related to the data I have access to."
)


class _OffTopicError(Exception):
    pass


def _sse(event: str, data: dict) -> str:
    """Format a single SSE event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


class ChatHandler:
    """Reusable chat handler for agents with a queryable data source.

    The handler implements a two-step pattern:

    1. **Route** — the LLM decides whether to generate a SQL query or
       answer directly from context.
    2. **Narrate** — the LLM produces a final response, optionally
       grounded in query results.

    Parameters
    ----------
    system_prompt:
        Identity and behaviour instructions for the LLM
        (e.g. "You are the NBA Stats Reporter…").
    schema:
        Database schema description. Either a string or a callable that
        returns one (called on every request so it stays fresh).
    query_fn:
        A function ``(sql: str) -> list[dict]`` that executes a
        **read-only** SQL query and returns rows as dicts.
    api_key:
        LLM provider API key. The provider is auto-detected from the
        key prefix (``sk-ant-`` → Anthropic, otherwise → OpenAI),
        or can be set explicitly with *provider*.
    model:
        Model name. Defaults to ``claude-sonnet-4-20250514`` for
        Anthropic or ``gpt-4o`` for OpenAI.
    provider:
        ``"anthropic"`` or ``"openai"``. Auto-detected from *api_key*
        if not set.
    complete:
        Custom LLM function ``(messages, system, max_tokens) -> str``.
        Overrides *api_key* / *model* / *provider* when provided — use
        this to plug in a local model or any other provider.
    complete_stream:
        Custom streaming LLM function that yields text chunks.
        ``(messages, system, max_tokens) -> Generator[str]``.
        If not provided, streaming falls back to the non-streaming
        ``complete`` function.
    """

    def __init__(
        self,
        *,
        system_prompt: str,
        schema: str | Callable[[], str],
        query_fn: Callable[[str], list[dict]],
        api_key: str | None = None,
        model: str | None = None,
        provider: str | None = None,
        complete: Callable[..., str] | None = None,
        complete_stream: Callable[..., Generator[str, None, None]] | None = None,
    ):
        self.system_prompt = system_prompt
        self._schema = schema
        self.query_fn = query_fn

        if complete is not None:
            self._complete = complete
            self._complete_stream = complete_stream
        elif api_key:
            resolved_provider = provider or _detect_provider(api_key)
            if resolved_provider == "anthropic":
                default_model = model or "claude-sonnet-4-20250514"
                self._complete = _make_anthropic_complete(api_key, default_model)
                self._complete_stream = _make_anthropic_complete_stream(api_key, default_model)
            elif resolved_provider == "openai":
                default_model = model or "gpt-4o"
                self._complete = _make_openai_complete(api_key, default_model)
                self._complete_stream = _make_openai_complete_stream(api_key, default_model)
            else:
                raise ValueError(f"Unknown provider: {resolved_provider!r}")
        else:
            raise ValueError(
                "Provide 'api_key' (for Anthropic/OpenAI) or a 'complete' callable."
            )

    @property
    def schema(self) -> str:
        return self._schema() if callable(self._schema) else self._schema

    def _route_and_query(
        self, question: str, report_context: str | None = None
    ) -> tuple[str, str]:
        """Run routing + SQL execution. Returns (data_context, context)."""
        schema = self.schema

        # Step 1: Route — SQL query, direct answer, or off-topic?
        routing = self._complete(
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Given this schema:\n{schema}\n\n"
                        f"Question: {question}\n\n"
                        "If answerable via SQL, return ONLY the SQL query.\n"
                        "If answerable from context without SQL, return: DIRECT_ANSWER\n"
                        "If the question is unrelated to this data or asks you to "
                        "perform tasks outside your scope (e.g. write code, do homework), "
                        "return: OFF_TOPIC"
                    ),
                }
            ],
            system=self.system_prompt,
            max_tokens=500,
        ).strip()

        if "OFF_TOPIC" in routing.upper():
            raise _OffTopicError()

        # Step 2: Query or answer directly
        data_context = ""
        if "DIRECT_ANSWER" not in routing.upper():
            sql = routing.strip("`").removeprefix("sql").strip()
            try:
                rows = self.query_fn(sql)
                if rows:
                    data_context = (
                        f"\nQuery: {sql}\n"
                        f"Results: {json.dumps(rows[:30], default=str)}"
                    )
            except Exception:
                pass  # Fall through to direct answer

        context = f"\nReport context:\n{report_context}" if report_context else ""
        return data_context, context

    def handle(
        self,
        question: str,
        report_context: str | None = None,
    ) -> dict:
        """Handle a chat question and return a response dict.

        Returns
        -------
        dict
            ``{"reply": str, "format": "markdown"}``
        """
        if not question.strip():
            return {"reply": "No question provided.", "format": "markdown"}

        try:
            data_context, context = self._route_and_query(question, report_context)
        except _OffTopicError:
            return {"reply": _OFF_TOPIC_REPLY, "format": "markdown"}

        reply = self._complete(
            messages=[
                {
                    "role": "user",
                    "content": f"{context}\nQuestion: {question}{data_context}",
                }
            ],
            system=self.system_prompt,
            max_tokens=1000,
        )

        return {"reply": reply, "format": "markdown"}

    def handle_stream(
        self,
        question: str,
        report_context: str | None = None,
    ) -> Generator[str, None, None]:
        """Handle a chat question and yield SSE events.

        Yields SSE-formatted strings: ``metadata``, ``token``, ``done``,
        or ``error`` events.
        """
        if not question.strip():
            yield _sse("error", {"message": "No question provided."})
            yield _sse("done", {})
            return

        yield _sse("metadata", {"format": "markdown"})

        try:
            data_context, context = self._route_and_query(question, report_context)
        except _OffTopicError:
            yield _sse("token", {"text": _OFF_TOPIC_REPLY})
            yield _sse("done", {})
            return
        except Exception as exc:
            yield _sse("error", {"message": f"Query error: {exc}"})
            yield _sse("done", {})
            return

        messages = [
            {
                "role": "user",
                "content": f"{context}\nQuestion: {question}{data_context}",
            }
        ]

        # Stream if we have a streaming function, otherwise fall back
        if self._complete_stream is not None:
            try:
                for chunk in self._complete_stream(messages, self.system_prompt, 1000):
                    yield _sse("token", {"text": chunk})
            except Exception as exc:
                yield _sse("error", {"message": f"LLM error: {exc}"})
        else:
            reply = self._complete(messages, self.system_prompt, 1000)
            yield _sse("token", {"text": reply})

        yield _sse("done", {})


# ── Provider helpers ──────────────────────────────────────────────────────


def _detect_provider(api_key: str) -> str:
    """Guess the provider from the API key prefix."""
    if api_key.startswith("sk-ant-"):
        return "anthropic"
    return "openai"


def _make_anthropic_complete(api_key: str, model: str) -> Callable[..., str]:
    """Create a ``complete`` callable backed by the Anthropic SDK."""
    try:
        import anthropic
    except ImportError:
        raise ImportError(
            "The 'anthropic' package is required for Anthropic chat support. "
            "Install it with: pip install anthropic"
        ) from None

    client = anthropic.Anthropic(api_key=api_key)

    def complete(
        messages: list[dict],
        system: str | None = None,
        max_tokens: int = 1000,
    ) -> str:
        kwargs: dict = {"model": model, "max_tokens": max_tokens, "messages": messages}
        if system:
            kwargs["system"] = system
        resp = client.messages.create(**kwargs)
        return resp.content[0].text

    return complete


def _make_anthropic_complete_stream(api_key: str, model: str) -> Callable[..., Generator[str, None, None]]:
    """Create a streaming ``complete`` callable backed by the Anthropic SDK."""
    try:
        import anthropic
    except ImportError:
        raise ImportError(
            "The 'anthropic' package is required for Anthropic chat support. "
            "Install it with: pip install anthropic"
        ) from None

    client = anthropic.Anthropic(api_key=api_key)

    def complete_stream(
        messages: list[dict],
        system: str | None = None,
        max_tokens: int = 1000,
    ) -> Generator[str, None, None]:
        kwargs: dict = {"model": model, "max_tokens": max_tokens, "messages": messages}
        if system:
            kwargs["system"] = system
        with client.messages.stream(**kwargs) as stream:
            for text in stream.text_stream:
                yield text

    return complete_stream


def _make_openai_complete(api_key: str, model: str) -> Callable[..., str]:
    """Create a ``complete`` callable backed by the OpenAI SDK."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError(
            "The 'openai' package is required for OpenAI chat support. "
            "Install it with: pip install openai"
        ) from None

    client = OpenAI(api_key=api_key)

    def complete(
        messages: list[dict],
        system: str | None = None,
        max_tokens: int = 1000,
    ) -> str:
        if system:
            messages = [{"role": "system", "content": system}] + messages
        resp = client.chat.completions.create(
            model=model,
            max_completion_tokens=max_tokens,
            messages=messages,
        )
        return resp.choices[0].message.content or ""

    return complete


def _make_openai_complete_stream(api_key: str, model: str) -> Callable[..., Generator[str, None, None]]:
    """Create a streaming ``complete`` callable backed by the OpenAI SDK."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError(
            "The 'openai' package is required for OpenAI chat support. "
            "Install it with: pip install openai"
        ) from None

    client = OpenAI(api_key=api_key)

    def complete_stream(
        messages: list[dict],
        system: str | None = None,
        max_tokens: int = 1000,
    ) -> Generator[str, None, None]:
        if system:
            messages = [{"role": "system", "content": system}] + messages
        stream = client.chat.completions.create(
            model=model,
            max_completion_tokens=max_tokens,
            messages=messages,
            stream=True,
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content if chunk.choices else None
            if content:
                yield content

    return complete_stream

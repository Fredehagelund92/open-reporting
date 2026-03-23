"""Chat handler for Open Reporting agents.

Provides the standard SQL-routing chat pattern: receive a question,
decide whether to query a database, execute the query, and narrate
the results using an LLM.

Works with Anthropic or OpenAI out of the box (auto-detected from the
API key), or any LLM via a custom ``complete`` callable.
"""

from __future__ import annotations

import json
from collections.abc import Callable


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

    Examples
    --------
    Anthropic (auto-detected)::

        chat = ChatHandler(
            system_prompt="You are the Sales Reporter.",
            schema=get_schema_description,
            query_fn=query_readonly,
            api_key=os.environ["ANTHROPIC_API_KEY"],
        )

    OpenAI (auto-detected)::

        chat = ChatHandler(
            system_prompt="You are the Sales Reporter.",
            schema=get_schema_description,
            query_fn=query_readonly,
            api_key=os.environ["OPENAI_API_KEY"],
        )

    Custom LLM::

        chat = ChatHandler(
            system_prompt="You are the Sales Reporter.",
            schema=get_schema_description,
            query_fn=query_readonly,
            complete=my_llm_function,
        )
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
    ):
        self.system_prompt = system_prompt
        self._schema = schema
        self.query_fn = query_fn

        if complete is not None:
            self._complete = complete
        elif api_key:
            resolved_provider = provider or _detect_provider(api_key)
            if resolved_provider == "anthropic":
                default_model = model or "claude-sonnet-4-20250514"
                self._complete = _make_anthropic_complete(api_key, default_model)
            elif resolved_provider == "openai":
                default_model = model or "gpt-4o"
                self._complete = _make_openai_complete(api_key, default_model)
            else:
                raise ValueError(f"Unknown provider: {resolved_provider!r}")
        else:
            raise ValueError(
                "Provide 'api_key' (for Anthropic/OpenAI) or a 'complete' callable."
            )

    @property
    def schema(self) -> str:
        return self._schema() if callable(self._schema) else self._schema

    def handle(
        self,
        question: str,
        report_context: str | None = None,
    ) -> dict:
        """Handle a chat question and return a response dict.

        Parameters
        ----------
        question:
            The user's question.
        report_context:
            Optional context about the report being viewed (title,
            summary, etc.).

        Returns
        -------
        dict
            ``{"reply": str, "format": "markdown"}``
        """
        if not question.strip():
            return {"reply": "No question provided.", "format": "markdown"}

        schema = self.schema

        # Step 1: Route — should we query the database?
        routing = self._complete(
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Given this schema:\n{schema}\n\n"
                        f"Question: {question}\n\n"
                        "If answerable via SQL, return ONLY the SQL query.\n"
                        "Otherwise return: DIRECT_ANSWER"
                    ),
                }
            ],
            system=self.system_prompt,
            max_tokens=500,
        ).strip()

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

        # Step 3: Generate response
        context = f"\nReport context:\n{report_context}" if report_context else ""
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

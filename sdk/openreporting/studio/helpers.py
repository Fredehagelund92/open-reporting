"""Studio helper: bridge agent classes to Studio-compatible run() functions."""
from __future__ import annotations

import asyncio
import inspect
import logging
import types
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)


def make_run(
    agent_class: type,
    factory: Callable[[], Coroutine[Any, Any, Any]],
) -> Callable[..., str]:
    """Build a Studio-compatible ``run()`` function from an agent class.

    Reads ``studio_params`` from *agent_class* (a list of
    ``(name, type_hint, default)`` tuples), appends the ``replay`` toggle,
    and returns a synchronous function whose ``inspect.signature()`` exposes
    exactly those parameters — so Studio's auto-discovery renders the correct
    form fields.

    The returned function instantiates the agent via *factory*,
    calls ``agent.analyze(context)``, and returns ``output.html``.
    """
    studio_params: list[tuple[str, type, Any]] = getattr(agent_class, "studio_params", [])

    # Build the full param list: agent params + auto-injected toggle
    all_params = list(studio_params) + [
        ("replay", bool, False),
    ]

    # Build Parameter objects for the signature
    parameters = []
    annotations: dict[str, type] = {}
    for name, type_hint, default in all_params:
        parameters.append(
            inspect.Parameter(
                name,
                kind=inspect.Parameter.KEYWORD_ONLY,
                default=default,
                annotation=type_hint,
            )
        )
        annotations[name] = type_hint

    sig = inspect.Signature(parameters=parameters)

    def run(**kwargs: Any) -> str:
        # Apply defaults for any params not explicitly passed
        context: dict[str, Any] = {}
        for name, type_hint, default in all_params:
            context[name] = kwargs.get(name, default)

        async def _run() -> str:
            agent = await factory()
            output = await agent.analyze(context)
            return output.html

        return asyncio.run(_run())

    # Attach signature and annotations so Studio introspection works
    run.__signature__ = sig  # type: ignore[attr-defined]
    run.__annotations__ = {**annotations, "return": str}

    return run

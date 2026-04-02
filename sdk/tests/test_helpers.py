"""Tests for openreporting.studio.helpers.make_run()."""
from __future__ import annotations

import asyncio
import inspect
import typing
from typing import Literal


def test_make_run_returns_callable():
    from openreporting.studio.helpers import make_run

    class FakeAgent:
        studio_params = []
        async def analyze(self, context):
            class Out:
                html = "<p>ok</p>"
            return Out()

    async def factory():
        return FakeAgent()

    run = make_run(FakeAgent, factory)
    assert callable(run)


def test_make_run_skip_llm_always_present():
    from openreporting.studio.helpers import make_run

    class FakeAgent:
        studio_params = []
        async def analyze(self, context):
            class Out:
                html = ""
            return Out()

    async def factory():
        return FakeAgent()

    run = make_run(FakeAgent, factory)
    sig = inspect.signature(run)
    assert "skip_llm" in sig.parameters
    assert sig.parameters["skip_llm"].default is False
    hints = typing.get_type_hints(run)
    assert hints["skip_llm"] is bool


def test_make_run_studio_params_appear_in_signature():
    from openreporting.studio.helpers import make_run

    class FakeAgent:
        studio_params = [
            ("period_start", str, "2026-01-01"),
            ("period_end", str, "2026-01-31"),
            ("period_type", Literal["monthly"], "monthly"),
        ]
        async def analyze(self, context):
            class Out:
                html = ""
            return Out()

    async def factory():
        return FakeAgent()

    run = make_run(FakeAgent, factory)
    sig = inspect.signature(run)
    params = sig.parameters

    assert "period_start" in params
    assert params["period_start"].default == "2026-01-01"
    assert "period_end" in params
    assert "period_type" in params
    assert "skip_llm" in params  # always last

    hints = typing.get_type_hints(run)
    assert hints["period_start"] is str
    origin = getattr(hints["period_type"], "__origin__", None)
    assert origin is typing.Literal
    assert hints["period_type"].__args__ == ("monthly",)


def test_make_run_passes_context_to_analyze():
    from openreporting.studio.helpers import make_run

    received = {}

    class FakeAgent:
        studio_params = [("report_date", str, "2026-01-01")]

        async def analyze(self, context):
            received.update(context)
            class Out:
                html = "<p>done</p>"
            return Out()

    async def factory():
        return FakeAgent()

    run = make_run(FakeAgent, factory)
    html = run(report_date="2026-03-01", skip_llm=True)

    assert received["report_date"] == "2026-03-01"
    assert received["skip_llm"] is True
    assert html == "<p>done</p>"


def test_make_run_skip_llm_default_false_in_context():
    from openreporting.studio.helpers import make_run

    received = {}

    class FakeAgent:
        studio_params = []

        async def analyze(self, context):
            received.update(context)
            class Out:
                html = ""
            return Out()

    async def factory():
        return FakeAgent()

    run = make_run(FakeAgent, factory)
    run()

    assert received["skip_llm"] is False


def test_make_run_no_studio_params_attr():
    """Agent with no studio_params attribute at all still works."""
    from openreporting.studio.helpers import make_run

    class BareAgent:
        async def analyze(self, context):
            class Out:
                html = "<p>bare</p>"
            return Out()

    async def factory():
        return BareAgent()

    run = make_run(BareAgent, factory)
    sig = inspect.signature(run)
    assert list(sig.parameters.keys()) == ["skip_llm"]
    assert run() == "<p>bare</p>"

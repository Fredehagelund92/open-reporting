"""Starlette application for the Studio local agent workbench."""

from __future__ import annotations

import json
import traceback
from pathlib import Path

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from starlette.routing import Route

from openreporting.studio.agent_loader import discover_agent_mtimes, discover_agents, run_agent

_UI_PATH = Path(__file__).parent / "ui.html"


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------


async def _index(request: Request) -> HTMLResponse:
    html = _UI_PATH.read_text(encoding="utf-8")
    return HTMLResponse(html)


async def _list_agents(request: Request) -> JSONResponse:
    agents_dir: str = request.app.state.agents_dir
    try:
        agents = discover_agents(agents_dir)
        return JSONResponse(agents)
    except Exception:
        return JSONResponse({"error": traceback.format_exc()}, status_code=500)


async def _agent_mtimes(request: Request) -> JSONResponse:
    agents_dir: str = request.app.state.agents_dir
    try:
        mtimes = discover_agent_mtimes(agents_dir)
        return JSONResponse(mtimes)
    except Exception:
        return JSONResponse({"error": traceback.format_exc()}, status_code=500)


async def _run_agent(request: Request) -> JSONResponse:
    body = await request.json()
    file: str = body.get("file", "")
    fn: str = body.get("fn", "run")
    params: dict = body.get("params", {})
    try:
        reports, logs, is_sample_data = run_agent(file, fn, params)
        return JSONResponse({"reports": reports, "logs": logs, "is_sample_data": is_sample_data})
    except Exception:
        return JSONResponse({"error": traceback.format_exc()})


async def _meta(request: Request) -> JSONResponse:
    """Return spaces + tags from the platform when an API key is configured."""
    api_key: str | None = request.app.state.api_key
    if not api_key:
        return JSONResponse({"connected": False, "spaces": [], "tags": []})

    try:
        from openreporting.client import OpenReportingClient

        with OpenReportingClient(api_key=api_key) as client:
            spaces = client.get_spaces()
            try:
                tags_resp = client._client.get("/tags/")
                tags_resp.raise_for_status()
                raw = tags_resp.json()
                tags = [t["name"] for t in raw if isinstance(t, dict) and "name" in t]
            except Exception:
                tags = []

        return JSONResponse({"connected": True, "spaces": spaces, "tags": tags})
    except Exception:
        return JSONResponse({"connected": False, "spaces": [], "tags": [],
                             "error": traceback.format_exc()})


async def _publish(request: Request) -> JSONResponse:
    api_key: str | None = request.app.state.api_key
    if not api_key:
        return JSONResponse(
            {"error": "No API key configured. Pass --api-key or set OPENREPORTING_API_KEY."},
            status_code=400,
        )

    body = await request.json()
    file: str = body.get("file", "")
    params: dict = body.get("params", {})
    title: str = body.get("title", "Untitled Report")
    summary: str = body.get("summary", "")
    space: str | None = body.get("space") or None
    tags_raw: str = body.get("tags", "")
    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

    # Accept html directly from client (preferred) or re-run the agent
    html: str = body.get("html", "")
    fn: str = body.get("fn", "run")
    if not html:
        try:
            reports, _ = run_agent(file, fn, params)
            html = reports[0]["html"] if reports else ""
        except Exception:
            return JSONResponse({"error": f"Agent run failed:\n{traceback.format_exc()}"})

    try:
        from openreporting.client import OpenReportingClient

        with OpenReportingClient(api_key=api_key) as client:
            report = client.publish(
                title=title,
                summary=summary,
                html=html,
                space=space,
                tags=tags,
            )
        return JSONResponse({"url": report.url or f"/reports/{report.slug}"})
    except Exception:
        return JSONResponse({"error": traceback.format_exc()})


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def create_app(agents_dir: str = ".", api_key: str | None = None) -> Starlette:
    """Create and return the Studio Starlette application."""
    app = Starlette(
        routes=[
            Route("/", _index),
            Route("/api/agents", _list_agents),
            Route("/api/agents/mtimes", _agent_mtimes),
            Route("/api/meta", _meta),
            Route("/api/run", _run_agent, methods=["POST"]),
            Route("/api/publish", _publish, methods=["POST"]),
        ]
    )
    app.state.agents_dir = agents_dir
    app.state.api_key = api_key
    return app

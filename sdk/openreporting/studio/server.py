"""Starlette application for the Studio local agent workbench."""

from __future__ import annotations

import asyncio
import json
import queue
import threading
import traceback
from pathlib import Path

# Max entries kept in the on-disk history file
_HISTORY_MAX = 50
# Entries beyond this index have their HTML stripped (size control)
_HISTORY_HTML_MAX = 5


def _history_path(agents_dir: str) -> Path:
    return Path(agents_dir) / ".studio_history.json"


def _load_history(agents_dir: str) -> list[dict]:
    p = _history_path(agents_dir)
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_history(agents_dir: str, entries: list[dict]) -> None:
    try:
        _history_path(agents_dir).write_text(
            json.dumps(entries[:_HISTORY_MAX], ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception:
        pass

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, StreamingResponse
from starlette.routing import Route

from openreporting.studio.agent_loader import (
    discover_agent_mtimes,
    discover_agents,
    get_agent_instance,
    resolve_prompt_path,
    run_agent,
    run_agent_streaming,
)

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


async def _run_agent_stream(request: Request) -> StreamingResponse:
    """POST /api/run-stream — run agent with SSE streaming logs.

    Emits server-sent events:
      event: log    data: {"line": "..."}
      event: done   data: {"reports": [...], "logs": [...], "is_sample_data": bool}
      event: error  data: {"error": "traceback..."}
    """
    body = await request.json()
    file: str = body.get("file", "")
    fn: str = body.get("fn", "run")
    params: dict = body.get("params", {})

    log_q: queue.Queue = queue.Queue()

    def _run_thread():
        run_agent_streaming(file, fn, params, log_q)

    thread = threading.Thread(target=_run_thread, daemon=True)
    thread.start()

    async def _generate():
        while True:
            # Non-blocking poll so we yield control to the event loop
            try:
                event_type, data = log_q.get_nowait()
            except queue.Empty:
                if not thread.is_alive() and log_q.empty():
                    return
                await asyncio.sleep(0.04)
                continue

            if event_type == "log":
                yield f"event: log\ndata: {json.dumps({'line': data})}\n\n"
            elif event_type == "done":
                yield f"event: done\ndata: {json.dumps(data)}\n\n"
                return
            elif event_type == "error":
                yield f"event: error\ndata: {json.dumps({'error': data})}\n\n"
                return

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
            reports, _, __ = run_agent(file, fn, params)
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


async def _sections(request: Request) -> JSONResponse:
    """GET /api/sections?file=<path>&report=<fn> — return enrichable sections for an agent."""
    file: str = request.query_params.get("file", "")
    report_fn: str = request.query_params.get("report", "")
    try:
        agent = await get_agent_instance(file, report_fn=report_fn or None)
        if agent is None:
            return JSONResponse({"sections": []})
        sections = agent.enrichable_sections()
        return JSONResponse({"sections": [s.model_dump() for s in sections]})
    except Exception:
        return JSONResponse({"error": traceback.format_exc()}, status_code=500)


async def _prompt_content(request: Request) -> JSONResponse:
    """GET /api/prompt-content?file=<path>&prompt=<filename> — read a prompt file."""
    file: str = request.query_params.get("file", "")
    prompt_filename: str = request.query_params.get("prompt", "")
    try:
        prompt_path = resolve_prompt_path(file, prompt_filename)
        if not prompt_path.exists():
            return JSONResponse({"error": f"Prompt file not found: {prompt_filename}"}, status_code=404)
        return JSONResponse({"content": prompt_path.read_text(encoding="utf-8")})
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    except Exception:
        return JSONResponse({"error": traceback.format_exc()}, status_code=500)


async def _rerun_section(request: Request) -> JSONResponse:
    """POST /api/rerun-section — re-enrich a single section with edited prompts."""
    body = await request.json()
    file: str = body.get("file", "")
    report_fn: str = body.get("report", "")
    section_name: str = body.get("section", "")
    prompt_overrides: dict = body.get("prompt_overrides", {})
    context: dict = body.get("context", {})
    try:
        agent = await get_agent_instance(file, report_fn=report_fn or None)
        if agent is None:
            return JSONResponse({"error": "Agent factory not found in module"}, status_code=400)
        payload = agent._load_enriched_snapshot(context)
        if payload is None:
            return JSONResponse({"error": "No enriched snapshot found. Run the report first."}, status_code=400)
        reports = await agent.re_enrich_section(payload, section_name, prompt_overrides)
        return JSONResponse({"reports": reports})
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    except Exception:
        return JSONResponse({"error": traceback.format_exc()}, status_code=500)


async def _save_prompt(request: Request) -> JSONResponse:
    """POST /api/save-prompt — write edited prompt text back to disk."""
    body = await request.json()
    file: str = body.get("file", "")
    prompt_filename: str = body.get("prompt", "")
    content: str = body.get("content", "")
    try:
        prompt_path = resolve_prompt_path(file, prompt_filename)
        prompt_path.write_text(content, encoding="utf-8")
        return JSONResponse({"saved": True})
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    except Exception:
        return JSONResponse({"error": traceback.format_exc()}, status_code=500)


async def _get_history(request: Request) -> JSONResponse:
    """GET /api/history — return persisted run history (metadata, no HTML)."""
    agents_dir: str = request.app.state.agents_dir
    return JSONResponse(_load_history(agents_dir))


async def _post_history(request: Request) -> JSONResponse:
    """POST /api/history — prepend a new entry to the persisted history.

    Body: one history entry object (agent, fn, params, duration_ms, logs, timestamp).
    HTML is stripped server-side — history is metadata-only on disk.
    """
    agents_dir: str = request.app.state.agents_dir
    try:
        entry = await request.json()
        # Strip HTML from the entry before persisting
        if "reports" in entry:
            entry["reports"] = [
                {k: v for k, v in r.items() if k != "html"}
                for r in (entry["reports"] or [])
            ]
        entries = _load_history(agents_dir)
        entries.insert(0, entry)
        _save_history(agents_dir, entries)
        return JSONResponse({"saved": True})
    except Exception:
        return JSONResponse({"error": traceback.format_exc()}, status_code=500)


async def _scaffold(request: Request) -> JSONResponse:
    """POST /api/scaffold — create a quick-start agent from a template.

    Body: {"template": "dashboard"|"narrative"|"monitoring", "name": "My Report"}
    Returns: {"path": "/abs/path/to/agent_dir", "file": "/abs/path/to/studio_run.py"}
    """
    agents_dir: str = request.app.state.agents_dir
    body = await request.json()
    template: str = body.get("template", "dashboard")
    name: str = body.get("name", "My Report").strip() or "My Report"
    try:
        from openreporting.scaffold import scaffold_studio_template

        agent_dir = scaffold_studio_template(template, name, agents_dir)
        studio_run = str(Path(agent_dir) / "studio_run.py")
        return JSONResponse({"path": agent_dir, "file": studio_run})
    except Exception:
        return JSONResponse({"error": traceback.format_exc()}, status_code=500)


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
            Route("/api/run-stream", _run_agent_stream, methods=["POST"]),
            Route("/api/publish", _publish, methods=["POST"]),
            Route("/api/sections", _sections),
            Route("/api/prompt-content", _prompt_content),
            Route("/api/rerun-section", _rerun_section, methods=["POST"]),
            Route("/api/save-prompt", _save_prompt, methods=["POST"]),
            Route("/api/scaffold", _scaffold, methods=["POST"]),
            Route("/api/history", _get_history),
            Route("/api/history", _post_history, methods=["POST"]),
        ]
    )
    app.state.agents_dir = agents_dir
    app.state.api_key = api_key
    return app

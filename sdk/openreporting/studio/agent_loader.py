"""Agent discovery and hot-reload execution for the Studio workbench."""

from __future__ import annotations

import concurrent.futures
import contextlib
import importlib
import importlib.util
import inspect
import io
import typing
from pathlib import Path


def discover_agents(directory: str) -> list[dict]:
    """Scan a directory for Python files that expose STUDIO_REPORTS."""
    agents = []
    for path in sorted(Path(directory).rglob("*.py")):
        module = _load_module(path)
        if module is None:
            continue
        reports_cfg = getattr(module, "STUDIO_REPORTS", None)
        if not isinstance(reports_cfg, dict) or not reports_cfg:
            continue
        name = getattr(module, "STUDIO_NAME", path.stem)
        description = getattr(module, "STUDIO_DESCRIPTION", "")

        reports = []
        for report_name, cfg in reports_cfg.items():
            fn_name = cfg.get("fn", "")
            fn = getattr(module, fn_name, None)
            if not callable(fn):
                continue
            reports.append({
                "name": report_name,
                "fn": fn_name,
                "description": cfg.get("description", ""),
                "params": _extract_params(fn),
            })

        if reports:
            agents.append({
                "name": name,
                "description": description,
                "file": str(path),
                "mtime": path.stat().st_mtime,
                "reports": reports,
            })
    return agents


def discover_agent_mtimes(directory: str) -> list[dict]:
    """Scan for .py files and return file paths + mtimes without loading modules."""
    results = []
    for path in sorted(Path(directory).rglob("*.py")):
        try:
            results.append({"file": str(path), "mtime": path.stat().st_mtime})
        except OSError:
            pass
    return results


def _normalize_reports(result) -> list[dict]:
    """Normalize agent return value into a list of report dicts."""
    if isinstance(result, str):
        return [{"label": "Report", "html": result}]
    if isinstance(result, list):
        return result  # expected: [{"label": str, "html": str}, ...]
    if isinstance(result, dict):
        return [{"label": k, "html": v} for k, v in result.items()]
    return [{"label": "Report", "html": str(result)}]


def run_agent(file: str, fn: str, params: dict) -> tuple[list[dict], list[str], bool]:
    """Load (or reload) a module and call the named function with params.

    Runs in a dedicated thread so agents that use asyncio.run() work correctly
    even when Studio's own event loop is already running.

    Returns (reports, logs, is_sample_data) where reports is a list of
    {"label", "html"} dicts, logs is a list of captured stdout/stderr lines,
    and is_sample_data reflects the STUDIO_SAMPLE_DATA flag from the module.
    """
    path = Path(file)
    module = _load_module(path)
    func = getattr(module, fn, None)
    if not callable(func):
        raise ValueError(f"Function '{fn}' not found in {file}")

    is_sample_data: bool = bool(getattr(module, "STUDIO_SAMPLE_DATA", False))

    def _execute() -> tuple[list[dict], list[str]]:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            result = func(**params)
        raw = buf.getvalue()
        logs = [line for line in raw.splitlines() if line]
        return _normalize_reports(result), logs

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        reports, logs = pool.submit(_execute).result()

    return reports, logs, is_sample_data


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception:
        return None
    return module


def _extract_params(fn) -> list[dict]:
    params = []
    sig = inspect.signature(fn)
    try:
        hints = typing.get_type_hints(fn)
    except Exception:
        hints = getattr(fn, "__annotations__", {})
    for name, param in sig.parameters.items():
        hint = hints.get(name)
        options = _get_literal_options(hint)
        entry = {
            "name": name,
            "type": "select" if options else _map_type(name, hint),
            "default": (
                None
                if param.default is inspect.Parameter.empty
                else str(param.default)
            ),
        }
        if options:
            entry["options"] = options
        params.append(entry)
    return params


def _map_type(name: str, hint) -> str:
    if name in ("date", "start_date", "end_date"):
        return "date"
    if name in ("month", "start_month", "end_month"):
        return "month"
    if hint is int:
        return "number"
    if hint is bool:
        return "boolean"
    return "string"


def _get_literal_options(hint) -> list[str] | None:
    """Return list of options if hint is a Literal type, otherwise None."""
    if hint is None:
        return None
    origin = getattr(hint, "__origin__", None)
    if origin is typing.Literal:
        return [str(a) for a in hint.__args__]
    return None

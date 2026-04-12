"""Agent discovery and hot-reload execution for the Studio workbench."""

from __future__ import annotations

import concurrent.futures
import contextlib
import importlib
import importlib.util
import inspect
import io
import logging
import queue
import sys
import typing
from pathlib import Path

WATCHED_EXTENSIONS = {'.py', '.sql', '.j2', '.md', '.html', '.yaml', '.yml', '.json', '.toml', '.css'}


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

        agent_dir = path.parent
        reports = []
        for report_name, cfg in reports_cfg.items():
            fn_name = cfg.get("fn", "")
            fn = getattr(module, fn_name, None)
            if not callable(fn):
                continue

            # Auto-detect description HTML from descriptions/ dir if not provided
            report_desc = cfg.get("description", "")
            if not report_desc:
                desc_path = _find_description_file(agent_dir, report_name)
                if desc_path:
                    try:
                        report_desc = desc_path.read_text(encoding="utf-8")
                    except OSError:
                        pass

            reports.append({
                "name": report_name,
                "fn": fn_name,
                "description": report_desc,
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


def _find_description_file(agent_dir: Path, report_name: str) -> Path | None:
    """Look for a description HTML file in the agent's descriptions/ directory."""
    descriptions_dir = agent_dir / "descriptions"
    if not descriptions_dir.is_dir():
        return None
    snake = report_name.lower().replace(" ", "_").replace("-", "_")
    for candidate in [snake, report_name.lower()]:
        path = descriptions_dir / f"{candidate}.html"
        if path.exists():
            return path
    # Fallback: only one HTML file in the directory
    html_files = list(descriptions_dir.glob("*.html"))
    if len(html_files) == 1:
        return html_files[0]
    return None


def discover_agent_mtimes(directory: str) -> list[dict]:
    """Return per-agent max mtime across all watched files in the agent directory.

    Uses a fast text scan to find STUDIO_REPORTS without loading modules.
    Returns one entry per agent file with the max mtime of *any* watched file
    in that agent's directory tree — so changes to .sql, .j2, .md, etc. all
    trigger the file-watcher in Studio.
    """
    results = []
    for path in sorted(Path(directory).rglob("*.py")):
        try:
            head = path.read_text(encoding="utf-8", errors="ignore")[:2048]
        except OSError:
            continue
        if "STUDIO_REPORTS" not in head:
            continue
        agent_dir = path.parent
        max_mtime = 0.0
        for child in agent_dir.rglob("*"):
            if child.is_file() and child.suffix in WATCHED_EXTENSIONS:
                try:
                    mt = child.stat().st_mtime
                    if mt > max_mtime:
                        max_mtime = mt
                except OSError:
                    pass
        results.append({"file": str(path), "dir_mtime": max_mtime})
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

    Returns (reports, logs, is_sample_data).
    """
    path = Path(file)
    module = _load_module(path)
    func = getattr(module, fn, None)
    if not callable(func):
        raise ValueError(f"Function '{fn}' not found in {file}")

    is_sample_data: bool = bool(getattr(module, "STUDIO_SAMPLE_DATA", False))

    def _execute() -> tuple[list[dict], list[str]]:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s  %(levelname)-8s  %(message)s",
            datefmt="%H:%M:%S",
            force=True,
        )
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            result = func(**params)
        raw = buf.getvalue()
        logs = [line for line in raw.splitlines() if line]
        return _normalize_reports(result), logs

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        reports, logs = pool.submit(_execute).result()

    return reports, logs, is_sample_data


def run_agent_streaming(
    file: str,
    fn: str,
    params: dict,
    log_queue: "queue.Queue[tuple[str, object]]",
) -> None:
    """Run an agent and put log/done/error events onto log_queue.

    Designed to be called in a background thread. Puts tuples of
    ("log", line_str), ("done", result_dict), or ("error", traceback_str).
    """
    path = Path(file)
    try:
        module = _load_module(path)
        func = getattr(module, fn, None)
        if not callable(func):
            raise ValueError(f"Function '{fn}' not found in {file}")

        is_sample_data: bool = bool(getattr(module, "STUDIO_SAMPLE_DATA", False))
        all_logs: list[str] = []

        class _StreamingWriter(io.RawIOBase):
            def write(self, s):  # type: ignore[override]
                if isinstance(s, bytes):
                    s = s.decode("utf-8", errors="replace")
                for line in s.splitlines():
                    if line.strip():
                        all_logs.append(line)
                        log_queue.put(("log", line))
                return len(s.encode())

            def readable(self) -> bool:
                return False

            def writable(self) -> bool:
                return True

        writer: io.TextIOWrapper = io.TextIOWrapper(
            _StreamingWriter(), write_through=True
        )

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s  %(levelname)-8s  %(message)s",
            datefmt="%H:%M:%S",
            force=True,
        )

        with contextlib.redirect_stdout(writer), contextlib.redirect_stderr(writer):
            result = func(**params)

        reports = _normalize_reports(result)
        log_queue.put(("done", {"reports": reports, "logs": all_logs, "is_sample_data": is_sample_data}))

    except Exception:
        import traceback as _tb
        log_queue.put(("error", _tb.format_exc()))


async def get_agent_instance(file: str, report_fn: str | None = None):
    """Load the studio_run module and call its STUDIO_AGENT_FACTORY.

    ``STUDIO_AGENT_FACTORY`` may be:
    - A callable (single-agent modules — backward compatible)
    - A dict mapping report function names to factory callables
      (multi-agent modules, e.g. ``{"run": _factory_a, "run_recon": _factory_b}``)

    When *report_fn* is provided and the factory is a dict, the matching
    factory is used.  Otherwise falls back to the first entry or the
    callable itself.

    Returns an initialised agent instance, or None if the module has no factory.
    """
    path = Path(file)
    module = _load_module(path)
    if module is None:
        return None
    factory = getattr(module, "STUDIO_AGENT_FACTORY", None)
    if factory is None:
        return None

    # Dict of factories keyed by report function name
    if isinstance(factory, dict):
        if report_fn and report_fn in factory:
            return await factory[report_fn]()
        # Fallback to first entry
        first = next(iter(factory.values()), None)
        return await first() if first else None

    if callable(factory):
        return await factory()

    return None


def resolve_prompt_path(file: str, prompt_filename: str) -> Path:
    """Return the absolute path to a prompt file in the agent's prompts/ directory.

    Raises ValueError if prompt_filename contains path components that would
    escape the prompts/ directory (path traversal protection).
    """
    agent_dir = Path(file).resolve().parent
    prompts_dir = agent_dir / "prompts"
    resolved = (prompts_dir / prompt_filename).resolve()
    if not str(resolved).startswith(str(prompts_dir.resolve())):
        raise ValueError(f"Path traversal detected in prompt filename: {prompt_filename!r}")
    return resolved


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)

    # Auto-inject sys.path: walk up to find project root (.git or pyproject.toml).
    # This lets studio_run.py files skip the manual sys.path hack.
    _injected: list[str] = []
    current = path.resolve().parent
    for _ in range(6):
        if (current / ".git").exists() or (current / "pyproject.toml").exists():
            root_str = str(current)
            if root_str not in sys.path:
                sys.path.insert(0, root_str)
                _injected.append(root_str)
            break
        parent = current.parent
        if parent == current:
            break
        current = parent

    try:
        spec.loader.exec_module(module)  # type: ignore[union-attr]
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
